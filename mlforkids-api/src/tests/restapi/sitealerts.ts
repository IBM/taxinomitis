/*eslint-env mocha */
import { v1 as uuid } from 'uuid';
import * as assert from 'assert';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as sinon from 'sinon';
import * as express from 'express';

import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import * as sitealerts from '../../lib/sitealerts';
import testapiserver from './testserver';



let testServer: express.Express;


describe('REST API - site alerts', () => {

    before(async () => {
        await store.init();
    });

    after(() => {
        return store.disconnect();
    });

    beforeEach(() => {
        return new Promise((resolve) => setTimeout(resolve, 1000));
    });



    describe('unauthenticated', () => {

        before(async () => {
            testServer = testapiserver();
        });

        it('should allow unauthenticated users to fetch public messages', () => {
            return store.storeSiteAlert('my public message', 'http://web.com', 'public', 'info', 5000)
                .then(() => {
                    return sitealerts.refreshCache();
                })
                .then(() => {
                    return request(testServer)
                        .get('/api/sitealerts/public')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    assert.strictEqual(res.header['cache-control'], 'max-age=60');

                    const body = res.body;
                    assert.strictEqual(body[0].message, 'my public message');
                    assert.strictEqual(body[0].url, 'http://web.com');
                });
        });

        it('should not allow unauthenticated users to fetch student messages', () => {
            return store.storeSiteAlert('my student message', 'http://web.com', 'student', 'warning', 5000)
                .then(() => {
                    return sitealerts.refreshCache();
                })
                .then(() => {
                    return request(testServer)
                        .get('/api/sitealerts/public')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, []);
                });
        });

        it('should not allow unauthenticated users to create alerts', () => {
            return request(testServer)
                    .post('/api/sitealerts')
                    .send({
                        message : 'Please reject this',
                        url : 'http://website.com',
                        expiry : 15000,
                        audience : 'student',
                        severity : 'info',
                    })
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.UNAUTHORIZED)
                    .then((res) => {
                        const body = res.body;
                        assert.deepStrictEqual(body, { error : 'Not authorised' });
                    });
        });

        it('should not allow unauthenticated users to fetch student alerts', () => {
            return request(testServer)
                .get('/api/sitealerts/alerts/UNKNOWNCLASSID/students/UNKNOWNSTUDENTID')
                .expect('Content-Type', /json/)
                .expect(httpstatus.UNAUTHORIZED)
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, { error : 'Not authorised' });
                });
        });

        it('should not allow unauthenticated users to fetch student alerts', () => {
            return request(testServer)
                .get('/api/sitealerts/alerts/UNKNOWNCLASSID/supervisors/UNKNOWNUSERID')
                .expect('Content-Type', /json/)
                .expect(httpstatus.UNAUTHORIZED)
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, { error : 'Not authorised' });
                });
        });
    });



    describe('authenticated', () => {

        let authStub: sinon.SinonStub<any, any>;

        const CLASSID = uuid();


        const AUTH_USERS = {
            STUDENT : {
                'sub' : uuid(),
                'https://machinelearningforkids.co.uk/api/role' : 'student',
                'https://machinelearningforkids.co.uk/api/tenant' : CLASSID,
            },
            TEACHER : {
                'sub' : uuid(),
                'https://machinelearningforkids.co.uk/api/role' : 'supervisor',
                'https://machinelearningforkids.co.uk/api/tenant' : CLASSID,
            },
            SITEADMIN : {
                'sub' : uuid(),
                'https://machinelearningforkids.co.uk/api/role' : 'siteadmin',
            },
        };

        let nextUser = AUTH_USERS.SITEADMIN;

        function authNoOp(
            req: Express.Request, res: Express.Response,
            next: (err?: Error) => void)
        {
            // @ts-ignore
            req.user = { ...nextUser };
            next();
        }


        before(async () => {
            authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
            testServer = testapiserver();
        });

        after(() => {
            authStub.restore();
        });


        describe('expired alerts', () => {

            const message = 'I will expire after 1 second';
            const url = 'http://super-short-lived.com';

            it('should not fetched an expired alert', () => {
                nextUser = AUTH_USERS.STUDENT;
                return store.storeSiteAlert(message, url, 'student', 'error', 1000)
                    .then(() => {
                        return sitealerts.refreshCache();
                    })
                    .then(() => {
                        return request(testServer)
                            .get('/api/sitealerts/alerts/' + CLASSID + '/students/' + AUTH_USERS.STUDENT.sub)
                            .expect('Content-Type', /json/)
                            .expect(httpstatus.OK);
                    })
                    .then((res) => {
                        const body = res.body;
                        assert.strictEqual(body[0].message, message);
                        assert.strictEqual(body[0].url, url);
                        return new Promise((resolve) => {
                            setTimeout(resolve, 1500);
                        });
                    })
                    .then(() => {
                        return request(testServer)
                            .get('/api/sitealerts/alerts/' + CLASSID + '/students/' + AUTH_USERS.STUDENT.sub)
                            .expect('Content-Type', /json/)
                            .expect(httpstatus.OK);
                    })
                    .then((res) => {
                        const body = res.body;
                        assert.deepStrictEqual(body, []);
                    });
            });

        });


        describe('fetching public alerts', () => {
            const message = 'I am a public message';
            const url = 'http://webaddress.com/public';

            before(() => {
                return store.storeSiteAlert(message, url, 'public', 'info', 15000)
                    .then(() => {
                        return sitealerts.refreshCache();
                    });
            });

            it('should allow students to get public messages', () => {
                nextUser = AUTH_USERS.STUDENT;
                return request(testServer)
                    .get('/api/sitealerts/alerts/' + CLASSID + '/students/' + AUTH_USERS.STUDENT.sub)
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.OK)
                    .then((res) => {
                        assert.strictEqual(res.header['cache-control'], 'max-age=60');

                        const body = res.body;
                        assert.strictEqual(body[0].message, message);
                        assert.strictEqual(body[0].url, url);
                    });
            });

            it('should allow teachers to get public messages', () => {
                nextUser = AUTH_USERS.TEACHER;
                return request(testServer)
                    .get('/api/sitealerts/alerts/' + CLASSID + '/supervisors/' + AUTH_USERS.TEACHER.sub)
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.OK)
                    .then((res) => {
                        assert.strictEqual(res.header['cache-control'], 'max-age=60');

                        const body = res.body;
                        assert.strictEqual(body[0].message, message);
                        assert.strictEqual(body[0].url, url);
                    });
            });

            it('should not allow students to use teacher URL', () => {
                nextUser = AUTH_USERS.STUDENT;
                return request(testServer)
                    .get('/api/sitealerts/alerts/' + CLASSID + '/supervisors/' + AUTH_USERS.TEACHER.sub)
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.FORBIDDEN)
                    .then((res) => {
                        const body = res.body;
                        assert.deepStrictEqual(body, { error : 'Only supervisors are allowed to invoke this' });
                    });
            });
        });


        describe('fetching student alerts', () => {
            const message = 'I am a message for students';
            const url = 'http://webaddress.com/student';

            before(() => {
                return store.storeSiteAlert(message, url, 'student', 'info', 15000)
                    .then(() => {
                        return sitealerts.refreshCache();
                    });
            });

            it('should allow students to get student messages', () => {
                nextUser = AUTH_USERS.STUDENT;
                return request(testServer)
                    .get('/api/sitealerts/alerts/' + CLASSID + '/students/' + AUTH_USERS.STUDENT.sub)
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.OK)
                    .then((res) => {
                        const body = res.body;
                        assert.strictEqual(body[0].message, message);
                        assert.strictEqual(body[0].url, url);
                    });
            });

            it('should allow teachers to get student messages', () => {
                nextUser = AUTH_USERS.TEACHER;
                return request(testServer)
                    .get('/api/sitealerts/alerts/' + CLASSID + '/supervisors/' + AUTH_USERS.TEACHER.sub)
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.OK)
                    .then((res) => {
                        const body = res.body;
                        assert.strictEqual(body[0].message, message);
                        assert.strictEqual(body[0].url, url);
                    });
            });
        });


        describe('fetching teacher alerts', () => {
            const message = 'I am a supervisor message for teachers only';
            const url = 'http://webaddress.com/teacher';

            before(() => {
                return store.storeSiteAlert(message, url, 'supervisor', 'warning', 15000)
                    .then(() => {
                        return sitealerts.refreshCache();
                    });
            });

            it('should not allow students to get student messages', () => {
                nextUser = AUTH_USERS.STUDENT;
                return request(testServer)
                    .get('/api/sitealerts/alerts/' + CLASSID + '/students/' + AUTH_USERS.STUDENT.sub)
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.OK)
                    .then((res) => {
                        const body = res.body;
                        assert.deepStrictEqual(body, []);
                    });
            });

            it('should allow teachers to get teacher messages', () => {
                nextUser = AUTH_USERS.TEACHER;
                return request(testServer)
                    .get('/api/sitealerts/alerts/' + CLASSID + '/supervisors/' + AUTH_USERS.TEACHER.sub)
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.OK)
                    .then((res) => {
                        const body = res.body;
                        assert.strictEqual(body[0].message, message);
                        assert.strictEqual(body[0].url, url);
                    });
            });
        });


        describe('refresh cache', () => {

            it('should update the response by calling refresh', () => {
                const firstMessage = 'This is the old message';
                const secondMessage = 'This is the newer replacement message';
                const messageUrl = 'http://website.com';

                nextUser = AUTH_USERS.SITEADMIN;
                return store.storeSiteAlert(firstMessage, messageUrl, 'public', 'info', 10000)
                    .then(() => {
                        nextUser = AUTH_USERS.SITEADMIN;
                        return request(testServer)
                            .put('/api/sitealerts/actions/refresh')
                            .expect(httpstatus.OK);
                    })
                    .then(() => {
                        nextUser = AUTH_USERS.STUDENT;
                        return request(testServer)
                            .get('/api/sitealerts/alerts/' + CLASSID + '/students/' + AUTH_USERS.STUDENT.sub)
                            .expect('Content-Type', /json/)
                            .expect(httpstatus.OK);
                    })
                    .then((res) => {
                        const body = res.body;
                        assert.strictEqual(body[0].message, firstMessage);
                        return new Promise((resolve) => {
                            setTimeout(resolve, 1100);
                        });
                    })
                    .then(() => {
                        nextUser = AUTH_USERS.SITEADMIN;
                        return store.storeSiteAlert(secondMessage, messageUrl, 'student', 'error', 10000);
                    })
                    .then(() => {
                        nextUser = AUTH_USERS.STUDENT;
                        return request(testServer)
                            .get('/api/sitealerts/alerts/' + CLASSID + '/students/' + AUTH_USERS.STUDENT.sub)
                            .expect('Content-Type', /json/)
                            .expect(httpstatus.OK);
                    })
                    .then((res) => {
                        const body = res.body;
                        assert.strictEqual(body[0].message, firstMessage);

                        nextUser = AUTH_USERS.SITEADMIN;
                        return request(testServer)
                            .put('/api/sitealerts/actions/refresh')
                            .expect(httpstatus.OK);
                    })
                    .then(() => {
                        nextUser = AUTH_USERS.STUDENT;
                        return request(testServer)
                            .get('/api/sitealerts/alerts/' + CLASSID + '/students/' + AUTH_USERS.STUDENT.sub)
                            .expect('Content-Type', /json/)
                            .expect(httpstatus.OK);
                    })
                    .then((res) => {
                        const body = res.body;
                        assert.strictEqual(body[0].message, secondMessage);
                    });
            });

        });


        describe('store site alert', () => {

            it('should allow a site admin to store an error', () => {
                nextUser = AUTH_USERS.SITEADMIN;
                return request(testServer)
                    .post('/api/sitealerts')
                    .send({
                        message : 'Hello',
                        url : 'http://website.com',
                        expiry : 10000,
                        audience : 'public',
                        severity : 'error',
                    })
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.OK)
                    .then((res) => {
                        const body = res.body;
                        assert.strictEqual(body.message, 'Hello');
                        assert.strictEqual(body.url, 'http://website.com');
                        assert.strictEqual(body.audience, 'public');
                        assert.strictEqual(body.severity, 'error');
                    });
            });

            it('should allow a site admin to store a warning', () => {
                nextUser = AUTH_USERS.SITEADMIN;
                return request(testServer)
                    .post('/api/sitealerts')
                    .send({
                        message : 'Greetings',
                        url : 'http://website.com',
                        expiry : 5000,
                        audience : 'supervisor',
                        severity : 'warning',
                    })
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.OK)
                    .then((res) => {
                        const body = res.body;
                        assert.strictEqual(body.message, 'Greetings');
                        assert.strictEqual(body.url, 'http://website.com');
                        assert.strictEqual(body.audience, 'supervisor');
                        assert.strictEqual(body.severity, 'warning');
                    });
            });

            it('should allow a site admin to store a message', () => {
                nextUser = AUTH_USERS.SITEADMIN;
                return request(testServer)
                    .post('/api/sitealerts')
                    .send({
                        message : 'Final',
                        url : 'http://website.com',
                        expiry : 15000,
                        audience : 'student',
                        severity : 'info',
                    })
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.OK)
                    .then((res) => {
                        const body = res.body;
                        assert.strictEqual(body.message, 'Final');
                        assert.strictEqual(body.url, 'http://website.com');
                        assert.strictEqual(body.audience, 'student');
                        assert.strictEqual(body.severity, 'info');
                    });
            });

            it('should require all fields', () => {
                nextUser = AUTH_USERS.SITEADMIN;
                return request(testServer)
                    .post('/api/sitealerts')
                    .send({
                        url : 'http://website.com',
                        expiry : 15000,
                        audience : 'student',
                        severity : 'info',
                    })
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.BAD_REQUEST)
                    .then((res) => {
                        const body = res.body;
                        assert.deepStrictEqual(body, { error : 'Missing required field' });
                    });
            });

            it('should reject invalid messages', () => {
                nextUser = AUTH_USERS.SITEADMIN;
                return request(testServer)
                    .post('/api/sitealerts')
                    .send({
                        message : 'Final',
                        url : 'http://website.com',
                        expiry : 15000,
                        audience : 'everyone',
                        severity : 'info',
                    })
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.BAD_REQUEST)
                    .then((res) => {
                        assert.deepStrictEqual(res.body, { error : 'Invalid audience type everyone' });
                    });
            });

            it.skip('should reject duplicates', () => {
                nextUser = AUTH_USERS.SITEADMIN;
                return request(testServer)
                    .post('/api/sitealerts')
                    .send({
                        message : 'Final',
                        url : 'http://website.com',
                        expiry : 15000,
                        audience : 'student',
                        severity : 'info',
                    })
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.OK)
                    .then(() => {
                        return request(testServer)
                            .post('/api/sitealerts')
                            .send({
                                message : 'Final',
                                url : 'http://website.com',
                                expiry : 15000,
                                audience : 'student',
                                severity : 'info',
                            })
                            .expect('Content-Type', /json/)
                            .expect(httpstatus.INTERNAL_SERVER_ERROR);
                    })
                    .then((res) => {
                        assert.strictEqual(res.body.error, 'Error accessing the database used to store data');
                    });
            });

            it('should not allow a student to store a message', () => {
                nextUser = AUTH_USERS.STUDENT;
                return request(testServer)
                    .post('/api/sitealerts')
                    .send({
                        message : 'Please reject this',
                        url : 'http://website.com',
                        expiry : 15000,
                        audience : 'student',
                        severity : 'info',
                    })
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.FORBIDDEN)
                    .then((res) => {
                        const body = res.body;
                        assert.deepStrictEqual(body, { error : 'Forbidden' });
                    });
            });

            it('should not allow a teacher to store a message', () => {
                nextUser = AUTH_USERS.TEACHER;
                return request(testServer)
                    .post('/api/sitealerts')
                    .send({
                        message : 'Please reject this',
                        url : 'http://website.com',
                        expiry : 15000,
                        audience : 'student',
                        severity : 'info',
                    })
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.FORBIDDEN)
                    .then((res) => {
                        const body = res.body;
                        assert.deepStrictEqual(body, { error : 'Forbidden' });
                    });
            });

            it('should not allow a teacher to refresh the cache', () => {
                nextUser = AUTH_USERS.TEACHER;
                return request(testServer)
                    .put('/api/sitealerts/actions/refresh')
                    .expect(httpstatus.FORBIDDEN)
                    .then((res) => {
                        const body = res.body;
                        assert.deepStrictEqual(body, { error : 'Forbidden' });
                    });
            });
        });
    });

});
