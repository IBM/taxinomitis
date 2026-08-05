/* eslint no-console: 0 */
/* tslint:disable: no-console max-line-length */

//
// ONE-OFF REMEDIATION SCRIPT
//
// Finds (and optionally deletes) objects in Cloud Object Storage that were
//  orphaned by the reversed-argument bug in sessionusers/index.ts.
//
// THE BUG
//   cleanupExpiredSessionUsers() called
//       store.storeDeleteUserObjectsJob(expiredUser.id, CLASS_NAME)
//   but the signature is
//       storeDeleteUserObjectsJob(classid, userid)
//   so the queued job asked the object store to delete everything under the
//   prefix "<userid>/session-users/" instead of "session-users/<userid>/".
//   No object is ever written under a top-level prefix equal to a user id, so
//   the job matched nothing, silently succeeded, and was dequeued. The user's
//   database rows were deleted correctly; only their images/sounds were left
//   behind in object storage.
//
//   (The bug could never have deleted the WRONG objects - a user id can't
//    collide with a class id - so this script is only ever cleaning up
//    genuinely unreachable data.)
//
//
// SAFETY MODEL - read this before running with --delete
//
//   This script will only ever delete an object when EVERY one of the
//   following is true. Any single failure disqualifies the whole user.
//
//   1. The object key's first path segment is exactly 'session-users'.
//      We enumerate using that prefix and re-check every key. No object
//      belonging to a real class can be reached by this script at all.
//
//   2. The key has exactly 4 non-empty segments
//      (<classid>/<userid>/<projectid>/<objectid>) and its second segment
//      matches the user we are processing.
//
//   3. No row exists in the sessionusers table for that user id. A row is
//      disqualifying even if it has already expired - an expired-but-unswept
//      user is the normal sweep's job, not ours, now that the bug is fixed.
//
//   4. No project row exists for ANY project id appearing under that user.
//      If the database still knows about the project, the objects are not
//      orphaned, whatever else is true.
//
//   5. Immediately before deleting, condition 3 is re-checked, to narrow the
//      window between scanning and deleting.
//
//   6. The parsed {classid, userid, projectid, objectid} spec is re-serialised
//      with the production key builder and must reproduce the original key
//      byte-for-byte. This catches any parsing mistake before it becomes a
//      delete.
//
//   Deletion is per-object, using the exact validated key. The bulk
//   prefix-based helpers (objectstore.deleteUser / deleteProject) are
//   deliberately NOT used - a mistake in a prefix deletes far more than a
//   mistake in a single key.
//
//   The script is DRY RUN by default. --delete additionally requires typing a
//   confirmation phrase.
//
//   If the object listing ever stops advancing, the scan stops early and says
//   so loudly. The results are then INCOMPLETE - safe to act on (everything
//   reported still passed all six gates) but not a full sweep, so re-run
//   before concluding the bucket is clean.
//
//
// RUNTIME
//
//   The bucket is scanned in a single pass, one request per 1000 objects,
//   printing progress as it goes. Expect this to take minutes on a large
//   bucket. Nothing is read from object storage except listings, and nothing
//   is written unless --delete is given and confirmed.
//
//
// USAGE
//   npm run build      (or: npm run compile)
//
//   # dry run - report only, deletes nothing
//   node dist/ops/find-orphaned-objects.js
//
//   # inspect one user before committing to anything
//   node dist/ops/find-orphaned-objects.js --user <userid>
//
//   # actually delete (prompts for confirmation)
//   node dist/ops/find-orphaned-objects.js --delete
//
//   # delete, but stop after N objects - recommended for the first real run
//   node dist/ops/find-orphaned-objects.js --delete --limit 100
//
// Requires the same environment as the server: OBJECT_STORE_BUCKET,
//  OBJECT_STORE_CREDS, and the POSTGRESQL* variables.
//

import * as fs from 'fs';
import * as readline from 'readline';
import * as IBMCosSDK from 'ibm-cos-sdk';

