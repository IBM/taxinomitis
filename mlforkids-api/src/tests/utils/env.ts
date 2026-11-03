import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';

import * as env from '../../lib/utils/env';



describe('Utils - env', () => {

    let oldDBHost: string | undefined;
    let oldDBPort: string | undefined;
    let oldDBUser: string | undefined;
    let oldDBDatabase: string | undefined;

    before(() => {
        oldDBHost = process.env.POSTGRESQLHOST;
        oldDBPort = process.env.POSTGRESQLPORT;
        oldDBUser = process.env.POSTGRESQLUSER;
        oldDBDatabase = process.env.POSTGRESQLDATABASE;
    });
    after(() => {
        process.env.POSTGRESQLHOST = oldDBHost;
        process.env.POSTGRESQLPORT = oldDBPort;
        process.env.POSTGRESQLUSER = oldDBUser;
        process.env.POSTGRESQLDATABASE = oldDBDatabase;
    });

    it('should pass if variables are present', () => {
        process.env.POSTGRESQLHOST = 'localhost';
        process.env.POSTGRESQLPORT = '5432';
        process.env.POSTGRESQLUSER = 'postgres';
        process.env.POSTGRESQLDATABASE = 'mlforkids';

        env.confirmRequiredEnvironment();
    });

    it('should fail if variables are missing', () => {
        process.env.POSTGRESQLHOST = 'localhost';
        process.env.POSTGRESQLPORT = '5432';
        delete process.env.POSTGRESQLUSER;
        process.env.POSTGRESQLDATABASE = 'mlforkids';

        assert.throws(
            () => env.confirmRequiredEnvironment(),
            { message: 'Missing required environment variable POSTGRESQLUSER' }
        );
    });

    describe('isTextServiceConfigured', () => {
        const NAMES = [ env.TEXT_SERVICE, env.TEXT_SERVICE_USER, env.TEXT_SERVICE_PASS ];
        const saved: { [name: string]: string | undefined } = {};

        before(() => {
            NAMES.forEach((name) => { saved[name] = process.env[name]; });
        });
        after(() => {
            NAMES.forEach((name) => {
                if (saved[name] === undefined) {
                    delete process.env[name];
                }
                else {
                    process.env[name] = saved[name];
                }
            });
        });

        function setAll() {
            process.env[env.TEXT_SERVICE] = 'http://localhost:8020';
            process.env[env.TEXT_SERVICE_USER] = 'user';
            process.env[env.TEXT_SERVICE_PASS] = 'pass';
        }

        it('should be configured when all three variables are set', () => {
            setAll();
            assert.strictEqual(env.isTextServiceConfigured(), true);
        });

        for (const missing of NAMES) {
            it('should not be configured without ' + missing, () => {
                setAll();
                delete process.env[missing];
                assert.strictEqual(env.isTextServiceConfigured(), false);
            });
            it('should not be configured with an empty ' + missing, () => {
                setAll();
                process.env[missing] = '';
                assert.strictEqual(env.isTextServiceConfigured(), false);
            });
        }
    });

});
