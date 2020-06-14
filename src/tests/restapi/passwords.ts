/*eslint-env mocha */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as express from 'express';
import * as auth from '../../lib/restapi/auth';

import testapiserver from './testserver';

let testServer: express.Express;


describe('REST API - users', () => {

    let authStub: sinon.SinonStub<any, any>;

    const AUTH_USERS = {
        STUDENT : {
            'https://machinelearningforkids.co.uk/api/role' : 'student',
            'https://machinelearningforkids.co.uk/api/tenant' : 'CLASSID',
        },
        TEACHER : {
            'https://machinelearningforkids.co.uk/api/role' : 'supervisor',
            'https://machinelearningforkids.co.uk/api/tenant' : 'CLASSID',
        },
        OTHERCLASS : {
            'https://machinelearningforkids.co.uk/api/role' : 'supervisor',
            'https://machinelearningforkids.co.uk/api/tenant' : 'DIFFERENT',
        },
    };

    let nextUser = AUTH_USERS.STUDENT;

    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        // @ts-ignore
        req.user = { ...nextUser };
        next();
    }


    before(() => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);

        testServer = testapiserver();
    });

    after(() => {
        authStub.restore();
    });



    describe('generatePassword()', () => {

        it('should check the class matches', () => {
            nextUser = AUTH_USERS.OTHERCLASS;

            return request(testServer)
                .get('/api/classes/CLASSID/passwords')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN)
                .then((res) => {
                    assert.deepStrictEqual(res.body, {
                        error : 'Invalid access',
                    });
                });
        });

        it('should reject requests from students', () => {
            nextUser = AUTH_USERS.STUDENT;

            return request(testServer)
                .get('/api/classes/CLASSID/passwords')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN)
                .then((res) => {
                    assert.deepStrictEqual(res.body, {
                        error : 'Only supervisors are allowed to invoke this',
                    });
                });
        });

        it('should return a password', () => {
            nextUser = AUTH_USERS.TEACHER;

            return request(testServer)
                .get('/api/classes/CLASSID/passwords')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    assert(res.body.password);
                    assert.strictEqual(typeof res.body.password, 'string');
                    assert(res.body.password.length > 8);
                });
        });

        it('should return unique passwords', async () => {
            nextUser = AUTH_USERS.TEACHER;

            const passwords: string[] = [];

            for (let i = 0; i < 100; i++) {
                const res = await request(testServer)
                                .get('/api/classes/CLASSID/passwords')
                                .expect('Content-Type', /json/)
                                .expect(httpstatus.OK);

                assert.strictEqual(passwords.includes(res.body.password), false);
                passwords.push(res.body.password);
            }
        });
    });
});