import * as store from '../lib/db/store';
import * as objectstore from '../lib/objectstore';
import * as keys from '../lib/objectstore/keys';
import * as ObjectStoreTypes from '../lib/objectstore/types';
import { CLASS_NAME as SESSION_USERS_CLASSID } from '../lib/sessionusers';


const SEPARATOR = '/';
const PAGE_SIZE = 1000;

// how many users to check against the database at once
//
// the database phase is one round trip per user (plus one per distinct
//  project), and at 50,000+ users doing that strictly sequentially from a
//  laptop takes hours. The pg connection pool defaults to a maximum of 10
//  connections, so stay comfortably under that.
const DB_CONCURRENCY = 8;

const CONFIRMATION_PHRASE = 'delete orphaned session-user objects';


interface Options {
    readonly doDelete: boolean;
    readonly limit: number;
    readonly onlyUser?: string;
    readonly reportPath?: string;
}

interface UserVerdict {
    readonly userid: string;
    readonly keys: string[];
    readonly projectids: string[];
    readonly orphaned: boolean;
    readonly reason: string;
}


function parseArgs(): Options {
    const args = process.argv.slice(2);

    let doDelete = false;
    let limit = Number.MAX_SAFE_INTEGER;
    let onlyUser: string | undefined;
    let reportPath: string | undefined;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--delete') {
            doDelete = true;
        }
        else if (arg === '--limit') {
            const value = Number(args[++i]);
            if (!Number.isInteger(value) || value < 1) {
                console.error('--limit requires a positive integer');
                process.exit(-1); // eslint-disable-line
            }
            limit = value;
        }
        else if (arg === '--user') {
            onlyUser = args[++i];
            if (!onlyUser) {
                console.error('--user requires a user id');
                process.exit(-1); // eslint-disable-line
            }
        }
        else if (arg === '--report') {
            reportPath = args[++i];
            if (!reportPath) {
                console.error('--report requires a file path');
                process.exit(-1); // eslint-disable-line
            }
        }
        else {
            console.error('unrecognised argument:', arg);
            console.error('usage: node find-orphaned-objects.js [--delete] [--limit N] [--user ID] [--report FILE]');
            process.exit(-1); // eslint-disable-line
        }
    }

    return { doDelete, limit, onlyUser, reportPath };
}


/**
 * SAFETY CHECK 1, 2 and 6.
 *
 * Parses an object key into a spec, returning undefined unless the key is
 *  unambiguously a session-user object belonging to the expected user, and
 *  the spec round-trips back to exactly the same key.
 */
function parseKeySafely(key: string, expectedUserid: string): ObjectStoreTypes.ObjectSpec | undefined {
    const chunks = key.split(SEPARATOR);

    if (chunks.length !== 4) {
        return;
    }
    if (chunks.some((chunk) => chunk.length === 0)) {
        return;
    }

    const spec: ObjectStoreTypes.ObjectSpec = {
        classid : chunks[0],
        userid : chunks[1],
        projectid : chunks[2],
        objectid : chunks[3],
    };

    // must be in the session-users class - nothing else is ever in scope
    if (spec.classid !== SESSION_USERS_CLASSID) {
        return;
    }
    // must belong to the user we think we are processing
    if (spec.userid !== expectedUserid) {
        return;
    }
    // must round-trip through the production key builder
    if (keys.get(spec) !== key) {
        return;
    }

    return spec;
}


/**
 * Streams every object under 'session-users/' in a SINGLE pass, grouping
 *  keys by the user they belong to.
 *
 * Deliberately does not use Delimiter and a per-user follow-up listing:
 *  that costs one extra round trip per user, which on a production bucket
 *  with tens of thousands of expired session users is hours of sequential
 *  requests. One pass at PAGE_SIZE keys per request is enough to learn
 *  everything we need.
 *
 * Keys that do not look like session-user object keys are counted and
 *  ignored - they are never returned to the caller, so they can never be
 *  considered for deletion.
 */
