import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';

import * as env from '../../lib/utils/env';



describe('Utils - env', () => {

    let oldDBHost: string | undefined;
    let oldDBUser: string | undefined;

    before(() => {
        oldDBHost = process.env.POSTGRESQLHOST;
        oldDBUser = process.env.POSTGRESQLUSER;
    });
    after(() => {
        process.env.POSTGRESQLHOST = oldDBHost;
        process.env.POSTGRESQLUSER = oldDBUser;
    });

    it('should pass if variables are present', () => {
        process.env.POSTGRESQLHOST = 'creds';
        process.env.POSTGRESQLUSER = 'bucket';

        env.confirmRequiredEnvironment();
    });

    it('should fail if variables are missing', () => {
        delete process.env.POSTGRESQLUSER;

        assert.throws(
            () => env.confirmRequiredEnvironment(),
            { message: 'Missing required environment variable POSTGRESQLUSER' }
        );
    });

});


