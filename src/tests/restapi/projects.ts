/*eslint-env mocha */
import { v1 as uuid } from 'uuid';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as randomstring from 'randomstring';
import * as express from 'express';

import * as auth0objects from '../../lib/auth0/auth-types';
import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import * as auth0users from '../../lib/auth0/users';
import * as Types from '../../lib/objectstore/types';
import testapiserver from './testserver';


let testServer: express.Express;


const TESTCLASS = 'UNIQUECLASSID';


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
        // @ts-ignore
        req.user = {
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

        return store.deleteProjectsByClassId(TESTCLASS);
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
        return store.disconnect();
    });


    describe('getProject()', () => {

        it('should handle requests for non-existent projects', () => {
            const classid = uuid();
            const studentid = uuid();
            const projectid = uuid();
            nextAuth0UserId = studentid;
            nextAuth0UserTenant = classid;
            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + studentid + '/projects/' + projectid)
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Not found');
                });
        });

        it('should verify class id', () => {
            const studentId = uuid();
            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';
            const INCORRECT_CLASS = uuid();

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            return request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text', language : 'en' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    const projectId = body.id;

                    nextAuth0UserTenant = INCORRECT_CLASS;

                    return request(testServer)
                        .get('/api/classes/' + INCORRECT_CLASS + '/students/' + studentId + '/projects/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.FORBIDDEN);
                })
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Invalid access');
                });
        });

        it('should fetch crowd-sourced projects', () => {
            const studentId = uuid();
            const teacherId = uuid();

            nextAuth0UserTenant = TESTCLASS;

            nextAuth0UserId = teacherId;
            nextAuth0UserRole = 'supervisor';

            let projectInfo: any;

            return request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/' + teacherId + '/projects')
                .send({ name : uuid(), type : 'text', language : 'en', isCrowdSourced : true })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    const projectId = body.id;
                    projectInfo = body;

                    nextAuth0UserId = studentId;
                    nextAuth0UserRole = 'student';

                    return request(testServer)
                        .get('/api/classes/' + TESTCLASS + '/students/' + teacherId + '/projects/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, projectInfo);
                });
        });

        it('should fetch own crowd-sourced projects', () => {
            const teacherId = uuid();

            nextAuth0UserTenant = TESTCLASS;

            nextAuth0UserId = teacherId;
            nextAuth0UserRole = 'supervisor';

            let projectInfo: any;

            return request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/' + teacherId + '/projects')
                .send({ name : uuid(), type : 'text', language : 'en', isCrowdSourced : true })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    const projectId = body.id;
                    projectInfo = body;

                    return request(testServer)
                        .get('/api/classes/' + TESTCLASS + '/students/' + teacherId + '/projects/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, projectInfo);
                });
        });


        it('should verify fetching crowd-sourced projects', () => {
            const studentId = uuid();
            const teacherId = uuid();

            nextAuth0UserTenant = TESTCLASS;

            nextAuth0UserId = teacherId;
            nextAuth0UserRole = 'supervisor';

            return request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/' + teacherId + '/projects')
                .send({ name : uuid(), type : 'text', language : 'en', isCrowdSourced : false })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    const projectId = body.id;

                    nextAuth0UserId = studentId;
                    nextAuth0UserRole = 'student';

                    return request(testServer)
                        .get('/api/classes/' + TESTCLASS + '/students/' + teacherId + '/projects/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.FORBIDDEN);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, {
                        error : 'Invalid access',
                    });
                });
        });

        it('should allow teachers to fetch non-crowd-sourced project for review', () => {
            const studentId = uuid();
            const teacherId = uuid();

            nextAuth0UserTenant = TESTCLASS;

            nextAuth0UserId = teacherId;
            nextAuth0UserRole = 'student';

            return request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects')
                .send({ name : uuid(), type : 'text', language : 'en', isCrowdSourced : false })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    const projectId = body.id;

                    nextAuth0UserId = teacherId;
                    nextAuth0UserRole = 'supervisor';

                    return request(testServer)
                        .get('/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                });
        });

        it('should prevent students fetching non-crowd-sourced project for review', () => {
            const studentId = uuid();
            const teacherId = uuid();

            nextAuth0UserTenant = TESTCLASS;

            nextAuth0UserId = teacherId;
            nextAuth0UserRole = 'student';

            return request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects')
                .send({ name : uuid(), type : 'text', language : 'en', isCrowdSourced : false })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    const projectId = body.id;

                    nextAuth0UserId = teacherId;
                    nextAuth0UserRole = 'student';

                    return request(testServer)
                        .get('/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.FORBIDDEN);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, {
                        error : 'Invalid access',
                    });
                });
        });
    });


    describe('deleteProject()', () => {

        it('should handle requests for non-existent projects', () => {
            const classid = uuid();
            const studentid = uuid();
            const projectid = uuid();
            nextAuth0UserId = studentid;
            nextAuth0UserTenant = classid;
            return request(testServer)
                .del('/api/classes/' + classid + '/students/' + studentid + '/projects/' + projectid)
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Not found');
                });
        });

        it('should delete project details', () => {
            let projectId: string;

            const studentId = uuid();
            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            return request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text', language : 'en' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    projectId = body.id;

                    return request(testServer)
                        .get(url + '/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then(() => {
                    return request(testServer)
                        .del(url + '/' + projectId)
                        .expect(httpstatus.NO_CONTENT);
                })
                .then(() => {
                    return request(testServer)
                        .get(url + '/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.NOT_FOUND);
                })
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Not found');
                });
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

            return request(testServer)
                .get(url + '/' + projectid)
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Not found');
                });
        });


        it('should verify class id', () => {
            const studentId = uuid();
            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';
            const INCORRECT_CLASS = uuid();
            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            return request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text', language : 'en' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    const projectId = body.id;

                    return request(testServer)
                        .del('/api/classes/' + INCORRECT_CLASS + '/students/' + studentId + '/projects/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.FORBIDDEN);
                })
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Invalid access');
                });
        });
    });


    describe('createProject()', () => {

        it('should reject unicode names that cannot be stored by in the DB', () => {
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            return request(testServer)
                .post(url)
                .send({ name : '⚽', type : 'text', language : 'en' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((err) => {
                    assert.strictEqual(err.body.error, 'Invalid project name');
                });
        });

        it('should respect tenant policies on project types', () => {
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            return request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'images' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN)
                .then((err) => {
                    assert.strictEqual(err.body.error, 'Support for images projects is not enabled for your class');
                });
        });



        it('should respect tenant policies on number of projects', () => {
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            return request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text', language : 'en' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then(() => {
                    return request(testServer)
                        .post(url)
                        .send({ name : uuid(), type : 'text', language : 'en'  })
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.CREATED);
                })
                .then(() => {
                    return request(testServer)
                        .post(url)
                        .send({ name : uuid(), type : 'text', language : 'en'  })
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.CREATED);
                })
                .then(() => {
                    return request(testServer)
                        .post(url)
                        .send({ name : uuid(), type : 'text', language : 'en'  })
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.CONFLICT);
                })
                .then((err) => {
                    assert.strictEqual(err.body.error, 'User already has maximum number of projects');
                });
        });


        it('should require a project type', () => {
            const projectDetails = { name : uuid() };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Missing required field');
                });
        });


        it('should require fields for numbers projects', () => {
            const projectDetails = {
                name : uuid(),
                type : 'numbers',
            };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Fields required for numbers projects' });
                });
        });


        it('should require non-empty fields for numbers projects', () => {
            const projectDetails = {
                name : uuid(),
                type : 'numbers',
                fields : [],
            };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Fields required for numbers projects' });
                });
        });


        it('should require really non-empty fields for numbers projects', () => {
            const projectDetails = {
                name : uuid(),
                type : 'numbers',
                fields : [ '' ],
            };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Missing required attributes' });
                });
        });


        it('should validate length of fields for numbers projects', () => {
            const projectDetails = {
                name : uuid(),
                type : 'numbers',
                fields : [ { type : 'number', name : 'abcdefghijklmnopqrstuv' } ],
            };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Invalid field name' });
                });
        });


        it('should verify the type of fields for numbers projects', () => {
            const projectDetails = {
                name : uuid(),
                type : 'numbers',
                fields : [ { type : 'something', name : 'failing' } ],
            };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Invalid field type something' });
                });
        });


        it('should store project details', () => {
            const projectDetails = {
                name : uuid(),
                type : 'text',
                language : 'it',
            };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.userid, studentId);
                    assert.strictEqual(body.classid, TESTCLASS);
                    assert.strictEqual(body.type, projectDetails.type);
                    assert.strictEqual(body.name, projectDetails.name);
                    assert.strictEqual(body.language, projectDetails.language);
                    assert.strictEqual(body.isCrowdSourced, false);
                    assert(body.id);

                    return request(testServer)
                        .get(url + '/' + body.id)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.userid, studentId);
                    assert.strictEqual(body.classid, TESTCLASS);
                    assert.strictEqual(body.type, projectDetails.type);
                    assert.strictEqual(body.name, projectDetails.name);
                    assert.strictEqual(body.language, projectDetails.language);
                    assert.strictEqual(body.isCrowdSourced, false);
                });
        });

        it('should store sounds project details', () => {
            const projectDetails = {
                name : uuid(),
                type : 'sounds',
            };
            const studentId = uuid();
            const classid = 'TESTTENANT';

            const url = '/api/classes/' + classid + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = classid;

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.userid, studentId);
                    assert.strictEqual(body.classid, classid);
                    assert.strictEqual(body.type, projectDetails.type);
                    assert.strictEqual(body.name, projectDetails.name);
                    assert.strictEqual(body.isCrowdSourced, false);
                    assert(body.id);

                    return request(testServer)
                        .get(url + '/' + body.id)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.userid, studentId);
                    assert.strictEqual(body.classid, classid);
                    assert.strictEqual(body.type, projectDetails.type);
                    assert.strictEqual(body.name, projectDetails.name);
                    assert.strictEqual(body.isCrowdSourced, false);
                    assert.deepStrictEqual(body.labels, ['_background_noise_']);
                });
        });

        it('should only allow teachers to create crowd-sourced projects', () => {
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

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN)
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, {
                        error : 'Only teachers or group leaders can create crowd-sourced projects',
                    });
                });
        });

        it('should store crowd-sourced projects', () => {
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

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.userid, studentId);
                    assert.strictEqual(body.classid, TESTCLASS);
                    assert.strictEqual(body.type, projectDetails.type);
                    assert.strictEqual(body.name, projectDetails.name);
                    assert.strictEqual(body.language, projectDetails.language);
                    assert.strictEqual(body.isCrowdSourced, true);
                    assert(body.id);

                    return request(testServer)
                        .get(url + '/' + body.id)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.userid, studentId);
                    assert.strictEqual(body.classid, TESTCLASS);
                    assert.strictEqual(body.type, projectDetails.type);
                    assert.strictEqual(body.name, projectDetails.name);
                    assert.strictEqual(body.language, projectDetails.language);
                    assert.strictEqual(body.isCrowdSourced, true);
                });
        });

    });


    describe('getProjectsByUserId()', () => {

        it('should cope with an empty list', () => {
            const classid = uuid();
            const studentid = uuid();
            nextAuth0UserId = studentid;
            nextAuth0UserTenant = classid;
            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + studentid + '/projects')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert(Array.isArray(body));
                    assert.strictEqual(body.length, 0);
                });
        });


        it('should return projects for a user', () => {
            const studentId = uuid();

            let count = 0;

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            return request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text', language : 'en' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then(() => {
                    return request(testServer)
                        .get(url)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert(Array.isArray(body));
                    assert(body.length > 0);
                    count = body.length;

                    return request(testServer)
                        .post(url)
                        .send({ name : uuid(), type : 'text', language : 'en' })
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.CREATED);
                })
                .then(() => {
                    return request(testServer)
                        .get(url)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert(Array.isArray(body));
                    assert.strictEqual(body.length, count + 1);
                });
        });


        function testCreateProject(classid: string, user: string, crowd: boolean): Promise<any> {
            return request(testServer)
                    .post('/api/classes/' + classid + '/students/' + user + '/projects')
                    .send({ name : uuid(), type : 'text', language : 'en', isCrowdSourced : crowd })
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.CREATED)
                    .then((res) => {
                        return res.body;
                    });
        }
        function testGetProjects(classid: string, user: string): Promise<any> {
            return request(testServer)
                    .get('/api/classes/' + classid + '/students/' + user + '/projects')
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.OK)
                    .then((res) => {
                        return res.body;
                    });
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

        it('should return crowd-sourced projects', () => {
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

            return testVerifyAll(classId, studentA, studentB, teacherId, expected)
                .then(() => {
                    return testCreateProject(classId, studentA, false);
                })
                .then((newproj) => {
                    expected.studentA.push(newproj);
                    return testVerifyAll(classId, studentA, studentB, teacherId, expected);
                })
                .then(() => {
                    return testCreateProject(classId, studentA, false);
                })
                .then((newproj) => {
                    expected.studentA.push(newproj);
                    return testVerifyAll(classId, studentA, studentB, teacherId, expected);
                })
                .then(() => {
                    return testCreateProject(classId, teacherId, true);
                })
                .then((newproj) => {
                    expected.studentA.push(newproj);
                    expected.studentB.push(newproj);
                    expected.teacher.push(newproj);
                    return testVerifyAll(classId, studentA, studentB, teacherId, expected);
                })
                .then(() => {
                    return testCreateProject(classId, studentB, false);
                })
                .then((newproj) => {
                    expected.studentB.push(newproj);
                    return testVerifyAll(classId, studentA, studentB, teacherId, expected);
                })
                .then(() => {
                    return testCreateProject(classId, teacherId, false);
                })
                .then((newproj) => {
                    expected.teacher.push(newproj);
                    return testVerifyAll(classId, studentA, studentB, teacherId, expected);
                })
                .then(() => {
                    return store.deleteProjectsByClassId(classId);
                });
        });

    });


    describe('getProjectsByClassId()', () => {

        it('should cope with an empty list', () => {
            const classid = uuid();
            nextAuth0UserRole = 'supervisor';
            nextAuth0UserTenant = classid;
            return request(testServer)
                .get('/api/classes/' + classid + '/projects')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert(Array.isArray(body));
                    assert.strictEqual(body.length, 0);
                });
        });


        it('should return projects for a class', () => {
            const studentA = uuid();
            const studentB = uuid();

            let count: number;

            nextAuth0UserId = 'teacher';
            nextAuth0UserRole = 'supervisor';
            nextAuth0UserTenant = TESTCLASS;
            return request(testServer)
                .get('/api/classes/' + TESTCLASS + '/projects')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert(Array.isArray(body));
                    count = body.length;

                    return request(testServer)
                        .post('/api/classes/' + TESTCLASS + '/students/' + studentA + '/projects')
                        .send({ name : uuid(), type : 'text', language : 'en' })
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.CREATED);
                })
                .then(() => {
                    return request(testServer)
                        .get('/api/classes/' + TESTCLASS + '/projects')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert(Array.isArray(body));
                    assert.strictEqual(body.length, count + 1);

                    count = body.length;

                    return request(testServer)
                        .post('/api/classes/' + TESTCLASS + '/students/' + studentB + '/projects')
                        .send({ name : uuid(), type : 'text', language : 'en' })
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.CREATED);
                })
                .then(() => {
                    return request(testServer)
                        .get('/api/classes/' + TESTCLASS + '/projects')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert(Array.isArray(body));
                    assert.strictEqual(body.length, count + 1);
                });
        });


    });


    describe('modifyProjectLabels()', () => {

        it('should add a label', () => {
            const projectDetails = { type : 'text', name : uuid(), language : 'en' };
            const studentId = uuid();
            let projectId: string;

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'student';

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    projectId = body.id;

                    return request(testServer)
                        .get(url + '/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body.labels, []);

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send([{
                            path : '/labels', op : 'add',
                            value : 'newlabel',
                        }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then(() => {
                    return request(testServer)
                        .get(url + '/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body.labels, [ 'newlabel' ]);

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send([{
                            path : '/labels', op : 'add',
                            value : 'different',
                        }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then(() => {
                    return request(testServer)
                        .get(url + '/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body.labels, [ 'newlabel', 'different' ]);

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send([{
                            path : '/labels', op : 'add',
                            value : 'newlabel',
                        }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then(() => {
                    return request(testServer)
                        .get(url + '/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body.labels, [ 'newlabel', 'different' ]);
                });
        });


        it('should remove a label', () => {
            const projectDetails = { type : 'text', name : uuid(), language : 'en' };
            const studentId = uuid();
            let projectId: string;

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'student';

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    projectId = body.id;

                    return request(testServer)
                        .get(url + '/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body.labels, []);

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send([{
                            path : '/labels', op : 'add',
                            value : 'newlabel',
                        }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then(() => {
                    return request(testServer)
                        .get(url + '/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body.labels, [ 'newlabel' ]);

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send([{
                            path : '/labels', op : 'remove',
                            value : 'newlabel',
                        }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then(() => {
                    return request(testServer)
                        .get(url + '/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body.labels, []);
                });
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



        it('should replace labels', () => {
            const projectDetails = { type : 'text', name : uuid(), language : 'en'  };
            const studentId = uuid();
            let projectId: string;

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'student';

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    projectId = body.id;

                    return request(testServer)
                        .get(url + '/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body.labels, []);

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send([{
                            path : '/labels', op : 'add',
                            value : 'newlabel',
                        }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then(() => {
                    return request(testServer)
                        .get(url + '/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body.labels, [ 'newlabel' ]);

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send([{
                            path : '/labels', op : 'replace',
                            value : [ 'apple', 'banana', 'tomato' ],
                        }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then(() => {
                    return request(testServer)
                        .get(url + '/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body.labels, [ 'apple', 'banana', 'tomato' ]);
                });
        });



        it('should verify PATCH requests', () => {
            const projectDetails = { type : 'text', name : uuid(), language : 'en'  };
            const studentId = uuid();
            let projectId: string;

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserRole = 'student';
            nextAuth0UserTenant = TESTCLASS;

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    projectId = body.id;

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.BAD_REQUEST);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, {
                        error: 'PATCH body should be an array',
                    });

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send({})
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.BAD_REQUEST);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, {
                        error: 'PATCH body should be an array',
                    });

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send([])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.BAD_REQUEST);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, {
                        error: 'Only individual PATCH requests are supported',
                    });

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send([{ }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.BAD_REQUEST);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, {
                        error: 'PATCH requests must include an op',
                    });

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send([{ path : '/labels' }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.BAD_REQUEST);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, {
                        error: 'PATCH requests must include an op',
                    });

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send([{ path : '/labels', op : 'INVALID', value : [ 'BAD' ] }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.BAD_REQUEST);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, {
                        error: 'Invalid PATCH op',
                    });

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send([{ path : '/labels', op : 'add' }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.BAD_REQUEST);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, {
                        error: 'PATCH requests must include a value',
                    });

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send([{ path : '/labels', op : 'add', value : [ 'BAD' ] }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.BAD_REQUEST);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, {
                        error: 'PATCH requests to add or remove a label should specify a string',
                    });

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send([{ path : '/labels', op : 'add', value : ' ' }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.BAD_REQUEST);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, {
                        error: 'Cannot add an empty label',
                    });

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send([{
                            path : '/labels', op : 'add',
                            value : randomstring.generate({ length : 100 }),
                        }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.BAD_REQUEST);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, {
                        error: 'Label exceeds max length',
                    });

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send([{
                            path : '/labels', op : 'replace',
                            value : 'should be an array',
                        }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.BAD_REQUEST);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, {
                        error: 'PATCH requests to replace labels should specify an array',
                    });

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send([{
                            path : '/labels', op : 'replace',
                            value : [ 'test', randomstring.generate({ length : 100 }) ],
                        }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.BAD_REQUEST);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, {
                        error: 'Label exceeds max length',
                    });

                    return request(testServer)
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

});
