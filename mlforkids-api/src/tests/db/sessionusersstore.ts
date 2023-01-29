/*eslint-env mocha */
import * as assert from 'assert';

import * as store from '../../lib/db/store';
import * as Objects from '../../lib/db/db-types';



describe('temporary users store', () => {

    const ONE_SECOND = 1000;
    const FIVE_SECONDS = 5000;
    const ONE_MINUTE = 60 * 1000;


    before(() => {
        return store.init();
    });

    after(async () => {
        return store.disconnect();
    });


    async function wait(seconds: number): Promise<{}> {
        return new Promise((resolve) => {
            setTimeout(() => resolve({}), (seconds * ONE_SECOND));
        });
    }


    describe('storeTemporaryUser', () => {

        it('should create users', async () => {
            const before = new Date();
            const after = new Date(before.getTime() + ONE_MINUTE);

            const user = await store.storeTemporaryUser(FIVE_SECONDS);
            assert(user.id);
            assert(user.token);
            assert(user.sessionExpiry);
            assert(user.sessionExpiry instanceof Date);
            assert(user.sessionExpiry > before);
            assert(user.sessionExpiry < after);

            await store.deleteTemporaryUser(user);
        });

    });



    describe('getTemporaryUser', () => {

        it('should retrieve session users by ID', async () => {
            const user = await store.storeTemporaryUser(FIVE_SECONDS);
            const retrieved = await store.getTemporaryUser(user.id);
            assert.deepStrictEqual(user, retrieved);

            await store.deleteTemporaryUser(user);
        });

        it('should handle retrieving non-existing users', async () => {
            const user = await store.getTemporaryUser('DOES-NOT-EXIST');
            assert(!user);
        });

    });



    describe('deleteTemporaryUser', () => {

        it('should delete a session user', async () => {
            const user = await store.storeTemporaryUser(FIVE_SECONDS);
            const retrieved = await store.getTemporaryUser(user.id);
            assert(retrieved);

            await store.deleteTemporaryUser(user);
            const verifyDelete = await store.getTemporaryUser(user.id);
            assert(!verifyDelete);
        });

        it('should handle deleting non-existing users', async () => {
            try {
                await store.deleteTemporaryUser({
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



    describe('countTemporaryUsers', () => {

        it('should count the users', async () => {
            const before = await store.countTemporaryUsers();
            const user = await store.storeTemporaryUser(FIVE_SECONDS);
            const after = await store.countTemporaryUsers();
            await store.deleteTemporaryUser(user);
            assert.strictEqual(after, before + 1);
        });

    });



    describe('getExpiredTemporaryUsers', () => {

        it('should fetch expired users', async () => {
            const before = await store.getExpiredTemporaryUsers();

            const test = await store.storeTemporaryUser(ONE_SECOND);
            await wait(2);

            const expired = await store.getExpiredTemporaryUsers();
            assert(Array.isArray(expired));
            assert(expired.length > 0);
            assert.strictEqual(expired.length, before.length + 1);
            assert(expired.some((user) => {
                return user.id === test.id &&
                       user.token === test.token &&
                       user.sessionExpiry.getTime() === test.sessionExpiry.getTime();
            }));

            await store.deleteTemporaryUser(test);
        });
    });


    describe('bulkDeleteTemporaryUsers', () => {

        async function shouldExist(users: Objects.TemporaryUser[]) {
            for (const user of users) {
                const verify = await store.getTemporaryUser(user.id);
                assert(verify);
                assert.deepStrictEqual(verify, user);
            }
        }
        async function shouldNotExist(users: Objects.TemporaryUser[]) {
            for (const user of users) {
                const verify = await store.getTemporaryUser(user.id);
                assert(!verify);
            }
        }

        it('delete multiple users', async () => {
            const userA = await store.storeTemporaryUser(ONE_SECOND);
            const userB = await store.storeTemporaryUser(ONE_SECOND);
            const userC = await store.storeTemporaryUser(ONE_SECOND);
            const userD = await store.storeTemporaryUser(ONE_SECOND);
            const userE = await store.storeTemporaryUser(ONE_SECOND);
            const userF = await store.storeTemporaryUser(ONE_SECOND);

            await shouldExist([userA, userB, userC, userD, userE, userF]);

            await store.bulkDeleteTemporaryUsers([ userB, userD, userE ]);

            await shouldExist([userA, userC, userF]);
            await shouldNotExist([userB, userD, userE]);

            await store.bulkDeleteTemporaryUsers([ userA, userC ]);

            await shouldExist([ userF ]);
            await shouldNotExist([userA, userB, userC, userD, userE ]);

            await store.deleteTemporaryUser(userF);
        });

    });

});
