/*eslint-env mocha */
import * as assert from 'assert';

import * as env from '../../lib/utils/env';



describe('Utils - env', () => {

    let oldMysqlHost: string | undefined;
    let oldMysqlUser: string | undefined;

    before(() => {
        oldMysqlHost = process.env.POSTGRESQLHOST;
        oldMysqlUser = process.env.POSTGRESQLUSER;
    });
    after(() => {
        process.env.POSTGRESQLHOST = oldMysqlHost;
        process.env.POSTGRESQLUSER = oldMysqlUser;
    });

    it('should pass if variables are present', () => {
        process.env.POSTGRESQLHOST = 'creds';
        process.env.POSTGRESQLUSER = 'bucket';

        env.confirmRequiredEnvironment();
    });

    it('should fail if variables are missing', (done) => {
        delete process.env.POSTGRESQLUSER;

        try {
            env.confirmRequiredEnvironment();
        }
        catch (err) {
            assert.strictEqual(err.message, 'Missing required environment variable POSTGRESQLUSER');
            done();
        }
    });

});


