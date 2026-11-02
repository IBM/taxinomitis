import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import * as randomstring from 'randomstring';
import { randomUUID } from 'node:crypto';

import * as store from '../../lib/db/store';
import * as dbObjects from '../../lib/db/objects';
import * as DbTypes from '../../lib/db/db-types';
import * as TrainingTypes from '../../lib/training/training-types';



describe('DB credentials pool store', () => {

    let credsId: string;
    const credsSvc = 'conv';
    const credsApi = undefined;
    const credsUser = '33333333-1111-2222-3333-444444444444';
    const credsPass = '56789abcdef0';
    const credsType = 'conv_lite';
    const credsNote = 'test creds';
    const beforeTime = new Date();
    beforeTime.setMilliseconds(0);

    before(() => {
        return store.init()
            .then(() => {
                const creds = dbObjects.createBluemixCredentialsPool(credsSvc, credsApi,
                    credsUser, credsPass, credsType);
                creds.notes = credsNote;
                credsId = creds.id;

                return store.storeBluemixCredentialsPool(dbObjects.getCredentialsPoolAsDbRow(creds));
            });
    });
    after(() => {
        return store.deleteBluemixCredentialsPool(credsId)
            .then(() => {
                return store.disconnect();
            });
    });


    describe('Bluemix credentials', () => {

        it('should retrieve a pooled credential', async () => {
            const creds = await store.getBluemixCredentialsById(DbTypes.ClassTenantType.ManagedPool, credsId);
            assert.deepStrictEqual(creds, {
                id: credsId,
                servicetype: credsSvc,
                url: 'https://gateway.watsonplatform.net/conversation/api',
                username: credsUser,
                password: credsPass,
                classid: 'managedpooluse',
                credstype: credsType,
                source: 'managed-pool',
                lastfail: (creds as TrainingTypes.BluemixCredentialsPool).lastfail,
            });
            assert((creds as TrainingTypes.BluemixCredentialsPool).lastfail.getTime() >= beforeTime.getTime());
        });

        it('should not retrieve pooled credentials for unmanaged classes', async () => {
            await assert.rejects(
                () => store.getBluemixCredentialsById(DbTypes.ClassTenantType.UnManaged, credsId),
                { message: 'Unexpected response when retrieving the service credentials' }
            );
        });

        it('should retrieved pooled credentials if source is unknown', async () => {
            const creds = await store.getCombinedBluemixCredentialsById(credsId);
            assert.deepStrictEqual(creds, {
                id: credsId,
                servicetype: credsSvc,
                url: 'https://gateway.watsonplatform.net/conversation/api',
                username: credsUser,
                password: credsPass,
                classid: 'managedpooluse',
                credstype: credsType,
                source: 'managed-pool',
                lastfail: (creds as TrainingTypes.BluemixCredentialsPool).lastfail,
            });
            assert((creds as TrainingTypes.BluemixCredentialsPool).lastfail.getTime() >= beforeTime.getTime());
            assert(dbObjects.isPoolCredentials(creds));
        });

        it('should handle requests for unknown pooled credentials', async () => {
            await assert.rejects(
                () => store.getBluemixCredentialsById(DbTypes.ClassTenantType.ManagedPool, 'does not actually exist'),
                { message: 'Unexpected response when retrieving service credentials' }
            );
        });

        it('should recognize credentials stored in both stores', async () => {
            const duplicate = await store.storeBluemixCredentials('duplicate', {
                id: credsId,
                servicetype: credsSvc,
                url: 'https://gateway.watsonplatform.net/conversation/api',
                username: credsUser,
                password: credsPass,
                classid: 'managedpooluse',
                credstypeid: 1,
            });

            const retrieved = await store.getCombinedBluemixCredentialsById(credsId);
            assert.deepStrictEqual(retrieved, {
                id: credsId,
                servicetype: credsSvc,
                url: 'https://gateway.watsonplatform.net/conversation/api',
                username: credsUser,
                password: credsPass,
                classid: 'duplicate',
                credstype: credsType,
                source: 'class',
            });
            assert.strictEqual(dbObjects.isPoolCredentials(retrieved), false);

            await store.deleteBluemixCredentials(duplicate.id);
        });

        it('should only retrieve credentials from the requested pool', async () => {
            // a pool id that isn't used, so the test can't affect a real pool
            const OTHER_POOL = 99;

            const otherPoolCreds = dbObjects.createBluemixCredentialsPool('conv', undefined,
                randomstring.generate(36),
                randomstring.generate(12),
                'conv_lite');
            otherPoolCreds.notes = 'temporary test record';

            try {
                // the other pool isn't a known pool, so the stored row can't be returned
                await assert.rejects(
                    () => store.storeBluemixCredentialsPool({
                        ...dbObjects.getCredentialsPoolAsDbRow(otherPoolCreds),
                        poolid : OTHER_POOL,
                    }),
                    { message: 'Unrecognised credentials pool' });

                const managed = await store.getBluemixCredentialsPoolBatch('managed-pool', 'conv');
                const managedIds = managed.map((creds) => creds.id);
                assert(managedIds.includes(credsId));
                assert(!managedIds.includes(otherPoolCreds.id));

                // the other pool isn't a known pool, so its credentials can't be read
                await assert.rejects(
                    () => store.getCombinedBluemixCredentialsById(otherPoolCreds.id),
                    { message: 'Unrecognised credentials pool' });
            }
            finally {
                await store.deleteBluemixCredentialsPool(otherPoolCreds.id);
            }
        });

        it('should handle requests to delete unknown pool credentials', () => {
            return store.deleteBluemixCredentialsPool(randomUUID());
        });

        it('should delete pooled credentials', async () => {
            const newPoolCredsDef = dbObjects.createBluemixCredentialsPool('conv', undefined,
                randomstring.generate(36),
                randomstring.generate(12),
                'conv_lite');
            newPoolCredsDef.notes = 'temporary test record';
            const newPoolCredsDefDbRow = dbObjects.getCredentialsPoolAsDbRow(newPoolCredsDef);
            const newPoolCreds = await store.storeBluemixCredentialsPool(newPoolCredsDefDbRow);

            const retrieved = await store.getBluemixCredentialsById(DbTypes.ClassTenantType.ManagedPool, newPoolCreds.id);
            assert.strictEqual(retrieved.username, newPoolCredsDef.username);
            assert.strictEqual(retrieved.password, newPoolCredsDef.password);

            await store.deleteBluemixCredentialsPool(newPoolCreds.id);

            await assert.rejects(
                () => store.getBluemixCredentialsById(DbTypes.ClassTenantType.ManagedPool, newPoolCreds.id),
                { message: 'Unexpected response when retrieving service credentials' }
            );
        });
    });
});