async function scanSessionUserObjects(cos: IBMCosSDK.S3, bucket: string): Promise<{
    byUser: Map<string, string[]>,
    scanned: number,
    ignored: number,
}> {
    const byUser = new Map<string, string[]>();
    const prefix = SESSION_USERS_CLASSID + SEPARATOR;

    let scanned = 0;
    let ignored = 0;
    let pages = 0;
    const startedAt = Date.now();

    let marker: string | undefined;
    do {
        const response = await cos.listObjects({
            Bucket : bucket,
            Prefix : prefix,
            Marker : marker,
            MaxKeys : PAGE_SIZE,
        }).promise();

        const contents = response.Contents ? response.Contents : [];
        for (const item of contents) {
            if (!item.Key) {
                continue;
            }
            scanned += 1;

            // group by the userid segment, but only for keys that are
            //  shaped like a session-user object key
            const chunks = item.Key.split(SEPARATOR);
            if (chunks.length !== 4 ||
                chunks.some((chunk) => chunk.length === 0) ||
                chunks[0] !== SESSION_USERS_CLASSID)
            {
                ignored += 1;
                continue;
            }

            const userid = chunks[1];
            const existing = byUser.get(userid);
            if (existing) {
                existing.push(item.Key);
            }
            else {
                byUser.set(userid, [ item.Key ]);
            }
        }

        pages += 1;
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        process.stdout.write('\r  scanned ' + scanned + ' objects across ' +
                             byUser.size + ' users (' + pages + ' requests, ' + elapsed + 's)   ');

        if (response.IsTruncated && contents.length > 0) {
            const nextMarker = contents[contents.length - 1].Key;

            // guard against a non-advancing marker, which would loop forever
            if (!nextMarker || (marker && nextMarker <= marker)) {
                console.log('');
                console.error('WARNING: object listing stopped advancing - stopping enumeration early.');
                console.error('         Results are INCOMPLETE. Do not treat this as a full sweep.');
                marker = undefined;
            }
            else {
                marker = nextMarker;
            }
        }
        else {
            marker = undefined;
        }
    } while (marker);

    console.log('');
    return { byUser, scanned, ignored };
}


/**
 * SAFETY CHECKS 3 and 4.
 *
 * Decides whether every object belonging to this user is safe to delete.
 * Deliberately all-or-nothing per user - if anything about a user looks
 *  unexpected, we leave all of their data alone and report it.
 */
async function assessUser(userid: string, objectKeys: string[]): Promise<UserVerdict> {
    if (objectKeys.length === 0) {
        return { userid, keys : [], projectids : [], orphaned : false, reason : 'no objects' };
    }

    // SAFETY CHECK 3 - is this still a known session user?
    const sessionUser = await store.getTemporaryUser(userid);
    if (sessionUser) {
        return {
            userid, keys : objectKeys, projectids : [],
            orphaned : false,
            reason : 'ACTIVE SESSION USER (expires ' + sessionUser.sessionExpiry.toISOString() + ') - left alone',
        };
    }

    // SAFETY CHECK 2 - every key must parse cleanly and belong to this user
    const projectids = new Set<string>();
    for (const objectKey of objectKeys) {
        const spec = parseKeySafely(objectKey, userid);
        if (!spec) {
            return {
                userid, keys : objectKeys, projectids : [],
                orphaned : false,
                reason : 'UNRECOGNISED KEY FORMAT (' + objectKey + ') - left alone',
            };
        }
        projectids.add(spec.projectid);
    }

    // SAFETY CHECK 4 - does the database still know about any of these projects?
    for (const projectid of projectids) {
        const project = await store.getProject(projectid);
        if (project) {
            return {
                userid, keys : objectKeys, projectids : Array.from(projectids),
                orphaned : false,
                reason : 'PROJECT ' + projectid + ' STILL EXISTS IN THE DB - left alone',
            };
        }
    }

    return {
        userid, keys : objectKeys, projectids : Array.from(projectids),
        orphaned : true,
        reason : 'orphaned - session user and all ' + projectids.size + ' project(s) gone from the DB',
    };
}


