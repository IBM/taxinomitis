/*eslint-env mocha */
import * as uuid from 'uuid/v1';
import * as assert from 'assert';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as randomstring from 'randomstring';

import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import * as conversation from '../../lib/training/conversation';
import * as numbers from '../../lib/training/numbers';
import * as Types from '../../lib/training/training-types';
import testapiserver from './testserver';



let testServer;


describe('REST API - models', () => {

    let authStub;
    let checkUserStub;
    let requireSupervisorStub;

    function authNoOp(req, res, next) { next(); }

    const conversationStub = {
        getClassifiersStub : undefined,
        trainClassifierStub : undefined,
        testClassifierStub : undefined,
        deleteClassifierStub : undefined,
    };
    const numbersStub = {
        getClassifiersStub : undefined,
        trainClassifierStub : undefined,
        testClassifierStub : undefined,
        deleteClassifierStub : undefined,
    };

    const updated = new Date();
    updated.setMilliseconds(0);


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

        conversationStub.getClassifiersStub = sinon.stub(conversation, 'getClassifierStatuses');
        conversationStub.getClassifiersStub.callsFake((classid, classifiers: Types.ConversationWorkspace[]) => {
            return new Promise((resolve) => {
                resolve(classifiers.map((classifier) => {
                    classifier.updated = updated;

                    switch (classifier.workspace_id) {
                    case 'good':
                        classifier.status = 'Available';
                        return classifier;
                    case 'busy':
                        classifier.status = 'Training';
                        return classifier;
                    }
                }));
            });
        });
        conversationStub.trainClassifierStub = sinon.stub(conversation, 'trainClassifier');
        conversationStub.trainClassifierStub.callsFake((uid, clsid, pj) => {
            const workspace: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : 'NEW-CREATED',
                credentialsid : '123',
                name : pj.name,
                language : 'en',
                created : new Date(Date.UTC(2017, 4, 4, 12, 0)),
                updated : new Date(Date.UTC(2017, 4, 4, 12, 1)),
                expiry : new Date(Date.UTC(2017, 4, 4, 13, 0)),
                url : 'http://conversation.service/api/classifiers/NEW-CREATED',
                status : 'Training',
            };
            return Promise.resolve(workspace);
        });
        conversationStub.testClassifierStub = sinon.stub(conversation, 'testClassifier').callsFake(() => {
            const classifications: Types.Classification[] = [
                { class_name : 'first', confidence : 0.8 },
                { class_name : 'second', confidence : 0.15 },
                { class_name : 'third', confidence : 0.05 },
            ];
            return Promise.resolve(classifications);
        });
        conversationStub.deleteClassifierStub = sinon.stub(conversation, 'deleteClassifier').callsFake(() => {
            return new Promise((resolve) => { resolve(); });
        });

        numbersStub.trainClassifierStub = sinon.stub(numbers, 'trainClassifier').callsFake((uid, clsid, pjid) => {
            return Promise.resolve({
                created : new Date(),
                status : 'Available',
                classifierid : pjid,
            });
        });
        numbersStub.testClassifierStub = sinon.stub(numbers, 'testClassifier').callsFake(() => {
            const classifications: Types.Classification[] = [
                { class_name : 'first', confidence : 0.8 },
                { class_name : 'second', confidence : 0.15 },
                { class_name : 'third', confidence : 0.05 },
            ];
            return Promise.resolve(classifications);
        });
        numbersStub.deleteClassifierStub = sinon.stub(numbers, 'deleteClassifier').callsFake(() => {
            return new Promise((resolve) => { resolve(); });
        });


        proxyquire('../../lib/restapi/models', {
            '../training/conversation' : {
                getClassifierStatuses : conversationStub.getClassifiersStub,
                trainClassifier : conversationStub.trainClassifierStub,
                testClassifier : conversationStub.testClassifierStub,
                deleteClassifier : conversationStub.deleteClassifierStub,
            },
            '../training/numbers' : {
                trainClassifier : numbersStub.trainClassifierStub,
                testClassifier : numbersStub.testClassifierStub,
                deleteClassifier : numbersStub.deleteClassifierStub,
            },
        });

        await store.init();

        testServer = testapiserver();
    });


    after(() => {
        authStub.restore();
        checkUserStub.restore();
        requireSupervisorStub.restore();

        conversationStub.getClassifiersStub.restore();
        conversationStub.trainClassifierStub.restore();
        conversationStub.testClassifierStub.restore();
        conversationStub.deleteClassifierStub.restore();
        numbersStub.trainClassifierStub.restore();
        numbersStub.testClassifierStub.restore();
        numbersStub.deleteClassifierStub.restore();

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

            const project = await store.storeProject(userid, classid, 'text', 'demo', []);
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

            const project = await store.storeProject(userid, classid, 'text', 'demo', []);
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

            const project = await store.storeProject(userid, classid, 'images', 'demo', []);
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


        it('should retrieve numbers classifiers', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', ['a', 'b']);
            const projectid = project.id;

            const classifier = await store.storeNumbersClassifier(userid, classid, projectid, 'Available');
            const created = classifier.created;
            created.setMilliseconds(0);

            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    assert.deepEqual(res.body, [
                        {
                            classifierid : projectid,
                            created : created.toISOString(),
                            status : 'Available',
                        },
                    ]);

                    await store.deleteEntireProject(userid, classid, project);
                });
        });


        it('should retrieve text classifiers', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', []);
            const projectid = project.id;

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : uuid(),
                password : uuid(),
                servicetype : 'conv',
                url : uuid(),
            };

            const createdA = new Date();
            createdA.setMilliseconds(0);

            const classifierAInfo: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : 'good',
                credentialsid : credentials.id,
                created : createdA,
                expiry : createdA,
                language : 'en',
                name : 'DUMMY ONE',
                url : uuid(),
            };
            await store.storeConversationWorkspace(credentials, userid, classid, projectid,
                classifierAInfo);

            const createdB = new Date();
            createdB.setMilliseconds(0);

            const classifierBInfo: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : 'busy',
                credentialsid : credentials.id,
                created : createdB,
                expiry : createdB,
                language : 'en',
                name : 'DUMMY TWO',
                url : uuid(),
            };
            await store.storeConversationWorkspace(credentials, userid, classid, projectid,
                classifierBInfo);


            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {

                    assert.deepEqual(res.body, [
                        {
                            classifierid : 'busy',
                            credentialsid : credentials.id,
                            updated : updated.toISOString(),
                            expiry : createdB.toISOString(),
                            name : 'DUMMY TWO',
                            status : 'Training',
                        },
                        {
                            classifierid : 'good',
                            credentialsid : credentials.id,
                            updated : updated.toISOString(),
                            expiry : createdA.toISOString(),
                            name : 'DUMMY ONE',
                            status : 'Available',
                        },
                    ]);

                    await store.deleteProject(projectid);
                    await store.deleteConversationWorkspacesByProjectId(projectid);
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

            const project = await store.storeProject(userid, classid, 'text', 'demo', []);
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

            const project = await store.storeProject(userid, classid, 'images', 'demo', []);
            const projectid = project.id;

            return request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_IMPLEMENTED)
                .then(() => {
                    return store.deleteProject(projectid);
                });
        });


        // TODO - CHANGE HOW WE MANAGE THIS
        // it('should enforce tenant policies on number of NLC classifiers', async () => {
        //     const classid = uuid();
        //     const userid = uuid();
        //     const projName = uuid();

        //     const project = await store.storeProject(userid, classid, 'text', projName, []);
        //     const projectid = project.id;

        //     const credentials: Types.BluemixCredentials = {
        //         id : uuid(),
        //         username : uuid(),
        //         password : uuid(),
        //         servicetype : 'conv',
        //         url : uuid(),
        //     };

        //     for (let i = 0; i < 10; i++) {
        //         await store.storeConversationWorkspace(credentials, userid, classid, projectid, {
        //             workspace_id : randomstring.generate({ length : 8 }),
        //             created : new Date(),
        //             language : 'en',
        //             name : projName,
        //             url : uuid(),
        //         });
        //     }

        //     return request(testServer)
        //         .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
        //         .expect('Content-Type', /json/)
        //         .expect(httpstatus.CONFLICT)
        //         .then(async (res) => {
        //             const body = res.body;

        //            assert.equal(body.error, 'Your class already has created their maximum allowed number of models');

        //             await store.deleteProject(projectid);
        //             await store.deleteConversationWorkspacesByProjectId(projectid);
        //         });
        // });


        it('should train new text classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();

            const project = await store.storeProject(userid, classid, 'text', projName, []);
            const projectid = project.id;

            return request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;

                    assert.deepEqual(body, {
                        updated : '2017-05-04T12:01:00.000Z',
                        expiry : '2017-05-04T13:00:00.000Z',
                        name : projName,
                        status : 'Training',
                        classifierid : 'NEW-CREATED',
                        credentialsid : '123',
                    });

                    return store.deleteProject(projectid);
                });
        });


        it('should train new numbers classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', projName, ['a', 'b']);
            const projectid = project.id;

            return request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;

                    assert.equal(body.status, 'Available');
                    assert.equal(body.classifierid, projectid);

                    const created = new Date(body.created);
                    assert.equal(isNaN(created.getDate()), false);

                    return store.deleteEntireProject(userid, classid, project);
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
                    credentialsid : 'HELLO',
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
                    credentialsid : 'HELLO',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((resp) => {
                    assert.deepEqual(resp.body, { error : 'Missing data' });
                });
        });

        it('should require credentials to test with', () => {
            return request(testServer)
                .post('/api/classes/' + 'classid' +
                        '/students/' + 'userid' +
                        '/projects/' + 'projectid' +
                        '/models/' + 'modelid' +
                        '/label')
                .send({
                    type : 'text',
                    text : 'HELLO',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((resp) => {
                    assert.deepEqual(resp.body, { error : 'Missing data' });
                });
        });


        it('should submit a classify request to Conversation', async () => {

            const classid = uuid();
            const userid = uuid();
            const projName = uuid();
            const modelid = randomstring.generate({ length : 10 });

            const project = await store.storeProject(userid, classid, 'text', projName, []);
            const projectid = project.id;

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : uuid(),
                password : uuid(),
                servicetype : 'conv',
                url : uuid(),
            };
            await store.storeBluemixCredentials(classid, credentials);

            const created = new Date();
            created.setMilliseconds(0);

            const classifierInfo: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : modelid,
                credentialsid : credentials.id,
                created,
                expiry : created,
                language : 'en',
                name : projName,
                url : uuid(),
            };
            await store.storeConversationWorkspace(credentials, userid, classid, projectid,
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
                    credentialsid : credentials.id,
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
                    await store.deleteConversationWorkspace(classifierInfo.id);
                    await store.deleteBluemixCredentials(credentials.id);
                });
        });

        it('should submit a classify request to numbers service', () => {
            return request(testServer)
                .post('/api/classes/testclass/students/testuser/projects/testproject/models/testmodel/label')
                .send({
                    numbers : [1, 2, 3],
                    type : 'numbers',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;

                    assert.deepEqual(body, [
                        { class_name : 'first', confidence : 0.8 },
                        { class_name : 'second', confidence : 0.15 },
                        { class_name : 'third', confidence : 0.05 },
                    ]);
                });
        });

        it('should require data for the numbers service', () => {
            return request(testServer)
                .post('/api/classes/testclass/students/testuser/projects/testproject/models/testmodel/label')
                .send({
                    type : 'numbers',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);
        });

        it('should require numbers for the numbers service', () => {
            return request(testServer)
                .post('/api/classes/testclass/students/testuser/projects/testproject/models/testmodel/label')
                .send({
                    numbers : [],
                    type : 'numbers',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);
        });

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

            const project = await store.storeProject(userid, classid, 'text', 'demo', []);
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


        it('should delete numbers classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();
            const modelid = randomstring.generate({ length : 10 });

            const project = await store.storeProject(userid, classid, 'numbers', projName, ['A']);
            const projectid = project.id;

            return request(testServer)
                .delete('/api/classes/' + classid +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/models/' + modelid)
                .expect(httpstatus.NO_CONTENT)
                .then(async () => {
                    await store.deleteProject(projectid);
                });
        });


        it('should delete text classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();
            const modelid = randomstring.generate({ length : 10 });

            const project = await store.storeProject(userid, classid, 'text', projName, []);
            const projectid = project.id;

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : uuid(),
                password : uuid(),
                servicetype : 'conv',
                url : uuid(),
            };
            await store.storeBluemixCredentials(classid, credentials);

            const created = new Date();
            created.setMilliseconds(0);

            const classifierInfo: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : modelid,
                credentialsid : credentials.id,
                created,
                expiry : created,
                language : 'en',
                name : projName,
                url : uuid(),
            };
            await store.storeConversationWorkspace(credentials, userid, classid, projectid,
                classifierInfo);

            return request(testServer)
                .delete('/api/classes/' + classid +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/models/' + modelid)
                .expect(httpstatus.NO_CONTENT)
                .then(async () => {
                    await store.deleteProject(projectid);
                    await store.deleteConversationWorkspace(classifierInfo.id);
                    await store.deleteBluemixCredentials(credentials.id);
                });
        });

    });


});
