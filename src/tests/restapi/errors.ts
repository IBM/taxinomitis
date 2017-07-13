/*eslint-env mocha */
import * as assert from 'assert';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as Express from 'express';

import * as errors from '../../lib/restapi/errors';

import testserverapi from './testserver';

const testServer = testserverapi();



describe('REST API - Error Handling', () => {


    function validate(expectedStatusCode, expectedPayload, callback): Express.Response {
        const res = {
            status : (code) => {
                assert.equal(code, expectedStatusCode);
                return {
                    json : (obj) => {
                        assert.deepEqual(obj, expectedPayload);
                        callback();
                    },
                };
            },
        } as Express.Response;
        return res;
    }



    describe('Internal Server Errors', () => {

        it('DB errors', (done) => {
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
                done);

            const testError: any = new Error('DB go boom');
            testError.code = 1234;
            testError.errno = '9876';
            testError.sqlState = 'something';

            errors.unknownError(validator, testError);
        });

        it('Bluemix errors', (done) => {
            const validator = validate(
                500,
                {
                    error : 'Something about Watson',
                },
                done);

            const testError: any = new Error('Something about Watson');

            errors.unknownError(validator, testError);
        });

        it('Empty errors', (done) => {
            const validator = validate(500, { error : 'Unknown error' }, done);
            errors.unknownError(validator, {});
        });

        it('Undefined errors', (done) => {
            const validator = validate(500, { error : 'Unknown error' }, done);
            errors.unknownError(validator, null);
        });

    });

});