/**
 * Runs assessUser() over every user, a few at a time.
 *
 * Results are written back in the original order, so the output is
 *  deterministic regardless of which worker finishes first.
 */
async function assessAllUsers(
    userids: string[],
    byUser: Map<string, string[]>,
): Promise<UserVerdict[]>
{
    const verdicts: UserVerdict[] = new Array(userids.length);
    const startedAt = Date.now();

    let nextIndex = 0;
    let completed = 0;

    async function worker(): Promise<void> {
        for (;;) {
            const index = nextIndex;
            nextIndex += 1;
            if (index >= userids.length) {
                return;
            }

            const userid = userids[index];
            const objectKeys = byUser.get(userid);
            verdicts[index] = await assessUser(userid, objectKeys ? objectKeys : []);

            completed += 1;
            if (completed % 500 === 0 || completed === userids.length) {
                const elapsed = Math.round((Date.now() - startedAt) / 1000);
                process.stdout.write('\r  checked ' + completed + ' of ' + userids.length +
                                     ' users (' + elapsed + 's)   ');
            }
        }
    }

    const workers: Promise<void>[] = [];
    for (let i = 0; i < DB_CONCURRENCY; i++) {
        workers.push(worker());
    }
    await Promise.all(workers);

    console.log('');
    return verdicts;
}


