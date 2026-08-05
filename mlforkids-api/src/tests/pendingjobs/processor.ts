import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { v4 as uuid } from 'uuid';
import * as IBMCosSDK from 'ibm-cos-sdk';

import * as processor from '../../lib/pendingjobs/processor';
import * as objectstore from '../../lib/objectstore';
import * as dbobjects from '../../lib/db/objects';
import * as Objects from '../../lib/db/db-types';
import * as ObjectStoreTypes from '../../lib/objectstore/types';
import * as mock from '../imagestore/mockStore';


//
// These tests cover the step that nothing else covered: taking a queued
//  pending job and actually applying it to object storage.
//
// Every other test in the suite stops at "the right job was queued". That
//  left the mapping from job -> object store call -> object store KEY
//  completely unverified, which is the layer the reversed-argument bug in
//  sessionusers/index.ts lived one step above.
//
// The most valuable assertions here are the negative ones: as well as
//  checking that a job deletes what it should, each test checks that it
//  leaves neighbouring data alone. Object storage deletion is by prefix, so
//  the failure mode of a bad spec is either "deletes nothing" (a silent leak)
//  or "deletes far too much" (data loss), and those need telling apart.
//

describe('Pending jobs - processor', () => {

    let oldEnvCreds: string | undefined;
    let oldEnvBucket: string | undefined;

    before(() => {
        oldEnvCreds = process.env.OBJECT_STORE_CREDS;
        oldEnvBucket = process.env.OBJECT_STORE_BUCKET;

        process.env.OBJECT_STORE_CREDS = JSON.stringify({
            endpoint : 'localhost:9999',
            apiKeyId : 'myApiKey',
            ibmAuthEndpoint : 'https://iam.ng.bluemix.net/oidc/token',
            serviceInstanceId : 'uniqServInstanceId',
        });
        process.env.OBJECT_STORE_BUCKET = 'TESTBUCKET';
    });

    after(() => {
        process.env.OBJECT_STORE_CREDS = oldEnvCreds;
        process.env.OBJECT_STORE_BUCKET = oldEnvBucket;
    });


    let cosStub: sinon.SinonStub;

    beforeEach(() => {
        mock.reset();
        cosStub = sinon.stub(IBMCosSDK, 'S3');
        cosStub.returns(mock.mockS3);
        objectstore.init();
    });
    afterEach(() => {
        cosStub.restore();
    });


    // ------------------------------------------------------------------
    //  helpers
    // ------------------------------------------------------------------

    async function storeObject(spec: ObjectStoreTypes.ObjectSpec): Promise<void> {
        await objectstore.storeImage(spec, 'image/png', Buffer.from('image contents'));
    }

    async function exists(spec: ObjectStoreTypes.ObjectSpec): Promise<boolean> {
        try {
            await objectstore.getImage(spec);
            return true;
        }
        catch (err) {
            if (err.message === 'The specified key does not exist.') {
                return false;
            }
            throw err;
        }
    }

    function objectSpec(classid: string, userid: string, projectid: string, objectid: string)
        : ObjectStoreTypes.ObjectSpec
    {
        return { classid, userid, projectid, objectid };
    }

    async function assertAllGone(specs: ObjectStoreTypes.ObjectSpec[]): Promise<void> {
        for (const spec of specs) {
            assert.strictEqual(await exists(spec), false,
                               'expected to be deleted : ' + JSON.stringify(spec));
        }
    }

    async function assertAllPresent(specs: ObjectStoreTypes.ObjectSpec[]): Promise<void> {
        for (const spec of specs) {
            assert.strictEqual(await exists(spec), true,
                               'expected to survive : ' + JSON.stringify(spec));
        }
    }

    /**
     * Asserts that a job is refused with the given message.
     *
     * Deliberately tolerant of processJob() either throwing synchronously or
     *  returning a rejected promise. It is declared as returning a Promise but
     *  the spec validators throw before any promise is created, so today it
     *  does the former - runner.ts awaits it inside a try/catch, so both work.
     *  What matters here is that the job is refused and not silently applied,
     *  so the tests should not break if that detail is ever tidied up.
     */
    async function assertJobRefused(job: Objects.PendingJob, message: string): Promise<void> {
        let refusal: Error | undefined;
        try {
            await processor.processJob(job);
        }
        catch (err) {
            refusal = err;
        }

        assert(refusal, 'expected the job to be refused');
        assert.strictEqual(refusal.message, message);
    }


    // ------------------------------------------------------------------
    //  one object
    // ------------------------------------------------------------------

    describe('DeleteOneObjectFromObjectStorage', () => {

        it('deletes only the object it names', async () => {
            const classid = uuid();
            const userid = uuid();
            const projectid = uuid();

            const target = objectSpec(classid, userid, projectid, uuid());
            const sibling = objectSpec(classid, userid, projectid, uuid());

            await storeObject(target);
            await storeObject(sibling);

            await processor.processJob(dbobjects.createDeleteObjectStoreJob(target));

            await assertAllGone([ target ]);
            await assertAllPresent([ sibling ]);
        });

        it('rejects a job that is missing the object id', async () => {
            const job: Objects.PendingJob = {
                id : uuid(),
                jobtype : Objects.PendingJobType.DeleteOneObjectFromObjectStorage,
                jobdata : { classid : uuid(), userid : uuid(), projectid : uuid() },
                attempts : 0,
            };

            await assertJobRefused(job, 'Missing required info in pending job');
        });
    });


    // ------------------------------------------------------------------
    //  one project
    // ------------------------------------------------------------------

    describe('DeleteProjectObjectsFromObjectStorage', () => {

        it('deletes every object in the project', async () => {
            const classid = uuid();
            const userid = uuid();
            const projectid = uuid();

            const objects = [
                objectSpec(classid, userid, projectid, uuid()),
                objectSpec(classid, userid, projectid, uuid()),
                objectSpec(classid, userid, projectid, uuid()),
            ];
            for (const spec of objects) {
                await storeObject(spec);
            }

            await processor.processJob(
                dbobjects.createDeleteProjectObjectsJob({ classid, userid, projectid }));

            await assertAllGone(objects);
        });

        it('leaves the same user\'s other projects alone', async () => {
            const classid = uuid();
            const userid = uuid();
            const doomedProject = uuid();
            const keptProject = uuid();

            const doomed = objectSpec(classid, userid, doomedProject, uuid());
            const kept = objectSpec(classid, userid, keptProject, uuid());

            await storeObject(doomed);
            await storeObject(kept);

            await processor.processJob(dbobjects.createDeleteProjectObjectsJob({
                classid, userid, projectid : doomedProject,
            }));

            await assertAllGone([ doomed ]);
            await assertAllPresent([ kept ]);
        });

        it('rejects a job that is missing the project id', async () => {
            const job: Objects.PendingJob = {
                id : uuid(),
                jobtype : Objects.PendingJobType.DeleteProjectObjectsFromObjectStorage,
                jobdata : { classid : uuid(), userid : uuid() },
                attempts : 0,
            };

            await assertJobRefused(job, 'Missing required info in pending job');
        });
    });


    // ------------------------------------------------------------------
    //  one user
    // ------------------------------------------------------------------

    describe('DeleteUserObjectsFromObjectStorage', () => {

        it('deletes every object across all of the user\'s projects', async () => {
            const classid = uuid();
            const userid = uuid();

            const objects = [
                objectSpec(classid, userid, uuid(), uuid()),
                objectSpec(classid, userid, uuid(), uuid()),
            ];
            for (const spec of objects) {
                await storeObject(spec);
            }

            await processor.processJob(dbobjects.createDeleteUserObjectsJob({ classid, userid }));

            await assertAllGone(objects);
        });

        it('leaves other users in the same class alone', async () => {
            const classid = uuid();
            const doomedUser = uuid();
            const keptUser = uuid();

            const doomed = objectSpec(classid, doomedUser, uuid(), uuid());
            const kept = objectSpec(classid, keptUser, uuid(), uuid());

            await storeObject(doomed);
            await storeObject(kept);

            await processor.processJob(
                dbobjects.createDeleteUserObjectsJob({ classid, userid : doomedUser }));

            await assertAllGone([ doomed ]);
            await assertAllPresent([ kept ]);
        });

        // REGRESSION TEST for the reversed-argument bug that was fixed in
        //  sessionusers/index.ts (it called storeDeleteUserObjectsJob(userid,
        //  classid) instead of (classid, userid)).
        //
        // This pins down the CONSEQUENCE of that class of mistake end to end:
        //  a swapped spec produces the prefix '<userid>/<classid>/', which
        //  matches nothing, so the job silently succeeds and deletes NOTHING.
        //  It cannot delete the wrong data - which is why that bug was a leak
        //  rather than data loss. If that ever stops being true, this test
        //  fails and someone gets to think very hard about it.
        it('deletes nothing - and destroys nothing - if the class and user are the wrong way round', async () => {
            const classid = uuid();
            const userid = uuid();

            const stored = objectSpec(classid, userid, uuid(), uuid());
            await storeObject(stored);

            await processor.processJob(dbobjects.createDeleteUserObjectsJob({
                classid : userid,     // deliberately swapped
                userid : classid,
            }));

            await assertAllPresent([ stored ]);
        });

        it('rejects a job that is missing the user id', async () => {
            const job: Objects.PendingJob = {
                id : uuid(),
                jobtype : Objects.PendingJobType.DeleteUserObjectsFromObjectStorage,
                jobdata : { classid : uuid() } as ObjectStoreTypes.ClassSpec,
                attempts : 0,
            };

            await assertJobRefused(job, 'Missing required info in pending job');
        });
    });


    // ------------------------------------------------------------------
    //  one class
    // ------------------------------------------------------------------

    describe('DeleteClassObjectsFromObjectStorage', () => {

        it('deletes every object belonging to every user in the class', async () => {
            const classid = uuid();

            const objects = [
                objectSpec(classid, uuid(), uuid(), uuid()),
                objectSpec(classid, uuid(), uuid(), uuid()),
            ];
            for (const spec of objects) {
                await storeObject(spec);
            }

            await processor.processJob(dbobjects.createDeleteClassObjectsJob({ classid }));

            await assertAllGone(objects);
        });

        it('leaves other classes alone', async () => {
            const doomedClass = uuid();
            const keptClass = uuid();

            const doomed = objectSpec(doomedClass, uuid(), uuid(), uuid());
            const kept = objectSpec(keptClass, uuid(), uuid(), uuid());

            await storeObject(doomed);
            await storeObject(kept);

            await processor.processJob(
                dbobjects.createDeleteClassObjectsJob({ classid : doomedClass }));

            await assertAllGone([ doomed ]);
            await assertAllPresent([ kept ]);
        });

        it('rejects a job with no class id', async () => {
            const job: Objects.PendingJob = {
                id : uuid(),
                jobtype : Objects.PendingJobType.DeleteClassObjectsFromObjectStorage,
                jobdata : {} as ObjectStoreTypes.ClassSpec,
                attempts : 0,
            };

            await assertJobRefused(job, 'Missing required info in pending job');
        });
    });


    // ------------------------------------------------------------------
    //  unknown jobs
    // ------------------------------------------------------------------

    describe('unrecognised jobs', () => {

        it('rejects a job type it does not know about', async () => {
            const job: Objects.PendingJob = {
                id : uuid(),
                jobtype : 99 as Objects.PendingJobType,
                jobdata : { classid : uuid() },
                attempts : 0,
            };

            await assertJobRefused(job, 'Unrecognised pending job type');
        });
    });

});
