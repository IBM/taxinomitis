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
import * as nlc from '../../lib/training/nlc';
import * as Types from '../../lib/training/training-types';
import testapiserver from './testserver';



let testServer;


describe('REST API - models', () => {

    let authStub;
    let checkUserStub;
    let requireSupervisorStub;

    function authNoOp(req, res, next) { next(); }

    let getClassifiersStub;
    let trainClassifierStub;
    let testClassifierStub;
    let deleteClassifierStub;

    before(async () => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
        checkUserStub = sinon.stub(auth, 'checkValidUser').callsFake(authNoOp);
        requireSupervisorStub = sinon.stub(auth, 'requireSupervisor').callsFake(authNoOp);
        proxyquire('../../lib/restapi/models', {
            './auth' : {
                authenticate : authStub,
                checkValidUser : checkUserStub,
                requireSupervisor : requireSupervisorStub,
            },
        });

        getClassifiersStub = sinon.stub(nlc, 'getClassifierStatuses').callsFake((classid, classifiers) => {
            return new Promise((resolve) => {
                resolve(classifiers.map((classifier) => {
                    switch (classifier.classifierid) {
                    case 'good':
                        classifier.status = 'Available';
                        classifier.statusDescription = 'Happy fun times';
                        return classifier;
                    case 'busy':
                        classifier.status = 'Training';
                        classifier.statusDescription = 'Still going';
                        return classifier;
                    }
                }));
            });
        });
        trainClassifierStub = sinon.stub(nlc, 'trainClassifier').callsFake((uid, clsid, pjid, name) => {
            return new Promise((resolve) => {
                resolve({
                    classifier_id : 'NEW-CREATED',
                    name,
                    language : 'en',
                    created : new Date(Date.UTC(2017, 4, 4, 12, 0)),
                    url : 'http://nlc.service/api/classifiers/NEW-CREATED',
                    status : 'Training',
                    status_description : 'Training for this classifier is running',
                });
            });
        });
        testClassifierStub = sinon.stub(nlc, 'testClassifier').callsFake(() => {
            return new Promise((resolve) => {
                resolve([
                    { class_name : 'first', confidence : 0.8 },
                    { class_name : 'second', confidence : 0.15 },
                    { class_name : 'third', confidence : 0.05 },
                ]);
            });
        });
        deleteClassifierStub = sinon.stub(nlc, 'deleteClassifier').callsFake(() => {
            return new Promise((resolve) => { resolve(); });
        });
        proxyquire('../../lib/restapi/models', {
            '../training/nlc' : {
                getClassifierStatuses : getClassifiersStub,
                trainClassifier : trainClassifierStub,
                testClassifier : testClassifierStub,
                deleteClassifier : deleteClassifierStub,
            },
        });

        await store.init();

        testServer = testapiserver();
    });


    after(() => {
        authStub.restore();
        checkUserStub.restore();
        requireSupervisorStub.restore();

        getClassifiersStub.restore();
        trainClassifierStub.restore();
        testClassifierStub.restore();
        deleteClassifierStub.restore();

        return store.disconnect();
    });



    describe('getModels', () => {

        it('should verify project exists', () => {
            const classid = uuid();
            const studentid = uuid();
            const projectid = uuid();
            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + studentid + '/projects/' + projectid + '/models')
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

            const project = await store.storeProject(userid, classid, 'text', 'demo');
            const projectid = project.id;

            return request(testServer)
                .get('/api/classes/' + classid + '/students/DIFFERENTUSER/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN)
                .then(() => {
                    return store.deleteProject(projectid);
                });
        });


        it('should handle projects without classifiers', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo');
            const projectid = project.id;

            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.deepEqual(body, []);

                    return store.deleteProject(projectid);
                });
        });



        it('should handle image projects without classifiers', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'images', 'demo');
            const projectid = project.id;

            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.deepEqual(body, []);

                    return store.deleteProject(projectid);
                });
        });


        it('should retrieve classifiers', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo');
            const projectid = project.id;

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : uuid(),
                password : uuid(),
                servicetype : 'nlc',
                url : uuid(),
            };

            const createdA = new Date();
            createdA.setMilliseconds(0);

            const classifierAInfo: Types.NLCClassifier = {
                classifierid : 'good',
                created : createdA,
                language : 'en',
                name : 'DUMMY ONE',
                url : uuid(),
            };
            await store.storeNLCClassifier(credentials, userid, classid, projectid,
                classifierAInfo);

            const createdB = new Date();
            createdB.setMilliseconds(0);

            const classifierBInfo: Types.NLCClassifier = {
                classifierid : 'busy',
                created : createdB,
                language : 'en',
                name : 'DUMMY TWO',
                url : uuid(),
            };
            await store.storeNLCClassifier(credentials, userid, classid, projectid,
                classifierBInfo);


            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    assert.deepEqual(res.body, [
                        {
                            classifierid : 'good',
                            created : createdA.toISOString(),
                            name : 'DUMMY ONE',
                            status : 'Available',
                            statusDescription : 'Happy fun times',
                        },
                        {
                            classifierid : 'busy',
                            created : createdB.toISOString(),
                            name : 'DUMMY TWO',
                            status : 'Training',
                            statusDescription : 'Still going',
                        },
                    ]);

                    await store.deleteProject(projectid);
                    await store.deleteNLCClassifiersByProjectId(projectid);
                });

        });

    });

    describe('newModel', () => {

        it('should verify project exists', () => {
            const classid = uuid();
            const studentid = uuid();
            const projectid = uuid();
            return request(testServer)
                .post('/api/classes/' + classid + '/students/' + studentid + '/projects/' + projectid + '/models')
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

            const project = await store.storeProject(userid, classid, 'text', 'demo');
            const projectid = project.id;

            return request(testServer)
                .post('/api/classes/' + classid + '/students/DIFFERENTUSER/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN)
                .then(() => {
                    return store.deleteProject(projectid);
                });
        });

        it('should reject training for non-text projects', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'images', 'demo');
            const projectid = project.id;

            return request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_IMPLEMENTED)
                .then(() => {
                    return store.deleteProject(projectid);
                });
        });


        it('should train new NLC classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();

            const project = await store.storeProject(userid, classid, 'text', projName);
            const projectid = project.id;

            return request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;

                    assert.deepEqual(body, {
                        created : '2017-05-04T12:00:00.000Z',
                        name : projName,
                        status : 'Training',
                    });

                    return store.deleteProject(projectid);
                });
        });
    });


    describe('testModel', () => {

        it('should require a model type', () => {
            return request(testServer)
                .post('/api/classes/' + 'classid' +
                        '/students/' + 'userid' +
                        '/projects/' + 'projectid' +
                        '/models/' + 'modelid' +
                        '/label')
                .send({
                    text : 'my test text',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((resp) => {
                    assert.deepEqual(resp.body, { error : 'Missing data' });
                });
        });


        it('should require text to test with', () => {
            return request(testServer)
                .post('/api/classes/' + 'classid' +
                        '/students/' + 'userid' +
                        '/projects/' + 'projectid' +
                        '/models/' + 'modelid' +
                        '/label')
                .send({
                    type : 'text',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((resp) => {
                    assert.deepEqual(resp.body, { error : 'Missing data' });
                });
        });


        it('should submit a classify request to NLC', async () => {

            const classid = uuid();
            const userid = uuid();
            const projName = uuid();
            const modelid = randomstring.generate({ length : 10 });

            const project = await store.storeProject(userid, classid, 'text', projName);
            const projectid = project.id;

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : uuid(),
                password : uuid(),
                servicetype : 'nlc',
                url : uuid(),
            };
            await store.storeBluemixCredentials(classid, credentials);

            const created = new Date();
            created.setMilliseconds(0);

            const classifierInfo: Types.NLCClassifier = {
                classifierid : modelid,
                created,
                language : 'en',
                name : projName,
                url : uuid(),
            };
            await store.storeNLCClassifier(credentials, userid, classid, projectid,
                classifierInfo);

            return request(testServer)
                .post('/api/classes/' + classid +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/models/' + modelid +
                        '/label')
                .send({
                    text : 'my test text',
                    type : 'text',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body = res.body;

                    assert.deepEqual(body, [
                        { class_name : 'first', confidence : 0.8 },
                        { class_name : 'second', confidence : 0.15 },
                        { class_name : 'third', confidence : 0.05 },
                    ]);

                    await store.deleteProject(projectid);
                    await store.deleteNLCClassifier(projectid, userid, classid, classifierInfo.classifierid);
                    await store.deleteBluemixCredentials(credentials.id);
                });
        }).timeout(5000);

    });

    describe('deleteModel', () => {

        it('should verify project exists', () => {
            const classid = uuid();
            const studentid = uuid();
            const projectid = uuid();
            const modelid = uuid();
            return request(testServer)
                .delete('/api/classes/' + classid +
                        '/students/' + studentid +
                        '/projects/' + projectid +
                        '/models/' + modelid)
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
            const modelid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo');
            const projectid = project.id;

            return request(testServer)
                .delete('/api/classes/' + classid +
                        '/students/DIFFERENTUSER/projects/' + projectid +
                        '/models/' + modelid)
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN)
                .then(() => {
                    return store.deleteProject(projectid);
                });
        });


        it('should delete classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();
            const modelid = randomstring.generate({ length : 10 });

            const project = await store.storeProject(userid, classid, 'text', projName);
            const projectid = project.id;

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : uuid(),
                password : uuid(),
                servicetype : 'nlc',
                url : uuid(),
            };
            await store.storeBluemixCredentials(classid, credentials);

            const created = new Date();
            created.setMilliseconds(0);

            const classifierInfo: Types.NLCClassifier = {
                classifierid : modelid,
                created,
                language : 'en',
                name : projName,
                url : uuid(),
            };
            await store.storeNLCClassifier(credentials, userid, classid, projectid,
                classifierInfo);

            return request(testServer)
                .delete('/api/classes/' + classid +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/models/' + modelid)
                .expect(httpstatus.NO_CONTENT)
                .then(async () => {
                    await store.deleteProject(projectid);
                    await store.deleteNLCClassifier(projectid, userid, classid, classifierInfo.classifierid);
                    await store.deleteBluemixCredentials(credentials.id);
                });
        });

    });


});
