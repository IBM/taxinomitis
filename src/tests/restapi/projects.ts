/*eslint-env mocha */
import * as util from 'util';
import * as uuid from 'uuid/v1';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as randomstring from 'randomstring';

import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import testapiserver from './testserver';


let testServer;


const TESTCLASS = 'UNIQUECLASSID';


describe('REST API - projects', () => {

    let authStub;
    let checkUserStub;
    let requireSupervisorStub;

    function authNoOp(req, res, next) { next(); }


    before(async () => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
        checkUserStub = sinon.stub(auth, 'checkValidUser').callsFake(authNoOp);
        requireSupervisorStub = sinon.stub(auth, 'requireSupervisor').callsFake(authNoOp);
        proxyquire('../../lib/restapi/users', {
            './auth' : {
                authenticate : authStub,
                checkValidUser : checkUserStub,
                requireSupervisor : requireSupervisorStub,
            },
        });

        await store.init();

        testServer = testapiserver();

        return store.deleteProjectsByClassId(TESTCLASS);
    });

    after(async () => {
        authStub.restore();
        checkUserStub.restore();
        requireSupervisorStub.restore();

        await store.deleteProjectsByClassId(TESTCLASS);
        return store.disconnect();
    });


    describe('getProject()', () => {

        it('should handle requests for non-existent projects', () => {
            const classid = uuid();
            const studentid = uuid();
            const projectid = uuid();
            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + studentid + '/projects/' + projectid)
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    const body = res.body;
                    assert.equal(body.error, 'Not found');
                });
        });

        it('should verify class id', () => {
            const studentId = uuid();
            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';
            const INCORRECT_CLASS = uuid();

            return request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    const projectId = body.id;

                    return request(testServer)
                        .get('/api/classes/' + INCORRECT_CLASS + '/students/' + studentId + '/projects/' + projectId)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.FORBIDDEN);
                })
                .then((res) => {
                    const body = res.body;
                    assert.equal(body.error, 'Invalid access');
                });
        });

    });


    describe('deleteProject()', () => {

        it('should handle requests for non-existent projects', () => {
            const classid = uuid();
            const studentid = uuid();
            const projectid = uuid();
            return request(testServer)
                .del('/api/classes/' + classid + '/students/' + studentid + '/projects/' + projectid)
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    const body = res.body;
                    assert.equal(body.error, 'Not found');
                });
        });

        it('should delete project details', () => {
            let projectId;

            const studentId = uuid();
            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            return request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text' })
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
                    assert.equal(body.error, 'Not found');
                });
        });


        it('should verify class id', () => {
            const studentId = uuid();
            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';
            const INCORRECT_CLASS = uuid();

            return request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text' })
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
                    assert.equal(body.error, 'Invalid access');
                });
        });
    });


    describe('createProject()', () => {


        it('should respect tenant policies on project types', () => {
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            return request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'images' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN)
                .then((err) => {
                    assert.equal(err.body.error, 'Support for images projects is not enabled for your class');
                });
        });



        it('should respect tenant policies on number of projects', () => {
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            return request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then(() => {
                    return request(testServer)
                        .post(url)
                        .send({ name : uuid(), type : 'text' })
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.CREATED);
                })
                .then(() => {
                    return request(testServer)
                        .post(url)
                        .send({ name : uuid(), type : 'text' })
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.CREATED);
                })
                .then(() => {
                    return request(testServer)
                        .post(url)
                        .send({ name : uuid(), type : 'text' })
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.CONFLICT);
                })
                .then((err) => {
                    assert.equal(err.body.error, 'User already has maximum number of projects');
                });
        });


        it('should require a project type', () => {
            const projectDetails = { name : uuid() };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    const body = res.body;
                    assert.equal(body.error, 'Missing required field');
                });
        });


        it('should require fields for numbers projects', () => {
            const projectDetails = {
                name : uuid(),
                type : 'numbers',
            };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepEqual(res.body, { error : 'Fields required for numbers projects' });
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

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepEqual(res.body, { error : 'Fields required for numbers projects' });
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

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepEqual(res.body, { error : 'Missing required attributes' });
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

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepEqual(res.body, { error : 'Invalid field name' });
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

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepEqual(res.body, { error : 'Invalid field type something' });
                });
        });


        it('should store project details', () => {
            const projectDetails = {
                name : uuid(),
                type : 'text',
            };
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert.equal(body.userid, studentId);
                    assert.equal(body.classid, TESTCLASS);
                    assert.equal(body.type, projectDetails.type);
                    assert.equal(body.name, projectDetails.name);
                    assert(body.id);

                    return request(testServer)
                        .get(url + '/' + body.id)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.equal(body.userid, studentId);
                    assert.equal(body.classid, TESTCLASS);
                    assert.equal(body.type, projectDetails.type);
                    assert.equal(body.name, projectDetails.name);
                });
        });

    });


    describe('getProjectsByUserId()', () => {

        it('should cope with an empty list', () => {
            const classid = uuid();
            const studentid = uuid();
            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + studentid + '/projects')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert(util.isArray(body));
                    assert.equal(body.length, 0);
                });
        });


        it('should return projects for a user', () => {
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            return request(testServer)
                .post(url)
                .send({ name : uuid(), type : 'text' })
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
                    assert(util.isArray(body));
                    assert.equal(body.length, 1);

                    return request(testServer)
                        .post(url)
                        .send({ name : uuid(), type : 'text' })
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
                    assert(util.isArray(body));
                    assert.equal(body.length, 2);
                });
        });

    });


    describe('getProjectsByClassId()', () => {

        it('should cope with an empty list', () => {
            const classid = uuid();
            return request(testServer)
                .get('/api/classes/' + classid + '/projects')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert(util.isArray(body));
                    assert.equal(body.length, 0);
                });
        });


        it('should return projects for a class', () => {
            const studentA = uuid();
            const studentB = uuid();

            let count;

            return request(testServer)
                .get('/api/classes/' + TESTCLASS + '/projects')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert(util.isArray(body));
                    count = body.length;

                    return request(testServer)
                        .post('/api/classes/' + TESTCLASS + '/students/' + studentA + '/projects')
                        .send({ name : uuid(), type : 'text' })
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
                    assert(util.isArray(body));
                    assert.equal(body.length, count + 1);

                    count = body.length;

                    return request(testServer)
                        .post('/api/classes/' + TESTCLASS + '/students/' + studentB + '/projects')
                        .send({ name : uuid(), type : 'text' })
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
                    assert(util.isArray(body));
                    assert.equal(body.length, count + 1);
                });
        });


    });


    describe('modifyProjectLabels()', () => {

        it('should add a label', () => {
            const projectDetails = { type : 'text', name : uuid() };
            const studentId = uuid();
            let projectId;

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

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
                    assert.deepEqual(body.labels, []);

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
                    assert.deepEqual(body.labels, [ 'newlabel' ]);

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
                    assert.deepEqual(body.labels, [ 'newlabel', 'different' ]);

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
                    assert.deepEqual(body.labels, [ 'newlabel', 'different' ]);
                });
        });


        it('should remove a label', () => {
            const projectDetails = { type : 'text', name : uuid() };
            const studentId = uuid();
            let projectId;

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

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
                    assert.deepEqual(body.labels, []);

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
                    assert.deepEqual(body.labels, [ 'newlabel' ]);

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
                    assert.deepEqual(body.labels, []);
                });
        });


        it('should replace labels', () => {
            const projectDetails = { type : 'text', name : uuid() };
            const studentId = uuid();
            let projectId;

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

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
                    assert.deepEqual(body.labels, []);

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
                    assert.deepEqual(body.labels, [ 'newlabel' ]);

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
                    assert.deepEqual(body.labels, [ 'apple', 'banana', 'tomato' ]);
                });
        });



        it('should verify PATCH requests', () => {
            const projectDetails = { type : 'text', name : uuid() };
            const studentId = uuid();
            let projectId;

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

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
                    assert.deepEqual(body, {
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
                    assert.deepEqual(body, {
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
                    assert.deepEqual(body, {
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
                    assert.deepEqual(body, {
                        error: 'Only modifications to project labels are supported',
                    });

                    return request(testServer)
                        .patch(url + '/' + projectId)
                        .send([{ path : '/labels' }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.BAD_REQUEST);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepEqual(body, {
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
                    assert.deepEqual(body, {
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
                    assert.deepEqual(body, {
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
                    assert.deepEqual(body, {
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
                    assert.deepEqual(body, {
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
                    assert.deepEqual(body, {
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
                    assert.deepEqual(body, {
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
                    assert.deepEqual(body, {
                        error: 'Label exceeds max length',
                    });

                    return request(testServer)
                        .patch('/api/classes/' + TESTCLASS + '/students/' + 'different' + '/projects' + '/' + projectId)
                        .send([{
                            path : '/labels', op : 'add',
                            value : 'newlabel',
                        }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.INTERNAL_SERVER_ERROR);
                });
        });

    });

});
