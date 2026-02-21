import { describe, it, before, after, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { v1 as uuid } from 'uuid';
import * as sinon from 'sinon';
import * as request from 'supertest';
import { status as httpstatus } from 'http-status';
import * as randomstring from 'randomstring';
import * as express from 'express';

import * as auth0objects from '../../lib/auth0/auth-types';
import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import * as auth0users from '../../lib/auth0/users';
import * as Types from '../../lib/objectstore/types';
import testapiserver from './testserver';


let testServer: express.Express;


const TESTCLASS = 'UNIQUECLASSIDPROJ';


describe('REST API - projects', () => {

    let authStub: sinon.SinonStub<any, any>;
    let studentsByUserIdStub: sinon.SinonStub<any, any>;

    let nextAuth0UserId = 'userid';
    let nextAuth0UserTenant = 'tenant';
    let nextAuth0UserRole = 'student';

    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        const mockedReq: any = req;
        mockedReq.user = {
            'sub' : nextAuth0UserId,
            'https://machinelearningforkids.co.uk/api/role' : nextAuth0UserRole,
            'https://machinelearningforkids.co.uk/api/tenant' : nextAuth0UserTenant,
        };
        next();
    }

    function emptyClass(): Promise<{ [id: string]: auth0objects.Student }> {
        return Promise.resolve({});
    }


    before(async () => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
        studentsByUserIdStub = sinon.stub(auth0users, 'getStudentsByUserId').callsFake(emptyClass);

        await store.init();

        testServer = testapiserver();

        await store.deleteProjectsByClassId(TESTCLASS);
    });

    beforeEach(() => {
        nextAuth0UserId = 'userid';
        nextAuth0UserTenant = 'classid';
        nextAuth0UserRole = 'student';
    });

    after(async () => {
        authStub.restore();
        studentsByUserIdStub.restore();

        await store.deleteProjectsByClassId(TESTCLASS);
        await store.deleteAllPendingJobs();
        await store.disconnect();
    });


    describe('getProject()', () => {

        it('should handle requests for non-existent projects', async () => {
            const classid = uuid();
            const studentid = uuid();
            const projectid = uuid();
            nextAuth0UserId = studentid;
            nextAuth0UserTenant = classid;
            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + studentid + '/projects/' + projectid)
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);

            assert.strictEqual(res.body.error, 'Not found');
        });

        it('should verify class id', async () => {
            const studentId = uuid();
            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';
            const INCORRECT_CLASS = uuid();

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            const createRes = await request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text', language : 'en' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert(createRes.body.id);
            const projectId = createRes.body.id;

            nextAuth0UserTenant = INCORRECT_CLASS;

            const forbiddenRes = await request(testServer)
                .get('/api/classes/' + INCORRECT_CLASS + '/students/' + studentId + '/projects/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);

            assert.strictEqual(forbiddenRes.body.error, 'Invalid access');
        });

        it('should fetch crowd-sourced projects', async () => {
            const studentId = uuid();
            const teacherId = uuid();

            nextAuth0UserTenant = TESTCLASS;

            nextAuth0UserId = teacherId;
            nextAuth0UserRole = 'supervisor';

            const createRes = await request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/' + teacherId + '/projects')
                .send({ name : uuid(), type : 'text', language : 'en', isCrowdSourced : true })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert(createRes.body.id);
            const projectId = createRes.body.id;
            const projectInfo = createRes.body;

            nextAuth0UserId = studentId;
            nextAuth0UserRole = 'student';

            const getRes = await request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/' + teacherId + '/projects/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(getRes.body, projectInfo);
        });

        it('should fetch own crowd-sourced projects', async () => {
            const teacherId = uuid();

            nextAuth0UserTenant = TESTCLASS;

            nextAuth0UserId = teacherId;
            nextAuth0UserRole = 'supervisor';

            const createRes = await request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/' + teacherId + '/projects')
                .send({ name : uuid(), type : 'text', language : 'en', isCrowdSourced : true })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert(createRes.body.id);
            const projectId = createRes.body.id;
            const projectInfo = createRes.body;

            const getRes = await request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/' + teacherId + '/projects/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(getRes.body, projectInfo);
        });


        it('should verify fetching crowd-sourced projects', async () => {
            const studentId = uuid();
            const teacherId = uuid();

            nextAuth0UserTenant = TESTCLASS;

            nextAuth0UserId = teacherId;
            nextAuth0UserRole = 'supervisor';

            const createRes = await request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/' + teacherId + '/projects')
                .send({ name : uuid(), type : 'text', language : 'en', isCrowdSourced : false })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert(createRes.body.id);
            const projectId = createRes.body.id;

            nextAuth0UserId = studentId;
            nextAuth0UserRole = 'student';

            const forbiddenRes = await request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/' + teacherId + '/projects/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);

            assert.deepStrictEqual(forbiddenRes.body, {
                error : 'Invalid access',
            });
        });

        it('should allow teachers to fetch non-crowd-sourced project for review', async () => {
            const studentId = uuid();
            const teacherId = uuid();

            nextAuth0UserTenant = TESTCLASS;

            nextAuth0UserId = teacherId;
            nextAuth0UserRole = 'student';

            const createRes = await request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects')
                .send({ name : uuid(), type : 'text', language : 'en', isCrowdSourced : false })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert(createRes.body.id);
            const projectId = createRes.body.id;

            nextAuth0UserId = teacherId;
            nextAuth0UserRole = 'supervisor';

            await request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);
        });

        it('should prevent students fetching non-crowd-sourced project for review', async () => {
            const studentId = uuid();
            const teacherId = uuid();

            nextAuth0UserTenant = TESTCLASS;

            nextAuth0UserId = teacherId;
            nextAuth0UserRole = 'student';

            const createRes = await request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects')
                .send({ name : uuid(), type : 'text', language : 'en', isCrowdSourced : false })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert(createRes.body.id);
            const projectId = createRes.body.id;

            nextAuth0UserId = teacherId;
            nextAuth0UserRole = 'student';

            const forbiddenRes = await request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);

            assert.deepStrictEqual(forbiddenRes.body, {
                error : 'Invalid access',
            });
        });
    });


    describe('deleteProject()', () => {

        it('should handle requests for non-existent projects', async () => {
            const classid = uuid();
            const studentid = uuid();
            const projectid = uuid();
            nextAuth0UserId = studentid;
            nextAuth0UserTenant = classid;
            const res = await request(testServer)
                .del('/api/classes/' + classid + '/students/' + studentid + '/projects/' + projectid)
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);

            assert.strictEqual(res.body.error, 'Not found');
        });

        it('should delete project details', async () => {
            const studentId = uuid();
            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            const createRes = await request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text', language : 'en' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert(createRes.body.id);
            const projectId = createRes.body.id;

            await request(testServer)
                .get(url + '/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            await request(testServer)
                .del(url + '/' + projectId)
                .expect(httpstatus.NO_CONTENT);

            const notFoundRes = await request(testServer)
                .get(url + '/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);

            assert.strictEqual(notFoundRes.body.error, 'Not found');
        });


        it('should clean up object storage when deleting image projects', async () => {
            let projectid: string = '';

            const classid = 'TESTTENANT';
            const userid = uuid();
            const url = '/api/classes/' + classid + '/students/' + userid + '/projects';

            await store.deleteAllPendingJobs();

            const jobBefore = await store.getNextPendingJob();
            assert(!jobBefore);

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            await request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'images', language : 'en' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    projectid = body.id;
                });

            await request(testServer)
                .del(url + '/' + projectid)
                .expect(httpstatus.NO_CONTENT);

            const jobAfter = await store.getNextPendingJob();
            assert(jobAfter);
            if (jobAfter) {
                assert.strictEqual(jobAfter.jobtype, 2);
                assert.deepStrictEqual(jobAfter.jobdata, { projectid, userid, classid });
            }

            const notFoundRes = await request(testServer)
                .get(url + '/' + projectid)
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);

            assert.strictEqual(notFoundRes.body.error, 'Not found');
        });


        it('should verify class id', async () => {
            const studentId = uuid();
            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';
            const INCORRECT_CLASS = uuid();
            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            const createRes = await request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text', language : 'en' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert(createRes.body.id);
            const projectId = createRes.body.id;

            const forbiddenRes = await request(testServer)
                .del('/api/classes/' + INCORRECT_CLASS + '/students/' + studentId + '/projects/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);

            assert.strictEqual(forbiddenRes.body.error, 'Invalid access');
        });
    });


    describe('createProject()', () => {

        it('should reject unicode names that cannot be stored by in the DB', async () => {
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            const res = await request(testServer)
                .post(url)
                .send({ name : '⚽', type : 'text', language : 'en' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.strictEqual(res.body.error, 'Invalid project name');
        });

        it('should respect tenant policies on project types', async () => {
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            const res = await request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'images' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);

            assert.strictEqual(res.body.error, 'Support for images projects is not enabled for your class');
        });



        it('should respect tenant policies on number of projects', async () => {
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            await request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text', language : 'en' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            await request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text', language : 'en'  })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            await request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text', language : 'en'  })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            const conflictRes = await request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text', language : 'en'  })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CONFLICT);

            assert.strictEqual(conflictRes.body.error, 'User already has maximum number of projects');
        });


        it('should require a project type', async () => {
            const projectDetails = { name : uuid() };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            const res = await request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.strictEqual(res.body.error, 'Missing required field');
        });


        it('should require fields for numbers projects', async () => {
            const projectDetails = {
                name : uuid(),
                type : 'numbers',
            };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            const res = await request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error : 'Fields required for numbers projects' });
        });


        it('should require non-empty fields for numbers projects', async () => {
            const projectDetails = {
                name : uuid(),
                type : 'numbers',
                fields : [],
            };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            const res = await request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error : 'Fields required for numbers projects' });
        });


        it('should require really non-empty fields for numbers projects', async () => {
            const projectDetails = {
                name : uuid(),
                type : 'numbers',
                fields : [ '' ],
            };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            const res = await request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error : 'Missing required attributes' });
        });


        it('should validate length of fields for numbers projects', async () => {
            const projectDetails = {
                name : uuid(),
                type : 'numbers',
                fields : [ { type : 'number', name : 'abcdefghijklmnopqrstuv' } ],
            };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            const res = await request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error : 'Invalid field name' });
        });


        it('should verify the type of fields for numbers projects', async () => {
            const projectDetails = {
                name : uuid(),
                type : 'numbers',
                fields : [ { type : 'something', name : 'failing' } ],
            };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            const res = await request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error : 'Invalid field type something' });
        });


        it('should store project details', async () => {
            const projectDetails = {
                name : uuid(),
                type : 'text',
                language : 'it',
            };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            const createRes = await request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert.strictEqual(createRes.body.userid, studentId);
            assert.strictEqual(createRes.body.classid, TESTCLASS);
            assert.strictEqual(createRes.body.type, projectDetails.type);
            assert.strictEqual(createRes.body.name, projectDetails.name);
            assert.strictEqual(createRes.body.language, projectDetails.language);
            assert.strictEqual(createRes.body.isCrowdSourced, false);
            assert(createRes.body.id);

            const getRes = await request(testServer)
                .get(url + '/' + createRes.body.id)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes.body.userid, studentId);
            assert.strictEqual(getRes.body.classid, TESTCLASS);
            assert.strictEqual(getRes.body.type, projectDetails.type);
            assert.strictEqual(getRes.body.name, projectDetails.name);
            assert.strictEqual(getRes.body.language, projectDetails.language);
            assert.strictEqual(getRes.body.isCrowdSourced, false);
        });

        it('should store sounds project details', async () => {
            const projectDetails = {
                name : uuid(),
                type : 'sounds',
            };
            const studentId = uuid();
            const classid = 'TESTTENANT';

            const url = '/api/classes/' + classid + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = classid;

            const createRes = await request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert.strictEqual(createRes.body.userid, studentId);
            assert.strictEqual(createRes.body.classid, classid);
            assert.strictEqual(createRes.body.type, projectDetails.type);
            assert.strictEqual(createRes.body.name, projectDetails.name);
            assert.strictEqual(createRes.body.isCrowdSourced, false);
            assert(createRes.body.id);

            const getRes = await request(testServer)
                .get(url + '/' + createRes.body.id)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes.body.userid, studentId);
            assert.strictEqual(getRes.body.classid, classid);
            assert.strictEqual(getRes.body.type, projectDetails.type);
            assert.strictEqual(getRes.body.name, projectDetails.name);
            assert.strictEqual(getRes.body.isCrowdSourced, false);
            assert.deepStrictEqual(getRes.body.labels, ['_background_noise_']);
        });

        it('should only allow teachers to create crowd-sourced projects', async () => {
            const projectDetails = {
                name : uuid(),
                type : 'text',
                language : 'it',
                isCrowdSourced : true,
            };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            const res = await request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);

            assert.deepStrictEqual(res.body, {
                error : 'Only teachers or group leaders can create crowd-sourced projects',
            });
        });

        it('should store crowd-sourced projects', async () => {
            const projectDetails = {
                name : uuid(),
                type : 'text',
                language : 'it',
                isCrowdSourced : true,
            };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'supervisor';

            const createRes = await request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert.strictEqual(createRes.body.userid, studentId);
            assert.strictEqual(createRes.body.classid, TESTCLASS);
            assert.strictEqual(createRes.body.type, projectDetails.type);
            assert.strictEqual(createRes.body.name, projectDetails.name);
            assert.strictEqual(createRes.body.language, projectDetails.language);
            assert.strictEqual(createRes.body.isCrowdSourced, true);
            assert(createRes.body.id);

            const getRes = await request(testServer)
                .get(url + '/' + createRes.body.id)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes.body.userid, studentId);
            assert.strictEqual(getRes.body.classid, TESTCLASS);
            assert.strictEqual(getRes.body.type, projectDetails.type);
            assert.strictEqual(getRes.body.name, projectDetails.name);
            assert.strictEqual(getRes.body.language, projectDetails.language);
            assert.strictEqual(getRes.body.isCrowdSourced, true);
        });

    });


    describe('getProjectsByUserId()', () => {

        it('should cope with an empty list', async () => {
            const classid = uuid();
            const studentid = uuid();
            nextAuth0UserId = studentid;
            nextAuth0UserTenant = classid;
            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + studentid + '/projects')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert(Array.isArray(res.body));
            assert.strictEqual(res.body.length, 0);
        });


        it('should return projects for a user', async () => {
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            await request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text', language : 'en' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            const firstGetRes = await request(testServer)
                .get(url)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert(Array.isArray(firstGetRes.body));
            assert(firstGetRes.body.length > 0);
            const count = firstGetRes.body.length;

            await request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text', language : 'en' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            const secondGetRes = await request(testServer)
                .get(url)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert(Array.isArray(secondGetRes.body));
            assert.strictEqual(secondGetRes.body.length, count + 1);
        });


        async function testCreateProject(classid: string, user: string, crowd: boolean): Promise<any> {
            const res = await request(testServer)
                    .post('/api/classes/' + classid + '/students/' + user + '/projects')
                    .send({ name : uuid(), type : 'text', language : 'en', isCrowdSourced : crowd })
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.CREATED);
            return res.body;
        }
        async function testGetProjects(classid: string, user: string): Promise<any> {
            const res = await request(testServer)
                    .get('/api/classes/' + classid + '/students/' + user + '/projects')
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.OK);
            return res.body;
        }
        function testSetUser(classid: string, user: string) {
            nextAuth0UserTenant = classid;
            nextAuth0UserId = user;
            nextAuth0UserRole = 'student';
        }
        function testSetTeacher(classid: string, user: string) {
            testSetUser(classid, user);
            nextAuth0UserRole = 'supervisor';
        }

        function compareProjects(objA: any, objB: any) {
            if (objA.id > objB.id) {
                return 1;
            }
            if (objA.id < objB.id) {
                return -1;
            }
            return 0;
        }

        async function testVerifyAll(
            classid: string,
            studentA: string, studentB: string, teacherId: string,
            expected: any)
        {
            expected.studentA.sort(compareProjects);
            expected.studentB.sort(compareProjects);
            expected.teacher.sort(compareProjects);

            testSetUser(classid, studentA);
            let projects = await testGetProjects(classid, studentA);
            projects.sort(compareProjects);
            assert.deepStrictEqual(projects, expected.studentA);

            testSetUser(classid, studentB);
            projects = await testGetProjects(classid, studentB);
            projects.sort(compareProjects);
            assert.deepStrictEqual(projects, expected.studentB);

            testSetTeacher(classid, teacherId);
            projects = await testGetProjects(classid, teacherId);
            projects.sort(compareProjects);
            assert.deepStrictEqual(projects, expected.teacher);
        }

        it('should return crowd-sourced projects', async () => {
            const classId = uuid();

            const studentA = uuid();
            const studentB = uuid();
            const teacherId = uuid();

            const expectedStudentA: any[] = [];
            const expectedStudentB: any[] = [];
            const expectedTeacher: any[] = [];

            const expected = {
                studentA : expectedStudentA,
                studentB : expectedStudentB,
                teacher : expectedTeacher,
            };

            await testVerifyAll(classId, studentA, studentB, teacherId, expected);

            let newproj = await testCreateProject(classId, studentA, false);
            expected.studentA.push(newproj);
            await testVerifyAll(classId, studentA, studentB, teacherId, expected);

            newproj = await testCreateProject(classId, studentA, false);
            expected.studentA.push(newproj);
            await testVerifyAll(classId, studentA, studentB, teacherId, expected);

            newproj = await testCreateProject(classId, teacherId, true);
            expected.studentA.push(newproj);
            expected.studentB.push(newproj);
            expected.teacher.push(newproj);
            await testVerifyAll(classId, studentA, studentB, teacherId, expected);

            newproj = await testCreateProject(classId, studentB, false);
            expected.studentB.push(newproj);
            await testVerifyAll(classId, studentA, studentB, teacherId, expected);

            newproj = await testCreateProject(classId, teacherId, false);
            expected.teacher.push(newproj);
            await testVerifyAll(classId, studentA, studentB, teacherId, expected);

            await store.deleteProjectsByClassId(classId);
        });

    });


    describe('getProjectsByClassId()', () => {

        it('should cope with an empty list', async () => {
            const classid = uuid();
            nextAuth0UserRole = 'supervisor';
            nextAuth0UserTenant = classid;
            const res = await request(testServer)
                .get('/api/classes/' + classid + '/projects')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert(Array.isArray(res.body));
            assert.strictEqual(res.body.length, 0);
        });


        it('should return projects for a class', async () => {
            const studentA = uuid();
            const studentB = uuid();

            nextAuth0UserId = 'teacher';
            nextAuth0UserRole = 'supervisor';
            nextAuth0UserTenant = TESTCLASS;

            const firstGetRes = await request(testServer)
                .get('/api/classes/' + TESTCLASS + '/projects')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert(Array.isArray(firstGetRes.body));
            let count = firstGetRes.body.length;

            await request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/' + studentA + '/projects')
                .send({ name : uuid(), type : 'text', language : 'en' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            const secondGetRes = await request(testServer)
                .get('/api/classes/' + TESTCLASS + '/projects')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert(Array.isArray(secondGetRes.body));
            assert.strictEqual(secondGetRes.body.length, count + 1);

            count = secondGetRes.body.length;

            await request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/' + studentB + '/projects')
                .send({ name : uuid(), type : 'text', language : 'en' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            const thirdGetRes = await request(testServer)
                .get('/api/classes/' + TESTCLASS + '/projects')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert(Array.isArray(thirdGetRes.body));
            assert.strictEqual(thirdGetRes.body.length, count + 1);
        });


    });


    describe('modifyProjectLabels()', () => {

        it('should add a label', async () => {
            const projectDetails = { type : 'text', name : uuid(), language : 'en' };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'student';

            const createRes = await request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            const projectId = createRes.body.id;

            let getRes = await request(testServer)
                .get(url + '/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(getRes.body.labels, []);

            await request(testServer)
                .patch(url + '/' + projectId)
                .send([{
                    path : '/labels', op : 'add',
                    value : 'newlabel',
                }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            getRes = await request(testServer)
                .get(url + '/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(getRes.body.labels, [ 'newlabel' ]);

            await request(testServer)
                .patch(url + '/' + projectId)
                .send([{
                    path : '/labels', op : 'add',
                    value : 'different',
                }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            getRes = await request(testServer)
                .get(url + '/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(getRes.body.labels, [ 'newlabel', 'different' ]);

            await request(testServer)
                .patch(url + '/' + projectId)
                .send([{
                    path : '/labels', op : 'add',
                    value : 'newlabel',
                }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            getRes = await request(testServer)
                .get(url + '/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(getRes.body.labels, [ 'newlabel', 'different' ]);
        });


        it('should remove a label', async () => {
            const projectDetails = { type : 'text', name : uuid(), language : 'en' };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'student';

            const createRes = await request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            const projectId = createRes.body.id;

            let getRes = await request(testServer)
                .get(url + '/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(getRes.body.labels, []);

            await request(testServer)
                .patch(url + '/' + projectId)
                .send([{
                    path : '/labels', op : 'add',
                    value : 'newlabel',
                }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            getRes = await request(testServer)
                .get(url + '/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(getRes.body.labels, [ 'newlabel' ]);

            await request(testServer)
                .patch(url + '/' + projectId)
                .send([{
                    path : '/labels', op : 'remove',
                    value : 'newlabel',
                }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            getRes = await request(testServer)
                .get(url + '/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(getRes.body.labels, []);
        });


        it('should cleanup object storage after removing a label', async () => {
            const studentId = uuid();
            let projectId: string = '';
            const label = 'newlabel';
            const imageIds = [ uuid(), uuid(), uuid() ];

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            await store.deleteAllPendingJobs();

            const project = await store.storeProject(studentId, TESTCLASS, 'images', uuid(), 'en', [], false);
            projectId = project.id;

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'student';

            await request(testServer)
                .patch(url + '/' + projectId)
                .send([{
                    path : '/labels', op : 'add',
                    value : label,
                }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            await store.storeImageTraining(
                projectId,
                '/api/classes/' + TESTCLASS +
                    '/students/' + studentId +
                    '/projects/' + projectId +
                    '/images/' + imageIds[0],
                label,
                true,
                imageIds[0]);
            await store.storeImageTraining(
                projectId,
                '/api/classes/' + TESTCLASS +
                    '/students/' + studentId +
                    '/projects/' + projectId +
                    '/images/' + imageIds[1],
                label,
                true,
                imageIds[1]);
            await store.storeImageTraining(
                projectId,
                '/api/classes/' + TESTCLASS +
                    '/students/' + studentId +
                    '/projects/' + projectId +
                    '/images/' + imageIds[2],
                label,
                true,
                imageIds[2]);

            await store.storeImageTraining(
                projectId,
                'http://existingimage.com/image.png',
                label,
                false);

            await request(testServer)
                .patch(url + '/' + projectId)
                .send([{
                    path : '/labels', op : 'remove',
                    value : label,
                }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            let jobCount = 0;
            let job = await store.getNextPendingJob();
            while (job) {
                assert.strictEqual(job.jobtype, 1);
                const jobdata: Types.ObjectSpec = job.jobdata as Types.ObjectSpec;
                assert.strictEqual(jobdata.projectid, projectId);
                assert.strictEqual(jobdata.userid, studentId);
                assert.strictEqual(jobdata.classid, TESTCLASS);
                assert(imageIds.includes(jobdata.objectid));

                jobCount += 1;

                await store.deletePendingJob(job);
                job = await store.getNextPendingJob();
            }

            assert.strictEqual(jobCount, 3);

            const count = await store.countTraining('images', projectId);
            assert.strictEqual(count, 0);
        });



        it('should replace labels', async () => {
            const projectDetails = { type : 'text', name : uuid(), language : 'en'  };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'student';

            const createRes = await request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            const projectId = createRes.body.id;

            let getRes = await request(testServer)
                .get(url + '/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(getRes.body.labels, []);

            await request(testServer)
                .patch(url + '/' + projectId)
                .send([{
                    path : '/labels', op : 'add',
                    value : 'newlabel',
                }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            getRes = await request(testServer)
                .get(url + '/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(getRes.body.labels, [ 'newlabel' ]);

            await request(testServer)
                .patch(url + '/' + projectId)
                .send([{
                    path : '/labels', op : 'replace',
                    value : [ 'apple', 'banana', 'tomato' ],
                }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            getRes = await request(testServer)
                .get(url + '/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(getRes.body.labels, [ 'apple', 'banana', 'tomato' ]);
        });



        it('should verify PATCH requests', async () => {
            const projectDetails = { type : 'text', name : uuid(), language : 'en'  };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserRole = 'student';
            nextAuth0UserTenant = TESTCLASS;

            const createRes = await request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            const projectId = createRes.body.id;

            let res = await request(testServer)
                .patch(url + '/' + projectId)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error: 'Missing data',
            });

            res = await request(testServer)
                .patch(url + '/' + projectId)
                .send({})
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error: 'PATCH body should be an array',
            });

            res = await request(testServer)
                .patch(url + '/' + projectId)
                .send([])
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error: 'Only individual PATCH requests are supported',
            });

            res = await request(testServer)
                .patch(url + '/' + projectId)
                .send([{ }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error: 'PATCH requests must include an op',
            });

            res = await request(testServer)
                .patch(url + '/' + projectId)
                .send([{ path : '/labels' }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error: 'PATCH requests must include an op',
            });

            res = await request(testServer)
                .patch(url + '/' + projectId)
                .send([{ path : '/labels', op : 'INVALID', value : [ 'BAD' ] }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error: 'Invalid PATCH op',
            });

            res = await request(testServer)
                .patch(url + '/' + projectId)
                .send([{ path : '/labels', op : 'add' }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error: 'PATCH requests must include a value',
            });

            res = await request(testServer)
                .patch(url + '/' + projectId)
                .send([{ path : '/labels', op : 'add', value : [ 'BAD' ] }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error: 'PATCH requests to add or remove a label should specify a string',
            });

            res = await request(testServer)
                .patch(url + '/' + projectId)
                .send([{ path : '/labels', op : 'add', value : ' ' }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error: 'Cannot add an empty label',
            });

            res = await request(testServer)
                .patch(url + '/' + projectId)
                .send([{
                    path : '/labels', op : 'add',
                    value : randomstring.generate({ length : 100 }),
                }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error: 'Label exceeds max length',
            });

            res = await request(testServer)
                .patch(url + '/' + projectId)
                .send([{
                    path : '/labels', op : 'replace',
                    value : 'should be an array',
                }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error: 'PATCH requests to replace labels should specify an array',
            });

            res = await request(testServer)
                .patch(url + '/' + projectId)
                .send([{
                    path : '/labels', op : 'replace',
                    value : [ 'test', randomstring.generate({ length : 100 }) ],
                }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error: 'Label exceeds max length',
            });

            await request(testServer)
                .patch('/api/classes/' + TESTCLASS + '/students/' + 'different' + '/projects' + '/' + projectId)
                .send([{
                    path : '/labels', op : 'add',
                    value : 'newlabel',
                }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);
        });

    });

});
