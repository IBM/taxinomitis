/*eslint-env mocha */
import * as assert from 'assert';
import * as randomstring from 'randomstring';
import { v4 as uuid } from 'uuid';

import * as store from '../../lib/db/store';
import * as dbObjects from '../../lib/db/objects';
import * as DbTypes from '../../lib/db/db-types';



describe('DB credentials pool store', () => {

    before(() => {
        return store.init();
    });
    after(() => {
        return store.disconnect();
    });


    describe('Bluemix credentials', () => {

        it('should retrieve a pooled credential', async () => {
            const creds = await store.getBluemixCredentialsById(DbTypes.ClassTenantType.ManagedPool, '69cc9432-1ef8-460c-a2c0-ca1f0b7e5e61');
            assert.deepStrictEqual(creds, {
                id: '69cc9432-1ef8-460c-a2c0-ca1f0b7e5e61',
                servicetype: 'conv',
                url: 'https://gateway.watsonplatform.net/conversation/api',
                username: '33333333-1111-2222-3333-444444444444',
                password: '56789abcdef0',
                classid: 'managedpooluse',
                credstype: 'unknown',
                lastfail: new Date('2020-01-01T00:00:00.000Z'),
            });
        });

        it('should not retrieve pooled credentials for unmanaged classes', async () => {
            try {
                await store.getBluemixCredentialsById(DbTypes.ClassTenantType.UnManaged, '69cc9432-1ef8-460c-a2c0-ca1f0b7e5e61');
                assert.fail('should not have found this');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Unexpected response when retrieving the service credentials');
            }
        });

        it('should retrieved pooled credentials if source is unknown', async () => {
            const creds = await store.getCombinedBluemixCredentialsById('69cc9432-1ef8-460c-a2c0-ca1f0b7e5e61');
            assert.deepStrictEqual(creds, {
                id: '69cc9432-1ef8-460c-a2c0-ca1f0b7e5e61',
                servicetype: 'conv',
                url: 'https://gateway.watsonplatform.net/conversation/api',
                username: '33333333-1111-2222-3333-444444444444',
                password: '56789abcdef0',
                classid: 'managedpooluse',
                credstype: 'unknown',
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
                id: '69cc9432-1ef8-460c-a2c0-ca1f0b7e5e61',
                servicetype: 'conv',
                url: 'https://gateway.watsonplatform.net/conversation/api',
                username: '33333333-1111-2222-3333-444444444444',
                password: '56789abcdef0',
                classid: 'managedpooluse',
                credstypeid: 0,
            });

            const retrieved = await store.getCombinedBluemixCredentialsById('69cc9432-1ef8-460c-a2c0-ca1f0b7e5e61');
            assert.deepStrictEqual(retrieved, {
                id: '69cc9432-1ef8-460c-a2c0-ca1f0b7e5e61',
                servicetype: 'conv',
                url: 'https://gateway.watsonplatform.net/conversation/api',
                username: '33333333-1111-2222-3333-444444444444',
                password: '56789abcdef0',
                classid: 'duplicate',
                credstype: 'unknown',
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
