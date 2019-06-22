/*eslint-env mocha */
import * as assert from 'assert';

import * as env from '../../lib/utils/env';



describe('Utils - env', () => {

    let oldMysqlHost: string | undefined;
    let oldMysqlUser: string | undefined;

    before(() => {
        oldMysqlHost = process.env.MYSQLHOST;
        oldMysqlUser = process.env.MYSQLUSER;
    });
    after(() => {
        process.env.MYSQLHOST = oldMysqlHost;
        process.env.MYSQLUSER = oldMysqlUser;
    });

    it('should pass if variables are present', () => {
        process.env.MYSQLHOST = 'creds';
        process.env.MYSQLUSER = 'bucket';

        env.confirmRequiredEnvironment();
    });

    it('should fail if variables are missing', (done) => {
        delete process.env.MYSQLUSER;

        try {
            env.confirmRequiredEnvironment();
        }
        catch (err) {
            assert.strictEqual(err.message, 'Missing required environment variable MYSQLUSER');
            done();
        }
    });

});


