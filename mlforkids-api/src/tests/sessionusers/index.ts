import { describe, it, before, beforeEach, after } from 'node:test';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as store from '../../lib/db/store';
import * as Objects from '../../lib/db/db-types';
import * as keys from '../../lib/objectstore/keys';
import * as ObjectStoreTypes from '../../lib/objectstore/types';
import * as sessionusers from '../../lib/sessionusers';




/**
 * Empties the pending jobs queue, returning everything that was on it.
 *
 * Used instead of store.deleteAllPendingJobs() because that is a no-op
 *  unless the tests are running against a localhost database.
 */
async function drainPendingJobs(): Promise<Objects.PendingJob[]> {
    const drained: Objects.PendingJob[] = [];

    let job = await store.getNextPendingJob();
    while (job) {
        drained.push(job);
        await store.deletePendingJob(job);
        job = await store.getNextPendingJob();
    }

    return drained;
}




describe('session users', { concurrency: false }, () => {

    let clock: sinon.SinonFakeTimers;


    before(async () => {
        clock = sinon.useFakeTimers({ now: Date.now(), shouldAdvanceTime: true });
        await store.init();
        await store.testonly_resetSessionUsersStore();
    });

    beforeEach(() => {
        // advance 12 seconds, because we don't check
        //  to see if a class is full more than once
        //  every 10 seconds
        clock.tick(1000 * 12);
    });

    after(async () => {
        clock.restore();

        await store.disconnect();
    });


    describe('createSessionUser', () => {

        it('should create a user', async () => {
            const user = await sessionusers.createSessionUser();
            assert(user);
            assert(user.id);
            assert(user.token);
            assert(user.sessionExpiry);

            await sessionusers.deleteSessionUser(user);
        });

        it('should enforce session class size limit', async () => {

            const TEST_CLASS_LIMIT = 3500;

            const setupPromises: Promise<Objects.TemporaryUser>[] = [];
            for (let i = 0; i < TEST_CLASS_LIMIT; i++) {
                setupPromises.push(sessionusers.createSessionUser());
            }

            const fillers: Objects.TemporaryUser[] = await Promise.all(setupPromises);

            await assert.rejects(
                () => sessionusers.createSessionUser(),
                { message: sessionusers.ERROR_MESSAGES.CLASS_FULL }
            );

            await store.bulkDeleteTemporaryUsers(fillers);
        });
    });



    describe('deleteSessionUser', () => {

        it('should delete a session user', async () => {
            const user = await sessionusers.createSessionUser();
            await sessionusers.deleteSessionUser(user);

            const verifyDelete = await store.getTemporaryUser(user.id);
            assert(!verifyDelete);
        });


        it('should clean up resources for deleted session users', async () => {
            const user = await sessionusers.createSessionUser();
            const project = await store.storeProject(user.id, sessionusers.CLASS_NAME, 'text', 'TEST', 'en', [], false);

            await sessionusers.deleteSessionUser(user);
            const verify = await store.getProject(project.id);
            assert(!verify);
        });


        it('should handle deleting non-existing users', async () => {
            await sessionusers.deleteSessionUser({
                id : 'DOES-NOT-EXIST',
                token : 'DOES-NOT-EXIST',
                sessionExpiry : new Date(),
            });
        });
    });


    describe('checkSessionToken', () => {

        it('should verify a session user token', async () => {
            const user = await sessionusers.createSessionUser();

            const valid = await sessionusers.checkSessionToken(user.id, user.token);
            assert.strictEqual(valid, true);

            await sessionusers.deleteSessionUser(user);
        });


        it('should reject tokens for non-existent users', async () => {
            const valid = await sessionusers.checkSessionToken('UNKNOWN', 'UNKNOWN');
            assert.strictEqual(valid, false);
        });

        it('should reject invalid tokens', async () => {
            const user = await sessionusers.createSessionUser();

            const valid = await sessionusers.checkSessionToken(user.id, 'X' + user.token);
            assert.strictEqual(valid, false);

            await sessionusers.deleteSessionUser(user);
        });

        it('should reject expired tokens', async () => {
            const user = await store.storeTemporaryUser(-1000);

            const valid = await sessionusers.checkSessionToken(user.id, user.token);
            assert.strictEqual(valid, false);

            await sessionusers.deleteSessionUser(user);
        });

    });


    describe('cleanupExpiredSessionUsers', () => {

        it('should remove resources for expired users', async () => {
            const user = await store.storeTemporaryUser(-1000);
            const project = await store.storeProject(user.id, sessionusers.CLASS_NAME, 'text', 'TEST', 'en', [], false);

            await sessionusers.cleanupExpiredSessionUsers();

            const verifyProject = await store.getProject(project.id);
            assert(!verifyProject);

            const verifyUser = await store.getTemporaryUser(user.id);
            assert(!verifyUser);
        });

        it('should not remove resources for active users', async () => {
            const user = await sessionusers.createSessionUser();
            const project = await store.storeProject(user.id, sessionusers.CLASS_NAME, 'text', 'TEST', 'en', [], false);

            await sessionusers.cleanupExpiredSessionUsers();

            const verifyProject = await store.getProject(project.id);
            assert.deepStrictEqual(project, verifyProject);

            const verifyUser = await store.getTemporaryUser(user.id);
            assert.deepStrictEqual(user, verifyUser);

            await sessionusers.deleteSessionUser(user);
        });


        // REGRESSION TEST
        //
        // cleanupExpiredSessionUsers() used to call
        //     storeDeleteUserObjectsJob(expiredUser.id, CLASS_NAME)
        // but the signature is
        //     storeDeleteUserObjectsJob(classid, userid)
        //
        // The reversed arguments produced a job asking object storage to
        //  delete everything under "<userid>/session-users/" instead of
        //  "session-users/<userid>/". Nothing is ever stored under a
        //  top-level prefix equal to a user id, so the job matched nothing,
        //  silently succeeded, and was dequeued - leaving every expired
        //  session user's images and sounds behind in object storage
        //  forever, even though their database rows were deleted correctly.
        //
        // Asserting on the resulting prefix (rather than only on the
        //  argument order) keeps this test tied to the behaviour that
        //  actually matters.
        it('should queue an object storage cleanup job for the prefix where the user data really is', async () => {
            // clear out any jobs queued by earlier tests
            await drainPendingJobs();

            const user = await store.storeTemporaryUser(-1000);

            await sessionusers.cleanupExpiredSessionUsers();

            const queued = await drainPendingJobs();

            // deliberately matches the user id in EITHER position, so that
            //  reversed arguments fail on the assertions below - which show
            //  what went where - rather than on "no job found"
            const job = queued.find((candidate) => {
                const spec = candidate.jobdata as ObjectStoreTypes.UserSpec;
                return candidate.jobtype === Objects.PendingJobType.DeleteUserObjectsFromObjectStorage &&
                       (spec.userid === user.id || spec.classid === user.id);
            });
            assert(job, 'expected a job to delete the expired user\'s objects from object storage');

            assert.deepStrictEqual(job.jobdata, {
                classid : sessionusers.CLASS_NAME,
                userid : user.id,
            });

            // the assertion that would have caught the original bug
            assert.strictEqual(
                keys.getUserPrefix(job.jobdata as ObjectStoreTypes.UserSpec),
                sessionusers.CLASS_NAME + '/' + user.id + '/');
        });

    });

});