function confirm(question: string): Promise<string> {
    const rl = readline.createInterface({
        input : process.stdin,
        output : process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}


async function deleteOrphans(verdicts: UserVerdict[], limit: number): Promise<void> {
    let deleted = 0;
    let failed = 0;

    for (const verdict of verdicts) {
        if (deleted >= limit) {
            console.log('');
            console.log('reached --limit of ' + limit + ' - stopping');
            break;
        }

        // SAFETY CHECK 5 - re-verify immediately before deleting this user's data
        const stillGone = await store.getTemporaryUser(verdict.userid);
        if (stillGone) {
            console.log('  SKIP ' + verdict.userid + ' - session user reappeared since scanning');
            continue;
        }

        for (const objectKey of verdict.keys) {
            if (deleted >= limit) {
                break;
            }

            // SAFETY CHECK 2 and 6, applied again at the point of deletion
            const spec = parseKeySafely(objectKey, verdict.userid);
            if (!spec) {
                console.error('  SKIP ' + objectKey + ' - failed re-validation');
                failed += 1;
                continue;
            }

            try {
                await objectstore.deleteObject(spec);
                deleted += 1;
                console.log('  deleted ' + objectKey);
            }
            catch (err) {
                failed += 1;
                console.error('  FAILED to delete ' + objectKey, err);
            }
        }
    }

    console.log('');
    console.log('objects deleted :', deleted);
    console.log('failures        :', failed);
}


async function run(): Promise<void> {
    const options = parseArgs();

    console.log('mode            :', options.doDelete ? 'DELETE' : 'DRY RUN (nothing will be deleted)');
    if (options.limit !== Number.MAX_SAFE_INTEGER) {
        console.log('limit           :', options.limit);
    }
    if (options.onlyUser) {
        console.log('only user       :', options.onlyUser);
    }
    console.log('class prefix    :', SESSION_USERS_CLASSID + SEPARATOR, '(nothing outside this is ever considered)');
    console.log('');

    objectstore.init();
    const credentials = objectstore.getCredentials();
    if (!credentials.bucketid || !credentials.credentials) {
        console.error('Object storage is not configured.');
        console.error('Set OBJECT_STORE_BUCKET and OBJECT_STORE_CREDS and try again.');
        process.exit(-1); // eslint-disable-line
    }
    console.log('bucket          :', credentials.bucketid);

    const cos = new IBMCosSDK.S3(credentials.credentials);

    console.log('connecting to DB...');
    await store.init();

    try {
        console.log('scanning object storage under ' + SESSION_USERS_CLASSID + SEPARATOR + '...');
        console.log('(one request per ' + PAGE_SIZE + ' objects - this can take a while on a large bucket)');
        const scan = await scanSessionUserObjects(cos, credentials.bucketid);

        console.log('objects scanned             :', scan.scanned);
        console.log('objects ignored (bad shape) :', scan.ignored);
        console.log('distinct users found        :', scan.byUser.size);

        const userids = Array.from(scan.byUser.keys())
                            .filter((id) => !options.onlyUser || id === options.onlyUser)
                            .sort();
        if (options.onlyUser) {
            console.log('matching --user filter      :', userids.length);
        }
        console.log('');
        console.log('checking each user against the database (' + DB_CONCURRENCY + ' at a time)...');

        const verdicts = await assessAllUsers(userids, scan.byUser);

        // At this scale, printing a line per orphaned user is unreadable - the
        //  full list goes to --report instead. Users we are LEAVING ALONE are
        //  the interesting ones to see, because each represents data the script
        //  decided not to touch, so those are always printed.
        for (const verdict of verdicts) {
            if (!verdict.orphaned && verdict.keys.length > 0) {
                console.log('keeping  ' + verdict.userid +
                            ' [' + verdict.keys.length + ' object(s)] - ' + verdict.reason);
            }
        }

        const orphaned = verdicts.filter((verdict) => verdict.orphaned);
        const orphanedObjectCount = orphaned.reduce((total, verdict) => total + verdict.keys.length, 0);
        const keptWithObjects = verdicts.filter((verdict) => !verdict.orphaned && verdict.keys.length > 0);

        console.log('');
        console.log('======================================================');
        console.log('users scanned            :', verdicts.length);
        console.log('users left alone         :', keptWithObjects.length);
        console.log('orphaned users           :', orphaned.length);
        console.log('orphaned objects         :', orphanedObjectCount);
        console.log('======================================================');

        if (options.reportPath) {
            fs.writeFileSync(options.reportPath, JSON.stringify({
                generated : new Date().toISOString(),
                bucket : credentials.bucketid,
                objectsScanned : scan.scanned,
                objectsIgnored : scan.ignored,
                orphanedUsers : orphaned.map((verdict) => {
                    return { userid : verdict.userid, keys : verdict.keys };
                }),
                leftAlone : keptWithObjects.map((verdict) => {
                    return { userid : verdict.userid, objects : verdict.keys.length, reason : verdict.reason };
                }),
            }, null, 2));
            console.log('');
            console.log('full report written to', options.reportPath);
        }

        if (orphanedObjectCount === 0) {
            console.log('');
            console.log('Nothing to do.');
            return;
        }

        if (!options.doDelete) {
            console.log('');
            console.log('This was a DRY RUN. Nothing has been deleted.');
            console.log('Re-run with --delete to remove the objects listed above.');
            return;
        }

        const willDelete = Math.min(orphanedObjectCount, options.limit);
        console.log('');
        console.log('About to permanently delete ' + willDelete + ' object(s) from ' + credentials.bucketid + '.');
        console.log('This cannot be undone.');
        console.log('');
        const answer = await confirm('Type "' + CONFIRMATION_PHRASE + '" to continue: ');
        if (answer.trim() !== CONFIRMATION_PHRASE) {
            console.log('');
            console.log('Confirmation did not match. Nothing has been deleted.');
            return;
        }

        console.log('');
        console.log('deleting...');
        await deleteOrphans(orphaned, options.limit);
    }
    finally {
        await store.disconnect();
    }
}


run()
    .then(() => {
        console.log('');
        console.log('done');
    })
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    });
