/*eslint-env mocha */
import * as assert from 'assert';
import * as randomstring from 'randomstring';
import { v4 as uuid } from 'uuid';

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
                lastfail: (creds as TrainingTypes.BluemixCredentialsPool).lastfail,
            });
            assert((creds as TrainingTypes.BluemixCredentialsPool).lastfail.getTime() >= beforeTime.getTime());
        });

        it('should not retrieve pooled credentials for unmanaged classes', async () => {
            try {
                await store.getBluemixCredentialsById(DbTypes.ClassTenantType.UnManaged, credsId);
                assert.fail('should not have found this');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Unexpected response when retrieving the service credentials');
            }
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
            });
        });

        it('should handle requests for unknown pooled credentials', async () => {
            try {
                await store.getBluemixCredentialsById(DbTypes.ClassTenantType.ManagedPool, 'does not actually exist');
                assert.fail('should not have found this');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Unexpected response when retrieving service credentials');
            }
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
            });

            await store.deleteBluemixCredentials(duplicate.id);
        });

        it('should handle requests to delete unknown pool credentials', () => {
            return store.deleteBluemixCredentialsPool(uuid());
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

            try {
                await store.getBluemixCredentialsById(DbTypes.ClassTenantType.ManagedPool, newPoolCreds.id);
                assert.fail('should not have found a deleted creds item');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Unexpected response when retrieving service credentials');
            }
        });
    });
});
