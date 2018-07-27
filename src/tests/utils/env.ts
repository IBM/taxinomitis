/*eslint-env mocha */
import * as assert from 'assert';

import * as env from '../../lib/utils/env';



describe('Utils - env', () => {

    let oldEnvCreds: string | undefined;
    let oldEnvBucket: string | undefined;

    before(() => {
        oldEnvCreds = process.env.OBJECT_STORE_CREDS;
        oldEnvBucket = process.env.OBJECT_STORE_BUCKET;
    });
    after(() => {
        process.env.OBJECT_STORE_CREDS = oldEnvCreds;
        process.env.OBJECT_STORE_BUCKET = oldEnvBucket;
    });

    it('should pass if variables are present', () => {
        process.env.OBJECT_STORE_CREDS = 'creds';
        process.env.OBJECT_STORE_BUCKET = 'bucket';

        env.confirmRequiredEnvironment();
    });

    it('should fail if variables are missing', (done) => {
        delete process.env.OBJECT_STORE_BUCKET;

        try {
            env.confirmRequiredEnvironment();
        }
        catch (err) {
            assert.strictEqual(err.message, 'Missing required environment variable OBJECT_STORE_BUCKET');
            done();
        }
    });

});


