import { describe, it, before, beforeEach, after } from 'node:test';
import * as assert from 'assert';
import * as randomstring from 'randomstring';
import * as store from '../../lib/db/store';
import * as constants from '../../lib/utils/constants';


describe('DB store - site alerts', () => {

    before(() => {
        return store.init();
    });
    after(() => {
        return store.disconnect();
    });

    beforeEach(() => {
        return store.testonly_resetSiteAlertsStore();
    });

    describe('getLatestSiteAlert', () => {

        function pause() {
            return new Promise((resolve) => setTimeout(resolve, 1100));
        }

        it('should handle empty site alert stores', async () => {
            const obj = await store.getLatestSiteAlert();
            assert.strictEqual(obj, undefined);
        });

        it('should retrieve a site alert message', async () => {
            const message = randomstring.generate();
            const url = randomstring.generate();
            const expiry = constants.ONE_HOUR;

            await store.storeSiteAlert(message, url, 'public', 'info', expiry);

            const retrieved = await store.getLatestSiteAlert();
            assert(retrieved);
            if (retrieved) {
                assert.strictEqual(retrieved.message, message);
                assert.strictEqual(retrieved.url, url);
                assert.strictEqual(retrieved.severity, 'info');
                assert.strictEqual(retrieved.audience, 'public');
            }
        });

        it('should retrieve a site alert warning', async () => {
            const message = randomstring.generate();
            const url = randomstring.generate();
            const expiry = constants.ONE_HOUR;

            await store.storeSiteAlert(message, url, 'student', 'warning', expiry);

            const retrieved = await store.getLatestSiteAlert();
            assert(retrieved);
            if (retrieved) {
                assert.strictEqual(retrieved.message, message);
                assert.strictEqual(retrieved.url, url);
                assert.strictEqual(retrieved.severity, 'warning');
                assert.strictEqual(retrieved.audience, 'student');
            }
        });

        it('should retrieve a site alert error', async () => {
            const message = randomstring.generate();
            const url = randomstring.generate();
            const expiry = constants.ONE_HOUR;

            await store.storeSiteAlert(message, url, 'supervisor', 'error', expiry);

            const retrieved = await store.getLatestSiteAlert();
            assert(retrieved);
            if (retrieved) {
                assert.strictEqual(retrieved.message, message);
                assert.strictEqual(retrieved.url, url);
                assert.strictEqual(retrieved.severity, 'error');
                assert.strictEqual(retrieved.audience, 'supervisor');
            }
        });

        it('should return the latest alert', async () => {
            const message = randomstring.generate();
            const url = randomstring.generate();
            const expiry = constants.ONE_HOUR;

            await store.storeSiteAlert('first', 'first url', 'supervisor', 'error', 100000);
            await pause();
            await store.storeSiteAlert('second', 'second url', 'public', 'info', 200000);
            await pause();
            await store.storeSiteAlert(message, url, 'public', 'error', expiry);

            const retrieved = await store.getLatestSiteAlert();
            assert(retrieved);
            if (retrieved) {
                assert.strictEqual(retrieved.message, message);
                assert.strictEqual(retrieved.url, url);
                assert.strictEqual(retrieved.severity, 'error');
                assert.strictEqual(retrieved.audience, 'public');
            }
        });
    });

    describe('storeSiteAlert', () => {

        it('should store an error', async () => {
            const message = randomstring.generate();
            const url = randomstring.generate();
            const expiry = constants.ONE_WEEK;

            const before = Date.now();
            const alert = await store.storeSiteAlert(message, url, 'student', 'error', expiry);
            const after = Date.now();

            assert(alert.timestamp);
            assert(alert.timestamp.getTime() >= before);
            assert(alert.timestamp.getTime() <= after);

            assert(alert.expiry.getTime() - constants.ONE_WEEK >= before);
            assert(alert.expiry.getTime() - constants.ONE_WEEK <= after);

            assert.strictEqual(alert.message, message);
            assert.strictEqual(alert.url, url);
            assert.strictEqual(alert.severity, 'error');
            assert.strictEqual(alert.audience, 'student');
        });

        it('should store a warning', async () => {
            const message = randomstring.generate();
            const url = randomstring.generate();
            const expiry = constants.ONE_WEEK;

            const before = Date.now();
            const alert = await store.storeSiteAlert(message, url, 'supervisor', 'warning', expiry);
            const after = Date.now();

            assert(alert.timestamp);
            assert(alert.timestamp.getTime() >= before);
            assert(alert.timestamp.getTime() <= after);

            assert(alert.expiry.getTime() - constants.ONE_WEEK >= before);
            assert(alert.expiry.getTime() - constants.ONE_WEEK <= after);

            assert.strictEqual(alert.message, message);
            assert.strictEqual(alert.url, url);
            assert.strictEqual(alert.severity, 'warning');
            assert.strictEqual(alert.audience, 'supervisor');
        });

        it('should store an info message', async () => {
            const message = randomstring.generate();
            const url = randomstring.generate();
            const expiry = constants.ONE_WEEK;

            const before = Date.now();
            const alert = await store.storeSiteAlert(message, url, 'public', 'info', expiry);
            const after = Date.now();

            assert(alert.timestamp);
            assert(alert.timestamp.getTime() >= before);
            assert(alert.timestamp.getTime() <= after);

            assert(alert.expiry.getTime() - constants.ONE_WEEK >= before);
            assert(alert.expiry.getTime() - constants.ONE_WEEK <= after);

            assert.strictEqual(alert.message, message);
            assert.strictEqual(alert.url, url);
            assert.strictEqual(alert.severity, 'info');
            assert.strictEqual(alert.audience, 'public');
        });

        it('should reject invalid input', async () => {
            await assert.rejects(
                () => store.storeSiteAlert('', '', 'public', 'info', 0),
                { message: 'Missing required attributes' }
            );
        });
    });


});
