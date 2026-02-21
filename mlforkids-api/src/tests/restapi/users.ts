import { describe, it, before, beforeEach, after, afterEach } from 'node:test';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as request from 'supertest';
import { status as httpstatus } from 'http-status';
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
    let sandbox: sinon.SinonSandbox;

    let authStub: sinon.SinonStub<[express.Request, express.Response, express.NextFunction], void>;
    let requireSupervisorStub: sinon.SinonStub<[express.Request, express.Response, express.NextFunction], void>;

    function authMock(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        const mockedReq: any = req;
        mockedReq.user = {
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

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    after(() => {
        authStub.restore();
        requireSupervisorStub.restore();
    });



    describe('getPolicy()', () => {

        it('should get the restrictions policy', async () => {
            sandbox.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good);
            sandbox.stub(auth0, 'createUser').callsFake(mocks.createUser.good);
            sandbox.stub(auth0, 'getUserCounts').callsFake(mocks.getUserCounts);

            tenantId = 'AN_UNKNOWN_TENANT_ID';

            await store.init();

            const res = await request(testServer)
                .get('/api/classes/AN_UNKNOWN_TENANT_ID/policy')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(res.body, {
                maxTextModels : 0,
                maxUsers: 31,
                supportedProjectTypes: [ 'text', 'imgtfjs', 'numbers', 'sounds' ],
                tenantType : Types.ClassTenantType.UnManaged,
                isManaged : false,
                maxProjectsPerUser: 3,
                textClassifierExpiry: 24,
                textTrainingItemsPerProject : 500,
                numberTrainingItemsPerProject : 1000,
                numberTrainingItemsPerClassProject : 3000,
                imageTrainingItemsPerProject : 250,
                soundTrainingItemsPerProject : 100,
            });

            await store.disconnect();
        });

    });




    describe('deleteStudent()', () => {

        it('should delete a student', async () => {
            sandbox.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good);
            sandbox.stub(auth0, 'getUser').callsFake(mocks.getUser.johndoe);
            sandbox.stub(auth0, 'deleteUser').callsFake(mocks.deleteUser.good);
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

            return store.disconnect();
        });


        function oneSecond(): Promise<void> {
            return new Promise((resolve) => {
                setTimeout(resolve, 1000);
            });
        }


        it('should refuse to delete students from a different tenant', async () => {
            sandbox.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good);
            sandbox.stub(auth0, 'getUser').callsFake(mocks.getUser.johndoe);
            sandbox.stub(auth0, 'deleteUser').callsFake(mocks.deleteUser.good);

            tenantId = TENANTS.incorrect;

            const res = await request(testServer)
                .del('/api/classes/' + TENANTS.incorrect + '/students/auth0|58dd72d0b2e87002695249b6')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);

            assert.strictEqual(res.body.statusCode, 404);
            assert.strictEqual(res.body.error, 'Not Found');
        });

    });


    describe('createTeacher()', () => {

        it('should require a payload', async () => {
            const res = await request(testServer)
                .post('/api/teachers')
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error: 'Missing data' });
        });

        it('should require a username', async () => {
            const res = await request(testServer)
                .post('/api/teachers')
                .send({
                    email : 'mickey@disney.com',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error: 'A username and email address for a class leader ' +
                       'is required to create a new class',
            });
        });

        it('should require an email address', async () => {
            const res = await request(testServer)
                .post('/api/teachers')
                .send({
                    username : 'mickeymouse',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error: 'A username and email address for a class leader ' +
                       'is required to create a new class',
            });
        });

        it('should enforce username rules', async () => {
            const res = await request(testServer)
                .post('/api/teachers')
                .send({
                    username : 'Mickey Mouse!',
                    email : 'mickey@disney.com',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error: 'Invalid username. Use letters, numbers, hyphens and underscores, only.',
            });
        });

        it('should create a new teacher', async () => {
            sandbox.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good);
            sandbox.stub(auth0, 'createUser').callsFake(mocks.createUser.good);
            sandbox.stub(auth0, 'getUserCounts').callsFake(mocks.getUserCounts);

            const res = await request(testServer)
                .post('/api/teachers')
                .send({
                    username : 'mickeymouse',
                    email : 'mickey@disney.com',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert(res.body.id);
            assert(res.body.password);
            assert.strictEqual(res.body.username, 'mickeymouse');

            await store.disconnect();
        });


        it('should create a new teacher with explanations', async () => {
            sandbox.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good);
            sandbox.stub(auth0, 'createUser').callsFake(mocks.createUser.good);
            sandbox.stub(auth0, 'getUserCounts').callsFake(mocks.getUserCounts);

            const res = await request(testServer)
                .post('/api/teachers')
                .send({
                    username : 'mickeymouse',
                    email : 'mickey@disney.com',
                    notes : 'Hello Mickey',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert(res.body.id);
            assert(res.body.password);
            assert.strictEqual(res.body.username, 'mickeymouse');


            await store.disconnect();
        });

    });


    describe('createStudent()', () => {

        it('should create a new user', async () => {

            sandbox.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good);
            sandbox.stub(auth0, 'createUser').callsFake(mocks.createUser.good);
            sandbox.stub(auth0, 'getUserCounts').callsFake(mocks.getUserCounts);
            tenantId = 'mytesttenant';

            const username = 'R129' + randomstring.generate({ length : 9, readable : true });

            await store.init();

            const res = await request(testServer)
                .post('/api/classes/mytesttenant/students')
                .send({ username })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert(res.body.id);
            assert(res.body.password);
            assert.strictEqual(res.body.username, username);


            await store.disconnect();
        });


        it('should require a username', async () => {

            sandbox.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good);
            sandbox.stub(auth0, 'createUser').callsFake(mocks.createUser.good);
            tenantId = 'mytesttenant';

            const res = await request(testServer)
                .post('/api/classes/mytesttenant/students')
                .send({})
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.strictEqual(res.body.error, 'Missing required field "username"');

        });


        it('should require a valid username', async () => {

            sandbox.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good);
            sandbox.stub(auth0, 'createUser').callsFake(mocks.createUser.good);
            tenantId = 'mytesttenant';

            const res = await request(testServer)
                .post('/api/classes/mytesttenant/students')
                .send({ username : 'Hello World' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.strictEqual(res.body.error,
                               'Invalid username. Use letters, numbers, hyphens and underscores, only.');

        });


        it('should enforce limits on number of users in a class', async () => {

            sandbox.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good);
            sandbox.stub(auth0, 'createUser').callsFake(mocks.createUser.good);
            sandbox.stub(auth0, 'getUserCounts').resolves({ users: [], total : 31, start : 0, limit : 31, length : 31 });
            tenantId = 'mytesttenant';

            await store.init();

            const res = await request(testServer)
                .post('/api/classes/mytesttenant/students')
                .send({ username : 'HelloWorld' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CONFLICT);

            assert.strictEqual(res.body.error, 'Class already has maximum allowed number of students');


            await store.disconnect();
        });
    });


    describe('getStudents()', () => {

        it('should cope with an empty list', async () => {

            sandbox.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good);
            sandbox.stub(auth0, 'getUsers').callsFake(mocks.getUsers.empty);
            tenantId = 'empty';

            const res = await request(testServer)
                .get('/api/classes/empty/students')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(res.body.length, 0);
            assert(Array.isArray(res.body));
        });

        it('should cope with a class with one student', async () => {

            sandbox.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good);
            sandbox.stub(auth0, 'getUsers').callsFake(mocks.getUsers.single);
            tenantId = 'single';

            const res = await request(testServer)
                .get('/api/classes/single/students')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(res.body.length, 1);
            assert(Array.isArray(res.body));

        });

        it('should cope with errors', async () => {

            sandbox.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good);
            sandbox.stub(auth0, 'getUsers').callsFake(mocks.getUsers.error);
            tenantId = 'single';

            const res = await request(testServer)
                .get('/api/classes/single/students')
                .expect('Content-Type', /json/)
                .expect(httpstatus.INTERNAL_SERVER_ERROR);

            assert(res.body.error);
        });
    });

    describe('resetPassword()', () => {

        it('should reset passwords for a user', async () => {

            sandbox.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good);
            sandbox.stub(auth0, 'getUser').callsFake(mocks.getUser.johndoe);
            sandbox.stub(auth0, 'modifyUser').callsFake(mocks.modifyUser.good);
            tenantId = TENANTS.correct;

            const userid = 'auth0|58dd72d0b2e87002695249b6';

            const res = await request(testServer)
                .post('/api/classes/' + TENANTS.correct + '/students/' + userid + '/password')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(res.body.id, userid);
            assert(res.body.username);
            assert(res.body.password);
        });

        it('should refuse to reset passwords for students in a different tenant', async () => {

            sandbox.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good);
            sandbox.stub(auth0, 'getUser').callsFake(mocks.getUser.johndoe);
            sandbox.stub(auth0, 'modifyUser').callsFake(mocks.modifyUser.good);
            tenantId = TENANTS.incorrect;

            const res = await request(testServer)
                .post('/api/classes/' + TENANTS.incorrect + '/students/auth0|58dd72d0b2e87002695249b6/password')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);

            assert.strictEqual(res.body.statusCode, 404);
            assert.strictEqual(res.body.error, 'Not Found');
        });

    });
});
