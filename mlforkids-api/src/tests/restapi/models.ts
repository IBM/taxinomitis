import { describe, it, before, after } from 'node:test';
import { promisify } from 'node:util';
import { v1 as uuid } from 'uuid';
import * as fs from 'fs';
import * as filecompare from 'filecompare';
import * as tmp from 'tmp';
import * as assert from 'assert';
import * as request from 'supertest';
import { status as httpstatus } from 'http-status';
import * as sinon from 'sinon';
import * as randomstring from 'randomstring';
import * as express from 'express';

import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import * as conversation from '../../lib/training/conversation';
import * as DbTypes from '../../lib/db/db-types';
import * as Types from '../../lib/training/training-types';
import testapiserver from './testserver';


let testServer: express.Express;


describe('REST API - models', () => {

    let authStub: sinon.SinonStub<[express.Request, express.Response, express.NextFunction], void>;

    let nextAuth0Userid = 'studentid';
    let nextAuth0Role: 'student' | 'supervisor' = 'student';
    let nextAuth0Class = 'CLASSID';


    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        const reqWithUser = req as auth.RequestWithUser;
        reqWithUser.user = {
            sub : nextAuth0Userid,
            app_metadata : {
                role : nextAuth0Role,
                tenant : nextAuth0Class,
            },
        };
        next();
    }

    let conversationStubGetClassifiersStub: sinon.SinonStub<any, any>;
    let conversationStubTrainClassifierStub: sinon.SinonStub<any, any>;
    let conversationStubTestClassifierStub: sinon.SinonStub<any, any>;
    let conversationStubDeleteClassifierStub: sinon.SinonStub<any, any>;

    const updated = new Date();
    updated.setMilliseconds(0);


    before(async () => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);

        conversationStubGetClassifiersStub = sinon.stub(conversation, 'getClassifierStatuses');
        conversationStubTrainClassifierStub = sinon.stub(conversation, 'trainClassifier');
        conversationStubTestClassifierStub = sinon.stub(conversation, 'testClassifier');
        conversationStubDeleteClassifierStub = sinon.stub(conversation, 'deleteClassifier');

        conversationStubGetClassifiersStub.callsFake((tenant, classifiers: Types.ConversationWorkspace[]) =>  {
            return new Promise((resolve) => {
                let output: Types.ConversationWorkspace[] = [];

                output = classifiers.map((classifier) => {
                    classifier.updated = updated;

                    switch (classifier.workspace_id) {
                    case 'good':
                        classifier.status = 'Available';
                        break;
                    case 'busy':
                        classifier.status = 'Training';
                        break;
                    }
                    return classifier;
                });

                resolve(output);
            });
        });

        conversationStubTrainClassifierStub.callsFake((project: DbTypes.Project) => {
            if (project.name === 'no more room') {
                const err = new Error(conversation.ERROR_MESSAGES.INSUFFICIENT_API_KEYS);
                return Promise.reject(err);
            }
            else if (project.name === 'bad creds') {
                const err: any = new Error('Unauthorized');
                err.statusCode = httpstatus.UNAUTHORIZED;
                return Promise.reject(err);
            }
            else if (project.name === 'no creds') {
                const err: any = new Error('Unexpected response when retrieving service credentials');
                return Promise.reject(err);
            }
            else if (project.name === 'too fast') {
                const err: any = new Error(conversation.ERROR_MESSAGES.API_KEY_RATE_LIMIT);
                return Promise.reject(err);
            }
            else if (project.name === 'deleted model') {
                const err: any = new Error(conversation.ERROR_MESSAGES.MODEL_NOT_FOUND);
                return Promise.reject(err);
            }
            else {
                const workspace: Types.ConversationWorkspace = {
                    id : uuid(),
                    workspace_id : 'NEW-CREATED',
                    credentialsid : '123',
                    name : project.name,
                    language : 'en',
                    created : new Date(Date.UTC(2017, 4, 4, 12, 0)),
                    updated : new Date(Date.UTC(2017, 4, 4, 12, 1)),
                    expiry : new Date(Date.UTC(2017, 4, 4, 13, 0)),
                    url : 'http://conversation.service/api/classifiers/NEW-CREATED',
                    status : 'Training',
                };
                return Promise.resolve(workspace);
            }
        });
        conversationStubTestClassifierStub.callsFake(() => {
            const classifierTimestamp = new Date(Date.UTC(2017, 4, 4, 12, 1));
            const classifications: Types.Classification[] = [
                { class_name : 'first', confidence : 0.8, classifierTimestamp },
                { class_name : 'second', confidence : 0.15, classifierTimestamp },
                { class_name : 'third', confidence : 0.05, classifierTimestamp },
            ];
            return Promise.resolve(classifications);
        });
        conversationStubDeleteClassifierStub.callsFake(() => {
            return Promise.resolve();
        });

        await store.init();

        testServer = testapiserver();
    });


    after(() => {
        authStub.restore();

        conversationStubGetClassifiersStub.restore();
        conversationStubTrainClassifierStub.restore();
        conversationStubTestClassifierStub.restore();
        conversationStubDeleteClassifierStub.restore();

        return store.disconnect();
    });



    describe('getModels', () => {

        it('should verify project exists', async () => {
            const classid = uuid();
            const studentid = uuid();
            const projectid = uuid();

            nextAuth0Userid = studentid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;
            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + studentid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);

            assert.strictEqual(res.body.error, 'Not found');
        });

        it('should verify user id', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;
            await request(testServer)
                .get('/api/classes/' + classid + '/students/DIFFERENTUSER/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);

            await store.deleteEntireUser(userid, classid);
        });


        it('should handle projects without classifiers', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;
            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(res.body, []);

            await store.deleteEntireUser(userid, classid);
        });



        it('should handle image projects without classifiers', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'images', 'demo', 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;
            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(res.body, []);

            await store.deleteEntireUser(userid, classid);
        });


        it('should retrieve numbers classifiers', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', 'en', [
                { name : 'a', type : 'number' }, { name : 'b', type : 'number' },
            ], false);
            const projectid = project.id;

            await store.storeNumbersClassifier(userid, classid, project.id,
                'https://mlforkids-newnumbers.not-a-real-region.cloud-region.codeengine.appdomain.cloud/saved-models/' + projectid + '/status');

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;
            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(res.body, [ {
                key : projectid,
                status : 'Unknown',
                urls : {
                    status : 'https://mlforkids-newnumbers.not-a-real-region.cloud-region.codeengine.appdomain.cloud/saved-models/' + projectid + '/status',
                },
            }]);

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should retrieve sound classifiers', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'sounds', 'demo', 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;
            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(res.body, []);
            await store.deleteEntireProject(userid, classid, project);
        });


        it('should retrieve text classifiers', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : uuid(),
                password : uuid(),
                servicetype : 'conv',
                url : uuid(),
                classid,
                credstype : 'conv_lite',
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
            await store.storeConversationWorkspace(credentials, project, classifierAInfo);

            const createdB = new Date();
            createdB.setMilliseconds(0);
            createdB.setSeconds(createdA.getSeconds() + 1);

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
            await store.storeConversationWorkspace(credentials, project, classifierBInfo);


            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;
            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(res.body, [
                {
                    classifierid : 'good',
                    credentialsid : credentials.id,
                    updated : updated.toISOString(),
                    expiry : createdA.toISOString(),
                    name : 'DUMMY ONE',
                    status : 'Available',
                },
                {
                    classifierid : 'busy',
                    credentialsid : credentials.id,
                    updated : updated.toISOString(),
                    expiry : createdB.toISOString(),
                    name : 'DUMMY TWO',
                    status : 'Training',
                },
            ]);

            await store.deleteEntireUser(userid, classid);
        });

    });

    describe('newModel', () => {

        it('should verify project exists', async () => {
            const classid = uuid();
            const studentid = uuid();
            const projectid = uuid();
            nextAuth0Userid = studentid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;
            const res = await request(testServer)
                .post('/api/classes/' + classid + '/students/' + studentid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);

            assert.strictEqual(res.body.error, 'Not found');
        });

        it('should verify user id', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = 'DIFFERENTUSER';
            nextAuth0Role = 'student';
            nextAuth0Class = classid;
            await request(testServer)
                .post('/api/classes/' + classid + '/students/DIFFERENTUSER/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);

            await store.deleteEntireUser(userid, classid);
        });

        it('should verify user', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = 'SOMEUSER';
            nextAuth0Role = 'student';
            nextAuth0Class = classid;
            await request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);

            await store.deleteEntireUser(userid, classid);
        });

        it('should enforce tenant policies on number of Conversation classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = 'no more room';

            const project = await store.storeProject(userid, classid, 'text', projName, 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;
            const res = await request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.CONFLICT);

            assert.strictEqual(res.body.error, conversation.ERROR_MESSAGES.INSUFFICIENT_API_KEYS);

            await store.deleteEntireUser(userid, classid);
        });


        it('should handle bad text credentials in unmanaged classes', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = 'bad creds';

            const project = await store.storeProject(userid, classid, 'text', projName, 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;
            const res = await request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.CONFLICT);

            assert.strictEqual(res.body.error,
                'The Watson credentials being used by your class were rejected. ' +
                'Please let your teacher or group leader know.');

            await store.deleteEntireUser(userid, classid);
        });


        it('should handle missing text credentials in unmanaged classes', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = 'no creds';

            const project = await store.storeProject(userid, classid, 'text', projName, 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            const res = await request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.CONFLICT);

            assert.strictEqual(res.body.error,
                'No Watson credentials have been set up for training text projects. ' +
                'Please let your teacher or group leader know.');

            await store.deleteEntireUser(userid, classid);
        });


        it('should handle failure when updating deleted Conversation workspaces', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = 'deleted model';

            const project = await store.storeProject(userid, classid, 'text', projName, 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            const res = await request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);

            assert.strictEqual(res.body.error,
                'Your machine learning model could not be found on the training server. Please try again');

            await store.deleteEntireUser(userid, classid);
        });


        it('should handle rate limit errors from Conversation', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = 'too fast';

            const project = await store.storeProject(userid, classid, 'text', projName, 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            const res = await request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.TOO_MANY_REQUESTS);

            assert.strictEqual(res.body.error,
                'Your class is making too many requests to create machine learning models ' +
                 'at too fast a rate. ' +
                 'Please stop now and let your teacher or group leader know that ' +
                 '"the Watson Assistant service is currently rate limiting their API key"');

            await store.deleteEntireUser(userid, classid);
        });


        it('should train new text classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();

            const project = await store.storeProject(userid, classid, 'text', projName, 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            const res = await request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert.deepStrictEqual(res.body, {
                updated : '2017-05-04T12:01:00.000Z',
                expiry : '2017-05-04T13:00:00.000Z',
                name : projName,
                status : 'Training',
                classifierid : 'NEW-CREATED',
                credentialsid : '123',
            });

            await store.deleteEntireUser(userid, classid);
        });



        it('should refuse to train sound classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();

            const project = await store.storeProject(userid, classid, 'sounds', projName, 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            const res = await request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_IMPLEMENTED);

            assert.deepStrictEqual(res.body, {
                error : 'Not implemented',
            });

            await store.deleteEntireUser(userid, classid);
        });


        it('should refuse to train image classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();

            const project = await store.storeProject(userid, classid, 'imgtfjs', projName, 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            const res = await request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_IMPLEMENTED);

            assert.deepStrictEqual(res.body, {
                error : 'Not implemented',
            });

            await store.deleteEntireUser(userid, classid);
        });


        it('should train new numbers classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', projName, 'en', [
                { name : 'a', type : 'number' }, { name : 'b', type : 'number' },
            ], false);
            const projectid = project.id;
            await store.addLabelToProject(userid, classid, projectid, 'one');
            await store.addLabelToProject(userid, classid, projectid, 'two');
            const data = [
                { numberdata : [ 1, 1 ], label : 'one' },
                { numberdata : [ 2, 2 ], label : 'one' },
                { numberdata : [ 3, 3 ], label : 'one' },
                { numberdata : [ 1, 10 ], label : 'two' },
                { numberdata : [ 2, 20 ], label : 'two' },
                { numberdata : [ 3, 30 ], label : 'two' },
            ];

            await store.bulkStoreNumberTraining(projectid, data);

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            const res = await request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert.strictEqual(res.body.status, 'Training');
            assert.strictEqual(res.body.key, projectid);

            const created = new Date(res.body.lastupdate);
            assert.strictEqual(isNaN(created.getDate()), false);

            const models = await store.getNumbersClassifiers(projectid);
            assert.strictEqual(models.length, 1);

            const model = models[0];
            assert.strictEqual(model.userid, userid);
            assert.strictEqual(model.classid, classid);
            assert.strictEqual(model.projectid, projectid);
            assert(model.url.startsWith('http'));
            assert(model.url.endsWith('/saved-models/' + projectid + '/status'));

            await store.deleteEntireProject(userid, classid, project);
        });
    });


    describe('testModel', () => {

        it('should require a model type', async () => {
            nextAuth0Userid = 'userid';
            nextAuth0Role = 'student';
            nextAuth0Class = 'classid';

            const resp = await request(testServer)
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
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(resp.body, { error : 'Missing data' });
        });


        it('should require text to test with', async () => {
            nextAuth0Userid = 'userid';
            nextAuth0Role = 'student';
            nextAuth0Class = 'classid';

            const resp = await request(testServer)
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
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(resp.body, { error : 'Missing data' });
        });

        it('should require images to test with', async () => {
            nextAuth0Userid = 'userid';
            nextAuth0Role = 'student';
            nextAuth0Class = 'classid';

            const resp = await request(testServer)
                .post('/api/classes/' + 'classid' +
                        '/students/' + 'userid' +
                        '/projects/' + 'projectid' +
                        '/models/' + 'modelid' +
                        '/label')
                .send({
                    type : 'images',
                    credentialsid : 'HELLO',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(resp.body, { error : 'Missing data' });
        });




        it('should require credentials to test with', async () => {
            nextAuth0Userid = 'userid';
            nextAuth0Role = 'student';
            nextAuth0Class = 'classid';

            const resp = await request(testServer)
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
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(resp.body, { error : 'Missing data' });
        });


        it('should require valid credentials to test text with', async () => {
            nextAuth0Userid = 'userid';
            nextAuth0Role = 'student';
            nextAuth0Class = 'classid';

            const resp = await request(testServer)
                .post('/api/classes/' + 'classid' +
                        '/students/' + 'userid' +
                        '/projects/' + 'projectid' +
                        '/models/' + 'modelid' +
                        '/label')
                .send({
                    type : 'text',
                    text : 'HELLO',
                    credentialsid : 'blahblahblah',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);

            assert.deepStrictEqual(resp.body, { error : 'Not found' });
        });


        it('should require credentials to test images with', async () => {
            nextAuth0Userid = 'userid';
            nextAuth0Role = 'student';
            nextAuth0Class = 'classid';

            const resp = await request(testServer)
                .post('/api/classes/' + 'classid' +
                        '/students/' + 'userid' +
                        '/projects/' + 'projectid' +
                        '/models/' + 'modelid' +
                        '/label')
                .send({
                    type : 'images',
                    text : 'HELLO',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(resp.body, { error : 'Missing data' });
        });


        it('should submit a classify request to Conversation', async () => {

            const classid = uuid();
            const userid = uuid();
            const projName = uuid();
            const modelid = randomstring.generate({ length : 10 });

            const project = await store.storeProject(userid, classid, 'text', projName, 'en', [], false);
            const projectid = project.id;

            const credentials: Types.BluemixCredentialsDbRow = {
                id : uuid(),
                username : uuid(),
                password : uuid(),
                servicetype : 'conv',
                url : uuid(),
                classid,
                credstypeid : 1,
            };
            const storedCredentials = await store.storeBluemixCredentials(classid, credentials);

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
            await store.storeConversationWorkspace(storedCredentials, project, classifierInfo);

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            const res = await request(testServer)
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
                .expect(httpstatus.OK);

            const classifierTimestamp = res.body[0].classifierTimestamp;
            assert(classifierTimestamp);

            assert.deepStrictEqual(res.body, [
                { class_name : 'first', confidence : 0.8, classifierTimestamp },
                { class_name : 'second', confidence : 0.15, classifierTimestamp },
                { class_name : 'third', confidence : 0.05, classifierTimestamp },
            ]);

            await store.deleteEntireUser(userid, classid);
            await store.deleteBluemixCredentials(credentials.id);
        });


        it('should refuse to test numbers models', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();
            const modelid = randomstring.generate({ length : 10 });

            const project = await store.storeProject(userid, classid, 'numbers', projName, 'en', [
                { name : 'a', type : 'number' }, { name : 'b', type : 'number' },
            ], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            await request(testServer)
                .post('/api/classes/' + classid +
                      '/students/' + userid +
                      '/projects/' + projectid +
                      '/models/' + modelid + '/label')
                .send({
                    numbers : [1, 2, 3],
                    type : 'sounds',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_IMPLEMENTED);

            await store.deleteEntireUser(userid, classid);
        });


        it('should refuse to test sound models', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();
            const modelid = randomstring.generate({ length : 10 });

            const project = await store.storeProject(userid, classid, 'sounds', projName, 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            await request(testServer)
                .post('/api/classes/' + classid +
                      '/students/' + userid +
                      '/projects/' + projectid +
                      '/models/' + modelid + '/label')
                .send({
                    numbers : [1, 2, 3],
                    type : 'sounds',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_IMPLEMENTED);

            await store.deleteEntireUser(userid, classid);
        });


        it('should return data ready for testing for imgtfjs models', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();
            const modelid = randomstring.generate({ length : 10 });

            const project = await store.storeProject(userid, classid, 'imgtfjs', projName, 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            const res = await request(testServer)
                .post('/api/classes/' + classid +
                      '/students/' + userid +
                      '/projects/' + projectid +
                      '/models/' + modelid + '/label')
                .send({
                    type : 'imgtfjs',
                    image : 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/John_McCarthy_%28computer_scientist%29_Stanford_2006_%28272020300%29.jpg/1280px-John_McCarthy_%28computer_scientist%29_Stanford_2006_%28272020300%29.jpg',
                })
                .expect('Content-Type', /octet-stream/)
                .expect(httpstatus.OK);

            const retrievedFile = await writeDataToTempFile(res.body);
            await filecomparepromise('./src/tests/utils/resources/mccarthy.jpg', retrievedFile);
            await store.deleteEntireUser(userid, classid);
        });

        it('should return errors getting unknown images ready for testing for imgtfjs models', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();
            const modelid = randomstring.generate({ length : 10 });

            const project = await store.storeProject(userid, classid, 'imgtfjs', projName, 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            const res = await request(testServer)
                .post('/api/classes/' + classid +
                      '/students/' + userid +
                      '/projects/' + projectid +
                      '/models/' + modelid + '/label')
                .send({
                    type : 'imgtfjs',
                    image : 'https://not-a-real-imagehost.com/testimage',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error : 'The test image could not be downloaded',
            });

            await store.deleteEntireUser(userid, classid);
        });

        it('should return errors getting invalid URLs ready for testing for imgtfjs models', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();
            const modelid = randomstring.generate({ length : 10 });

            const project = await store.storeProject(userid, classid, 'imgtfjs', projName, 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            async function verifyInvalidURL(invalidurl: string) {
                const res = await request(testServer)
                    .post('/api/classes/' + classid +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/models/' + modelid + '/label')
                    .send({
                        type : 'imgtfjs',
                        image : invalidurl,
                    })
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.BAD_REQUEST);

                assert.deepStrictEqual(res.body, {
                    error : 'The test image address is not a valid web address',
                });
            }

            await verifyInvalidURL('file:///C:/temp/images.jpg');
            await verifyInvalidURL('This is not a URL');
            await verifyInvalidURL('www.sorry.com');
            await verifyInvalidURL('dhttps://something.com/image.png');
            await store.deleteEntireUser(userid, classid);
        });

        it('should return errors getting resources that are not valid images ready for testing for imgtfjs models', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();
            const modelid = randomstring.generate({ length : 10 });

            const project = await store.storeProject(userid, classid, 'imgtfjs', projName, 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            const res = await request(testServer)
                .post('/api/classes/' + classid +
                      '/students/' + userid +
                      '/projects/' + projectid +
                      '/models/' + modelid + '/label')
                .send({
                    type : 'imgtfjs',
                    image : 'https://ibm.com',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error : 'The test image is a type that cannot be used',
            });

            await store.deleteEntireUser(userid, classid);
        });
    });

    describe('deleteModel', () => {

        it('should verify project exists', async () => {
            const classid = uuid();
            const studentid = uuid();
            const projectid = uuid();
            const modelid = uuid();
            nextAuth0Userid = studentid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            const res = await request(testServer)
                .delete('/api/classes/' + classid +
                        '/students/' + studentid +
                        '/projects/' + projectid +
                        '/models/' + modelid)
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);

            assert.strictEqual(res.body.error, 'Not found');
        });

        it('should verify user id', async () => {
            const classid = uuid();
            const userid = uuid();
            const modelid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = 'DIFFERENTUSER';
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            await request(testServer)
                .delete('/api/classes/' + classid +
                        '/students/DIFFERENTUSER/projects/' + projectid +
                        '/models/' + modelid)
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);

            await store.deleteEntireUser(userid, classid);
        });

        it('should allow teachers to delete models', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();
            const modelid = randomstring.generate({ length : 10 });

            const project = await store.storeProject(userid, classid, 'text', projName, 'en', [], false);
            const projectid = project.id;

            const credentials: Types.BluemixCredentialsDbRow = {
                id : uuid(),
                username : uuid(),
                password : uuid(),
                servicetype : 'conv',
                url : uuid(),
                classid,
                credstypeid : 1,
            };
            const storedCredentials = await store.storeBluemixCredentials(classid, credentials);

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
            await store.storeConversationWorkspace(storedCredentials, project, classifierInfo);

            nextAuth0Userid = 'teacheruserid';
            nextAuth0Role = 'supervisor';
            nextAuth0Class = classid;

            await request(testServer)
                .delete('/api/classes/' + classid +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/models/' + modelid)
                .expect(httpstatus.NO_CONTENT);

            await store.deleteEntireUser(userid, classid);
            await store.deleteBluemixCredentials(credentials.id);
        });


        it('should not allow teachers from other classes to delete models', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();
            const modelid = randomstring.generate({ length : 10 });

            const project = await store.storeProject(userid, classid, 'text', projName, 'en', [], false);
            const projectid = project.id;

            const credentials: Types.BluemixCredentialsDbRow = {
                id : uuid(),
                username : uuid(),
                password : uuid(),
                servicetype : 'conv',
                url : uuid(),
                classid,
                credstypeid : 2,
            };
            const storedCredentials = await store.storeBluemixCredentials(classid, credentials);

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
            await store.storeConversationWorkspace(storedCredentials, project, classifierInfo);

            nextAuth0Userid = 'teacheruserid';
            nextAuth0Role = 'supervisor';
            nextAuth0Class = 'DIFFERENTCLASSID';

            await request(testServer)
                .delete('/api/classes/' + classid +
                        '/students/teacheruserid/projects/' + projectid +
                        '/models/' + modelid)
                .expect(httpstatus.FORBIDDEN)
                .expect('Content-Type', /json/);

            await store.deleteEntireUser(userid, classid);
        });


        it('should delete numbers classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();
            const modelid = randomstring.generate({ length : 10 });

            const project = await store.storeProject(userid, classid, 'numbers', projName, 'en', [
                { name : 'a', type : 'number' }, { name : 'b', type : 'number' },
            ], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            await store.storeNumbersClassifier(userid, classid, project.id,
                'https://mlforkids-newnumbers.not-a-real-region.cloud-region.codeengine.appdomain.cloud/saved-models/741120a0-f38a-11ee-872d-a10721b23614/status');

            await request(testServer)
                .delete('/api/classes/' + classid +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/models/' + modelid)
                .expect(httpstatus.NO_CONTENT);

            const output = await store.getNumbersClassifiers(projectid);
            assert.deepStrictEqual(output, []);
            await store.deleteEntireUser(userid, classid);
        });


        it('should refuse to delete sound classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();
            const modelid = randomstring.generate({ length : 10 });

            const project = await store.storeProject(userid, classid, 'sounds', projName, 'en', [], false);
            const projectid = project.id;

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            await request(testServer)
                .delete('/api/classes/' + classid +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/models/' + modelid)
                .expect(httpstatus.NOT_FOUND);

            await store.deleteEntireUser(userid, classid);
        });


        it('should delete text classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projName = uuid();
            const modelid = randomstring.generate({ length : 10 });

            const project = await store.storeProject(userid, classid, 'text', projName, 'en', [], false);
            const projectid = project.id;

            const credentials: Types.BluemixCredentialsDbRow = {
                id : uuid(),
                username : uuid(),
                password : uuid(),
                servicetype : 'conv',
                url : uuid(),
                classid,
                credstypeid : 1,
            };
            const storedCredentials = await store.storeBluemixCredentials(classid, credentials);

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
            await store.storeConversationWorkspace(storedCredentials, project, classifierInfo);

            nextAuth0Userid = userid;
            nextAuth0Role = 'student';
            nextAuth0Class = classid;

            await request(testServer)
                .delete('/api/classes/' + classid +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/models/' + modelid)
                .expect(httpstatus.NO_CONTENT);

            await store.deleteEntireUser(userid, classid);
            await store.deleteBluemixCredentials(credentials.id);
        });
    });


    const tmpFilePromise = promisify(tmp.file);
    const fsWriteFilePromise = promisify(fs.writeFile);
    const filecomparePromise = promisify(filecompare);

    async function writeDataToTempFile(data: Buffer): Promise<string> {
        const path = await tmpFilePromise();
        await fsWriteFilePromise(path, data);
        return path;
    }

    async function filecomparepromise(filea: string, fileb: string): Promise<void> {
        const isEq = await filecomparePromise(filea, fileb);
        assert(isEq, filea + ' ' + fileb);
    }
});
