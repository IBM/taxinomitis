/*eslint-env mocha */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as randomstring from 'randomstring';
import * as express from 'express';

import * as store from '../../lib/db/store';
import * as Types from '../../lib/db/db-types';
import * as auth from '../../lib/restapi/auth';
import * as auth0 from '../../lib/auth0/requests';
import * as mocks from '../auth0/requestmocks';

import testapiserver from './testserver';

let testServer: express.Express;


describe('REST API - users', () => {

    const TENANTS = {
        correct : 'single',
        incorrect : 'different',
    };

    let tenantId: string;

    let authStub: sinon.SinonStub<[express.Request, express.Response, express.NextFunction], void>;
    let requireSupervisorStub: sinon.SinonStub<[express.Request, express.Response, express.NextFunction], void>;

    function authMock(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        // @ts-ignore
        req.user = {
            'sub' : 'userid',
            'https://machinelearningforkids.co.uk/api/role' : 'supervisor',
            'https://machinelearningforkids.co.uk/api/tenant' : tenantId,
        };
        next();
    }
    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        next();
    }


    before(() => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authMock);
        requireSupervisorStub = sinon.stub(auth, 'requireSupervisor').callsFake(authNoOp);

        testServer = testapiserver();
    });

    after(() => {
        authStub.restore();
        requireSupervisorStub.restore();
    });



    describe('getPolicy()', () => {

        it('should get the restrictions policy', () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                createUser : sinon.stub(auth0, 'createUser').callsFake(mocks.createUser.good),
                getUserCounts : sinon.stub(auth0, 'getUserCounts').callsFake(mocks.getUserCounts),
            };
            tenantId = 'AN_UNKNOWN_TENANT_ID';

            return store.init()
                .then(() => {
                    return request(testServer)
                        .get('/api/classes/AN_UNKNOWN_TENANT_ID/policy')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;

                    assert.deepStrictEqual(body, {
                        maxTextModels : 0,
                        maxUsers: 30,
                        supportedProjectTypes: [ 'text', 'imgtfjs', 'numbers', 'sounds' ],
                        tenantType : Types.ClassTenantType.UnManaged,
                        isManaged : false,
                        maxProjectsPerUser: 3,
                        textClassifierExpiry: 24,
                        textTrainingItemsPerProject : 500,
                        numberTrainingItemsPerProject : 1000,
                        numberTrainingItemsPerClassProject : 3000,
                        imageTrainingItemsPerProject : 100,
                        soundTrainingItemsPerProject : 100,
                    });

                    stubs.getOauthToken.restore();
                    stubs.createUser.restore();
                    stubs.getUserCounts.restore();

                    return store.disconnect();
                });
        });

    });




    describe('deleteStudent()', () => {

        it('should delete a student', async () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                getUser : sinon.stub(auth0, 'getUser').callsFake(mocks.getUser.johndoe),
                deleteUser : sinon.stub(auth0, 'deleteUser').callsFake(mocks.deleteUser.good),
            };
            tenantId = TENANTS.correct;

            const userid = 'auth0|58dd72d0b2e87002695249b6';

            await store.init();

            await store.deleteAllPendingJobs();

            await request(testServer)
                .del('/api/classes/' + TENANTS.correct + '/students/' + userid)
                .expect(httpstatus.NO_CONTENT);

            await oneSecond();

            const jobAfter = await store.getNextPendingJob();
            assert(jobAfter);
            if (jobAfter) {
                assert.strictEqual(jobAfter.jobtype, 3);
                assert.deepStrictEqual(jobAfter.jobdata, {
                    userid,
                    classid : TENANTS.correct,
                });
            }

            stubs.getOauthToken.restore();
            stubs.getUser.restore();
            stubs.deleteUser.restore();

            return store.disconnect();
        });


        function oneSecond(): Promise<void> {
            return new Promise((resolve) => {
                setTimeout(resolve, 1000);
            });
        }


        it('should refuse to delete students from a different tenant', () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                getUser : sinon.stub(auth0, 'getUser').callsFake(mocks.getUser.johndoe),
                deleteUser : sinon.stub(auth0, 'deleteUser').callsFake(mocks.deleteUser.good),
            };
            tenantId = TENANTS.incorrect;

            return request(testServer)
                .del('/api/classes/' + TENANTS.incorrect + '/students/auth0|58dd72d0b2e87002695249b6')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.statusCode, 404);
                    assert.strictEqual(body.error, 'Not Found');
                })
                .then(function restore() {
                    stubs.getOauthToken.restore();
                    stubs.getUser.restore();
                    stubs.deleteUser.restore();
                });
        });

    });


    describe('createTeacher()', () => {

        it('should require a payload', () => {
            return request(testServer)
                .post('/api/teachers')
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, {
                        error: 'A username and email address for a class leader ' +
                               'is required to create a new class',
                    });
                });
        });

        it('should require a username', () => {
            return request(testServer)
                .post('/api/teachers')
                .send({
                    email : 'mickey@disney.com',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, {
                        error: 'A username and email address for a class leader ' +
                               'is required to create a new class',
                    });
                });
        });

        it('should require an email address', () => {
            return request(testServer)
                .post('/api/teachers')
                .send({
                    username : 'mickeymouse',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, {
                        error: 'A username and email address for a class leader ' +
                               'is required to create a new class',
                    });
                });
        });

        it('should enforce username rules', () => {
            return request(testServer)
                .post('/api/teachers')
                .send({
                    username : 'Mickey Mouse!',
                    email : 'mickey@disney.com',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, {
                        error: 'Invalid username. Use letters, numbers, hyphens and underscores, only.',
                    });
                });
        });

        it('should create a new teacher', () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                createUser : sinon.stub(auth0, 'createUser').callsFake(mocks.createUser.good),
                getUserCounts : sinon.stub(auth0, 'getUserCounts').callsFake(mocks.getUserCounts),
            };

            return request(testServer)
                    .post('/api/teachers')
                    .send({
                        username : 'mickeymouse',
                        email : 'mickey@disney.com',
                    })
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.CREATED)
                    .then((res) => {
                        const body = res.body;
                        assert(body.id);
                        assert(body.password);
                        assert.strictEqual(body.username, 'mickeymouse');

                        stubs.getOauthToken.restore();
                        stubs.createUser.restore();
                        stubs.getUserCounts.restore();

                        return store.disconnect();
                    });
        });


        it('should create a new teacher with explanations', () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                createUser : sinon.stub(auth0, 'createUser').callsFake(mocks.createUser.good),
                getUserCounts : sinon.stub(auth0, 'getUserCounts').callsFake(mocks.getUserCounts),
            };

            return request(testServer)
                    .post('/api/teachers')
                    .send({
                        username : 'mickeymouse',
                        email : 'mickey@disney.com',
                        notes : 'Hello Mickey',
                    })
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.CREATED)
                    .then((res) => {
                        const body = res.body;
                        assert(body.id);
                        assert(body.password);
                        assert.strictEqual(body.username, 'mickeymouse');

                        stubs.getOauthToken.restore();
                        stubs.createUser.restore();
                        stubs.getUserCounts.restore();

                        return store.disconnect();
                    });
        });

    });


    describe('createStudent()', () => {

        it('should create a new user', () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                createUser : sinon.stub(auth0, 'createUser').callsFake(mocks.createUser.good),
                getUserCounts : sinon.stub(auth0, 'getUserCounts').callsFake(mocks.getUserCounts),
            };
            tenantId = 'mytesttenant';

            const username = 'R129' + randomstring.generate({ length : 9, readable : true });

            return store.init()
                .then(() => {
                    return request(testServer)
                        .post('/api/classes/mytesttenant/students')
                        .send({ username })
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.CREATED);
                })
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    assert(body.password);
                    assert.strictEqual(body.username, username);

                    stubs.getOauthToken.restore();
                    stubs.createUser.restore();
                    stubs.getUserCounts.restore();

                    return store.disconnect();
                });
        });


        it('should require a username', () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                createUser : sinon.stub(auth0, 'createUser').callsFake(mocks.createUser.good),
            };
            tenantId = 'mytesttenant';

            return request(testServer)
                .post('/api/classes/mytesttenant/students')
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Missing required field "username"');
                })
                .then(function restore() {
                    stubs.getOauthToken.restore();
                    stubs.createUser.restore();
                });
        });


        it('should require a valid username', () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                createUser : sinon.stub(auth0, 'createUser').callsFake(mocks.createUser.good),
            };
            tenantId = 'mytesttenant';

            return request(testServer)
                .post('/api/classes/mytesttenant/students')
                .send({ username : 'Hello World' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error,
                                       'Invalid username. Use letters, numbers, hyphens and underscores, only.');
                })
                .then(function restore() {
                    stubs.getOauthToken.restore();
                    stubs.createUser.restore();
                });
        });


        it('should enforce limits on number of users in a class', () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                createUser : sinon.stub(auth0, 'createUser').callsFake(mocks.createUser.good),
                getUserCounts : sinon.stub(auth0, 'getUserCounts').resolves({
                    users: [], total : 30, start : 0, limit : 30, length : 30 }),
            };
            tenantId = 'mytesttenant';

            return store.init()
                .then(() => {
                    return request(testServer)
                        .post('/api/classes/mytesttenant/students')
                        .send({ username : 'HelloWorld' })
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.CONFLICT);
                })
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Class already has maximum allowed number of students');

                    stubs.getOauthToken.restore();
                    stubs.createUser.restore();
                    stubs.getUserCounts.restore();

                    return store.disconnect();
                });
        });
    });


    describe('getStudents()', () => {

        it('should cope with an empty list', () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                getUsers : sinon.stub(auth0, 'getUsers').callsFake(mocks.getUsers.empty),
            };
            tenantId = 'empty';

            return request(testServer)
                .get('/api/classes/empty/students')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.length, 0);
                    assert(Array.isArray(body));
                })
                .then(function restore() {
                    stubs.getOauthToken.restore();
                    stubs.getUsers.restore();
                });
        });

        it('should cope with a class with one student', () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                getUsers : sinon.stub(auth0, 'getUsers').callsFake(mocks.getUsers.single),
            };
            tenantId = 'single';

            return request(testServer)
                .get('/api/classes/single/students')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.length, 1);
                    assert(Array.isArray(body));
                })
                .then(function restore() {
                    stubs.getOauthToken.restore();
                    stubs.getUsers.restore();
                });
        });

        it('should cope with errors', () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                getUsers : sinon.stub(auth0, 'getUsers').callsFake(mocks.getUsers.error),
            };
            tenantId = 'single';

            return request(testServer)
                .get('/api/classes/single/students')
                .expect('Content-Type', /json/)
                .expect(httpstatus.INTERNAL_SERVER_ERROR)
                .then((res) => {
                    const body = res.body;
                    assert(body.error);
                })
                .then(function restore() {
                    stubs.getOauthToken.restore();
                    stubs.getUsers.restore();
                });
        });
    });

    describe('resetPassword()', () => {

        it('should reset passwords for a user', () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                getUser : sinon.stub(auth0, 'getUser').callsFake(mocks.getUser.johndoe),
                modifyUser : sinon.stub(auth0, 'modifyUser').callsFake(mocks.modifyUser.good),
            };
            tenantId = TENANTS.correct;

            const userid = 'auth0|58dd72d0b2e87002695249b6';

            return request(testServer)
                .post('/api/classes/' + TENANTS.correct + '/students/' + userid + '/password')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.id, userid);
                    assert(body.username);
                    assert(body.password);
                })
                .then(function restore() {
                    stubs.getOauthToken.restore();
                    stubs.getUser.restore();
                    stubs.modifyUser.restore();
                });
        });

        it('should refuse to reset passwords for students in a different tenant', () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                getUser : sinon.stub(auth0, 'getUser').callsFake(mocks.getUser.johndoe),
                modifyUser : sinon.stub(auth0, 'modifyUser').callsFake(mocks.modifyUser.good),
            };
            tenantId = TENANTS.incorrect;

            return request(testServer)
                .post('/api/classes/' + TENANTS.incorrect + '/students/auth0|58dd72d0b2e87002695249b6/password')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.statusCode, 404);
                    assert.strictEqual(body.error, 'Not Found');
                })
                .then(function restore() {
                    stubs.getOauthToken.restore();
                    stubs.getUser.restore();
                    stubs.modifyUser.restore();
                });
        });

    });

});
