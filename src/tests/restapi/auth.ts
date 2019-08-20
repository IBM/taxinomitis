/*eslint-env mocha */
import * as assert from 'assert';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as Express from 'express';

import * as auth from '../../lib/restapi/auth';

import testserverapi from './testserver';

const testServer = testserverapi();



describe('REST API - Auth', () => {

    describe('auth middleware', () => {

        it('checkValidUser - need a user', (done) => {
            const req = {} as Express.Request;
            const res = {
                status : (code) => {
                    assert.strictEqual(code, 401);
                    return {
                        json : (obj) => {
                            assert.deepStrictEqual(obj, { error : 'Not authorised' });
                            done();
                        },
                    };
                },
            } as Express.Response;

            auth.checkValidUser(req, res, () => {
                // not used
            });
        });

        // it('checkValidUser - need user metadata', (done) => {
        //     const req = {
        //         user : {
        //             name : 'unauthorized bob',
        //         },
        //     } as Express.Request;
        //     const res = {
        //         status : (code) => {
        //             assert.strictEqual(code, 401);
        //             return {
        //                 json : (obj) => {
        //                     assert.deepStrictEqual(obj, { error : 'Not authorised' });
        //                     done();
        //                 },
        //             };
        //         },
        //     } as Express.Response;

        //     auth.checkValidUser(req, res, () => {
        //         // not used
        //     });
        // });

        it('checkValidUser - need the right tenant', (done) => {
            const reqValues = {
                params : {
                    classid : 'REQUESTEDTENANT',
                },
                user : {
                    app_metadata : {
                        tenant : 'USERSTENANT',
                    },
                },
            } as unknown;
            const req = reqValues as Express.Request;
            const res = {
                status : (code) => {
                    assert.strictEqual(code, 403);
                    return {
                        json : (obj) => {
                            assert.deepStrictEqual(obj, { error : 'Invalid access' });
                            done();
                        },
                    };
                },
            } as Express.Response;

            auth.checkValidUser(req, res, () => {
                // not used
            });
        });

        it('checkValidUser - valid user', (done) => {
            const reqValues = {
                params : {
                    classid : 'USERSTENANT',
                },
                user : {
                    app_metadata : {
                        tenant : 'USERSTENANT',
                    },
                },
            } as unknown;
            const req = reqValues as Express.Request;
            const resp = {

            } as Express.Response;

            auth.checkValidUser(req, resp,
                () => {
                    done();
                });
        });



        it('requireSupervisor - need the right role', (done) => {
            const reqValues = {
                params : {
                    classid : 'USERSTENANT',
                },
                user : {
                    app_metadata : {
                        tenant : 'USERSTENANT',
                        role : 'student',
                    },
                },
            } as unknown;
            const req = reqValues as Express.Request;
            const res = {
                status : (code) => {
                    assert.strictEqual(code, 403);
                    return {
                        json : (obj) => {
                            assert.deepStrictEqual(obj, { error : 'Only supervisors are allowed to invoke this' });
                            done();
                        },
                    };
                },
            } as Express.Response;

            auth.requireSupervisor(req, res, () => {
                // not used
            });
        });


        it('requireSupervisor - valid supervisor', (done) => {
            const reqValues = {
                params : {
                    classid : 'USERSTENANT',
                },
                user : {
                    app_metadata : {
                        tenant : 'USERSTENANT',
                        role : 'supervisor',
                    },
                },
            } as unknown;
            const req = reqValues as Express.Request;
            const res = {

            } as Express.Response;

            auth.requireSupervisor(req, res, () => {
                done();
            });
        });


        it('verifyProjectAccess - default to reject if no DB', (done) => {
            const req = {
                params : {
                    studentid : 'bob',
                    classid : 'test',
                    projectid : 'tutorial',
                },
            } as unknown as Express.Request;
            const res = {
            } as Express.Response;

            auth.verifyProjectAccess(req, res, (err) => {
                assert(err);
                done();
            });
        });
    });

    describe('getStudents()', () => {

        it('should require auth', () => {
            return request(testServer)
                .get('/api/classes/testclassid/students')
                .expect('Content-Type', /json/)
                .expect(httpstatus.UNAUTHORIZED)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Not authorised' });
                });
        });

    });


    describe('createStudent()', () => {

        it('should require auth', () => {
            return request(testServer)
                .post('/api/classes/testclassid/students')
                .send({})
                .expect('Content-Type', /json/)
                .expect(httpstatus.UNAUTHORIZED)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Not authorised' });
                });
        });

    });
});
