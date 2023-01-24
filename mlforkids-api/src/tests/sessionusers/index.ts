/*eslint-env mocha */
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as store from '../../lib/db/store';
import * as Objects from '../../lib/db/db-types';
import * as sessionusers from '../../lib/sessionusers';




describe('session users', () => {

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

        return store.disconnect();
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

            const TEST_CLASS_LIMIT = 3200;

            const setupPromises: Promise<Objects.TemporaryUser>[] = [];
            for (let i = 0; i < TEST_CLASS_LIMIT; i++) {
                setupPromises.push(sessionusers.createSessionUser());
            }

            const fillers: Objects.TemporaryUser[] = await Promise.all(setupPromises);

            try {
                await sessionusers.createSessionUser();
                assert.fail('should not get here');
            }
            catch (e) {
                assert.strictEqual(e.message, sessionusers.ERROR_MESSAGES.CLASS_FULL);

                await store.bulkDeleteTemporaryUsers(fillers);
            }
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
            try {
                await sessionusers.deleteSessionUser({
                    id : 'DOES-NOT-EXIST',
                    token : 'DOES-NOT-EXIST',
                    sessionExpiry : new Date(),
                });
            }
            catch (err) {
                assert.strictEqual(err.message, 'Failed to delete temporary user');
            }
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

    });

});
