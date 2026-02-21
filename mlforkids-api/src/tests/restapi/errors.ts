import { describe, it } from 'node:test';
import * as assert from 'assert';
import * as Express from 'express';

import * as errors from '../../lib/restapi/errors';


describe('REST API - Error Handling', () => {


    function validate(expectedStatusCode: number, expectedPayload: object, callback: () => void): Express.Response {
        const res = {
            status : (code) => {
                assert.strictEqual(code, expectedStatusCode);
                return {
                    json : (obj) => {
                        assert.deepStrictEqual(obj, expectedPayload);
                        callback();
                    },
                };
            },
        } as Express.Response;
        return res;
    }



    describe('Internal Server Errors', () => {

        it('DB errors', async () => {
            await new Promise<void>((resolve) => {
                const validator = validate(
                    500,
                    {
                        error : 'Error accessing the database used to store data',
                        detail : {
                            code : 1234,
                            errno : '9876',
                            sqlState : 'something',
                            message : 'DB go boom',
                        },
                    },
                    resolve);

                const testError: any = new Error('DB go boom');
                testError.code = 1234;
                testError.errno = '9876';
                testError.sqlState = 'something';

                errors.unknownError(validator, testError);
            });
        });

        it('Bluemix errors', async () => {
            await new Promise<void>((resolve) => {
                const validator = validate(
                    500,
                    {
                        error : 'Something about Watson',
                    },
                    resolve);

                const testError: any = new Error('Something about Watson');

                errors.unknownError(validator, testError);
            });
        });

        it('Empty errors', async () => {
            await new Promise<void>((resolve) => {
                const validator = validate(500, { error : 'Unknown error' }, resolve);
                errors.unknownError(validator, {});
            });
        });

        it('Undefined errors', async () => {
            await new Promise<void>((resolve) => {
                const validator = validate(500, { error : 'Unknown error' }, resolve);
                errors.unknownError(validator, null);
            });
        });

    });

});
