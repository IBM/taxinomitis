/*eslint-env mocha */
import * as uuid from 'uuid/v1';
import * as assert from 'assert';
import * as request from 'supertest-as-promised';
import * as httpstatus from 'http-status';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as randomstring from 'randomstring';

import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import testapiserver from './testserver';



let testServer;


describe('REST API - training', () => {

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
    });


    after(() => {
        authStub.restore();
        checkUserStub.restore();
        requireSupervisorStub.restore();

        return store.disconnect();
    });


    describe('getLabels()', () => {

        it('should verify project exists', () => {
            const classid = uuid();
            const studentid = uuid();
            const projectid = uuid();
            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + studentid + '/projects/' + projectid + '/labels')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    const body = res.body;
                    assert.equal(body.error, 'Not found');
                });
        });


        it('should fetch empty training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'images', 'demo', []);
            const projectid = project.id;

            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/labels')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.deepEqual(body, []);

                    return store.deleteProject(projectid);
                });
        });


        it('should verify user id', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', []);
            const projectid = project.id;

            return request(testServer)
                .get('/api/classes/' + classid + '/students/DIFFERENTUSER/projects/' + projectid + '/labels')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN)
                .then(() => {
                    return store.deleteProject(projectid);
                });
        });


        it('should get training labels', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', []);
            const projectid = project.id;

            await store.storeTextTraining(projectid, 'apple', 'fruit');
            await store.storeTextTraining(projectid, 'banana', 'fruit');
            await store.storeTextTraining(projectid, 'tomato', 'vegetable');
            await store.storeTextTraining(projectid, 'cabbage', 'vegetable');
            await store.storeTextTraining(projectid, 'potato', 'vegetable');
            await store.storeTextTraining(projectid, 'beef', 'meat');

            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/labels')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body = res.body;
                    assert.deepEqual(body, {
                        fruit : 2, vegetable : 3, meat : 1,
                    });

                    await store.deleteProject(projectid);
                    await store.deleteTextTrainingByProjectId(projectid);
                });
        });
    });


    describe('storeTraining()', () => {

        it('should verify project exists', () => {
            const classid = uuid();
            const studentid = uuid();
            const projectid = uuid();
            return request(testServer)
                .post('/api/classes/' + classid + '/students/' + studentid + '/projects/' + projectid + '/training')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    const body = res.body;
                    assert.equal(body.error, 'Not found');
                });
        });

        it('should verify user id', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', []);
            const projectid = project.id;

            return request(testServer)
                .post('/api/classes/' + classid + '/students/DIFFERENTUSER/projects/' + projectid + '/training')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN)
                .then(() => {
                    return store.deleteProject(projectid);
                });
        });


        it('should require text data in training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', []);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            return request(testServer)
                .post(trainingurl)
                .send({
                    label : 'nothing-to-label',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {
                    const body = res.body;
                    assert.deepEqual(body, { error : 'Missing data' });

                    await store.deleteProject(projectid);
                    await store.deleteTextTrainingByProjectId(projectid);
                });
        });


        it('should require numeric data in training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', ['x']);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            return request(testServer)
                .post(trainingurl)
                .send({
                    label : 'nothing-to-label',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {
                    const body = res.body;
                    assert.deepEqual(body, { error : 'Missing data' });

                    await store.deleteProject(projectid);
                    await store.deleteNumberTrainingByProjectId(projectid);
                });
        });


        it('should require non-empty numeric data in training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', [ 'x' ]);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            return request(testServer)
                .post(trainingurl)
                .send({
                    label : 'nothing-to-label',
                    data : [],
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {
                    const body = res.body;
                    assert.deepEqual(body, { error : 'Missing required attributes' });

                    await store.deleteProject(projectid);
                    await store.deleteNumberTrainingByProjectId(projectid);
                });
        });


        it('should limit maximum length of text training data', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', []);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            return request(testServer)
                .post(trainingurl)
                .send({
                    data : randomstring.generate({ length : 1100 }),
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {
                    const body = res.body;

                    assert.deepEqual(body, { error : 'Text exceeds maximum allowed length (1024 characters)' });

                    await store.deleteProject(projectid);
                    await store.deleteTextTrainingByProjectId(projectid);
                });
        });


        it('should limit maximum number of numeric training data', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', [
                'one', 'two', 'three',
            ]);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            return request(testServer)
                .post(trainingurl)
                .send({
                    data : [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100],
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {
                    const body = res.body;

                    assert.deepEqual(body, { error : 'Number of data items exceeded maximum' });

                    await store.deleteProject(projectid);
                    await store.deleteNumberTrainingByProjectId(projectid);
                });
        });


        it('should store numeric training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', ['first', 'second', 'third']);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            return request(testServer)
                .post(trainingurl)
                .send({
                    data : [1, 2, 3],
                    label : 'fruit',
                })
                .expect(httpstatus.CREATED)
                .then(async () => {
                    await store.deleteProject(projectid);
                    await store.deleteNumberTrainingByProjectId(projectid);
                });
        });


        it('should store non-text training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'images', 'demo', []);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            return request(testServer)
                .post(trainingurl)
                .send({
                    data : 'apple',
                    label : 'fruit',
                })
                .expect(httpstatus.NOT_IMPLEMENTED)
                .then(async () => {
                    await store.deleteProject(projectid);
                    await store.deleteTextTrainingByProjectId(projectid);
                });
        });


        it('should store training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', []);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            return request(testServer)
                .post(trainingurl)
                .send({
                    data : 'apple',
                    label : 'fruit',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then(() => {
                    return request(testServer)
                        .get(trainingurl)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then(async (res) => {
                    const body = res.body;
                    assert.equal(body.length, 1);
                    assert.equal(res.header['content-range'], 'items 0-0/1');

                    assert.equal(body[0].textdata, 'apple');
                    assert.equal(body[0].label, 'fruit');

                    await store.deleteProject(projectid);
                    await store.deleteTextTrainingByProjectId(projectid);
                });
        });
    });



    describe('editLabel()', () => {

        it('should verify request', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', ['one', 'two']);
            const projectid = project.id;

            const projecturl = '/api/classes/' + classid +
                               '/students/' + userid +
                               '/projects/' + projectid;

            return request(testServer)
                .post(projecturl + '/training')
                .send({
                    data : [0.01, 0.02],
                    label : 'fruit',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then(() => {
                    return request(testServer)
                        .put(projecturl + '/labels')
                        .send({
                            after : 'healthy',
                        })
                        .expect(httpstatus.BAD_REQUEST);
                })
                .then((res) => {
                    const body = res.body;

                    assert.deepEqual(body, { error : 'Missing data' });

                    return request(testServer)
                        .get(projecturl + '/training')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then(async (res) => {
                    const body = res.body;
                    assert.equal(body.length, 1);
                    assert.equal(res.header['content-range'], 'items 0-0/1');

                    assert.deepEqual(body[0].numberdata, [0.01, 0.02]);
                    assert.equal(body[0].label, 'fruit');

                    await store.deleteProject(projectid);
                    await store.deleteNumberTrainingByProjectId(projectid);
                });
        });


        it('should edit training label', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', []);
            const projectid = project.id;

            const projecturl = '/api/classes/' + classid +
                               '/students/' + userid +
                               '/projects/' + projectid;

            return request(testServer)
                .post(projecturl + '/training')
                .send({
                    data : 'apple',
                    label : 'fruit',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then(() => {
                    return request(testServer)
                        .put(projecturl + '/labels')
                        .send({
                            before : 'fruit',
                            after : 'healthy',
                        })
                        .expect(httpstatus.OK);
                })
                .then(() => {
                    return request(testServer)
                        .get(projecturl + '/training')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then(async (res) => {
                    const body = res.body;
                    assert.equal(body.length, 1);
                    assert.equal(res.header['content-range'], 'items 0-0/1');

                    assert.equal(body[0].textdata, 'apple');
                    assert.equal(body[0].label, 'healthy');

                    await store.deleteProject(projectid);
                    await store.deleteTextTrainingByProjectId(projectid);
                });
        });

    });



    describe('getTraining()', () => {

        it('should verify project exists', () => {
            const classid = uuid();
            const studentid = uuid();
            const projectid = uuid();
            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + studentid + '/projects/' + projectid + '/training')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    const body = res.body;
                    assert.equal(body.error, 'Not found');
                });
        });


        it('should fetch empty training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'images', 'demo', []);
            const projectid = project.id;

            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/training')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.deepEqual(body, []);

                    return store.deleteProject(projectid);
                });
        });


        it('should verify user id', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', []);
            const projectid = project.id;

            return request(testServer)
                .get('/api/classes/' + classid + '/students/DIFFERENTUSER/projects/' + projectid + '/training')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN)
                .then(() => {
                    return store.deleteProject(projectid);
                });
        });


        it('should get training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', []);
            const projectid = project.id;

            const data = [];

            for (let labelIdx = 0; labelIdx < 2; labelIdx++) {
                const label = uuid();

                for (let text = 0; text < 3; text++) {
                    const textdata = uuid();

                    data.push({ textdata, label });
                }
            }

            await store.bulkStoreTextTraining(projectid, data);

            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/training')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body = res.body;
                    assert.equal(body.length, 6);

                    body.forEach((item) => {
                        assert(item.id);
                        assert(item.label);
                        assert(item.textdata);
                    });

                    await store.deleteProject(projectid);
                    await store.deleteTextTrainingByProjectId(projectid);
                });
        });


        it('should get a page of training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', []);
            const projectid = project.id;

            const data = [];

            for (let labelIdx = 0; labelIdx < 4; labelIdx++) {
                const label = uuid();

                for (let text = 0; text < 5; text++) {
                    const textdata = uuid();

                    data.push({ textdata, label });
                }
            }

            await store.bulkStoreTextTraining(projectid, data);

            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/training')
                .set('Range', 'items=0-9')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body = res.body;
                    assert.equal(body.length, 10);

                    body.forEach((item) => {
                        assert(item.id);
                        assert(item.label);
                        assert(item.textdata);
                    });

                    assert.equal(res.header['content-range'], 'items 0-9/20');

                    await store.deleteProject(projectid);
                    await store.deleteTextTrainingByProjectId(projectid);
                });
        });



        it('should get a page of numeric training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo',
                ['one', 'two', 'three', 'four', 'five']);
            const projectid = project.id;

            const data = [];

            for (let labelIdx = 0; labelIdx < 4; labelIdx++) {
                const label = uuid();

                for (let text = 0; text < 5; text++) {
                    const numberdata = [1, 2, labelIdx, text, labelIdx * text ];

                    data.push({ numberdata, label });
                }
            }

            await store.bulkStoreNumberTraining(projectid, data);

            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/training')
                .set('Range', 'items=0-9')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body = res.body;
                    assert.equal(body.length, 10);

                    body.forEach((item) => {
                        assert(item.id);
                        assert(item.label);
                        assert(item.numberdata);
                        assert.equal(item.numberdata.length, 5);
                        for (const num of item.numberdata) {
                            assert(!isNaN(num));
                        }
                    });

                    assert.equal(res.header['content-range'], 'items 0-9/20');

                    await store.deleteProject(projectid);
                    await store.deleteNumberTrainingByProjectId(projectid);
                });
        });
    });


    describe('deleteTraining()', () => {

        it('should verify permissions', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', []);
            const projectid = project.id;

            const apple = await store.storeTextTraining(projectid, 'apple', 'fruit');
            const banana = await store.storeTextTraining(projectid, 'banana', 'fruit');

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            return request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.equal(body.length, 2);
                    assert.equal(res.header['content-range'], 'items 0-1/2');

                    return request(testServer)
                        .delete('/api/classes/' + classid +
                                '/students/' + 'differentuserid' +
                                '/projects/' + projectid +
                                '/training/' + apple.id)
                        .expect(httpstatus.FORBIDDEN);
                })
                .then(() => {
                    return request(testServer)
                        .delete('/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + 'differentprojectid' +
                                '/training/' + banana.id)
                        .expect(httpstatus.NOT_FOUND);
                })
                .then(() => {
                    return request(testServer)
                        .get(trainingurl)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK)
                        .then((res) => {
                            const body = res.body;
                            assert.equal(body.length, 2);
                            assert.equal(res.header['content-range'], 'items 0-1/2');
                        });
                })
                .then(() => {
                    return request(testServer)
                        .delete('/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training/' + banana.id)
                        .expect(httpstatus.NO_CONTENT);
                })
                .then(() => {
                    return request(testServer)
                        .get(trainingurl)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK)
                        .then((res) => {
                            const body = res.body;
                            assert.equal(body.length, 1);
                            assert.equal(res.header['content-range'], 'items 0-0/1');
                        });
                })
                .then(async () => {
                    await store.deleteProject(projectid);
                    await store.deleteTextTrainingByProjectId(projectid);
                });
        });


        it('should delete training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', []);
            const projectid = project.id;

            await store.storeTextTraining(projectid, 'apple', 'fruit');
            await store.storeTextTraining(projectid, 'banana', 'fruit');

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            return request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.equal(body.length, 2);
                    assert.equal(res.header['content-range'], 'items 0-1/2');

                    return request(testServer)
                        .delete(trainingurl + '/' + body[0].id)
                        .expect(httpstatus.NO_CONTENT);
                })
                .then(() => {
                    return request(testServer)
                        .get(trainingurl)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK)
                        .then((res) => {
                            const body = res.body;
                            assert.equal(body.length, 1);
                            assert.equal(res.header['content-range'], 'items 0-0/1');
                        });
                })
                .then(async () => {
                    await store.deleteProject(projectid);
                    await store.deleteTextTrainingByProjectId(projectid);
                });
        });


        it('should delete numeric training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', ['field']);
            const projectid = project.id;

            await store.storeNumberTraining(projectid, [100], 'fruit');
            await store.storeNumberTraining(projectid, [123], 'fruit');

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            return request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.equal(body.length, 2);
                    assert.equal(res.header['content-range'], 'items 0-1/2');

                    return request(testServer)
                        .delete(trainingurl + '/' + body[0].id)
                        .expect(httpstatus.NO_CONTENT);
                })
                .then(() => {
                    return request(testServer)
                        .get(trainingurl)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK)
                        .then((res) => {
                            const body = res.body;
                            assert.equal(body.length, 1);
                            assert.equal(res.header['content-range'], 'items 0-0/1');
                        });
                })
                .then(async () => {
                    await store.deleteProject(projectid);
                    await store.deleteNumberTrainingByProjectId(projectid);
                });
        });

    });





    describe('deleteProject()', () => {

        it('should delete everything', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', []);
            const projectid = project.id;

            await store.addLabelToProject(userid, classid, projectid, 'animal');
            await store.addLabelToProject(userid, classid, projectid, 'vegetable');
            await store.addLabelToProject(userid, classid, projectid, 'mineral');

            await store.storeTextTraining(projectid, 'tomato', 'vegetable');
            await store.storeTextTraining(projectid, 'giraffe', 'animal');
            await store.storeTextTraining(projectid, 'zebra', 'animal');

            const projecturl = '/api/classes/' + classid +
                               '/students/' + userid +
                               '/projects/' + projectid;

            return request(testServer)
                .delete(projecturl)
                .expect(httpstatus.NO_CONTENT)
                .then(async () => {
                    const count = await store.countTextTraining(projectid);
                    assert.equal(count, 0);

                    try {
                        await store.getProject(projectid);
                        assert.fail(0, 1, 'should not be here', '');
                    }
                    catch (err) {
                        assert(err);
                    }
                });
        });

    });

});
