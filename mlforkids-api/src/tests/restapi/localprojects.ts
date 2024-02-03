/*eslint-env mocha */
import * as express from 'express';
import * as sinon from 'sinon';
import { v1 as uuid } from 'uuid';
import * as assert from 'assert';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as auth from '../../lib/restapi/auth';
import * as conversation from '../../lib/training/conversation';
import * as DbTypes from '../../lib/db/db-types';
import * as Types from '../../lib/training/training-types';
import * as store from '../../lib/db/store';
import testapiserver from './testserver';


let testServer: express.Express;


const TESTCLASS = 'UNIQUECLASSID';


describe('REST API - local projects', () => {

    let authStub: sinon.SinonStub<any, any>;

    let nextAuth0UserId = 'userid';
    let nextAuth0UserTenant = TESTCLASS;

    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        const reqWithUser = req as auth.RequestWithUser;
        reqWithUser.user = {
            sub : nextAuth0UserId,
            app_metadata : {
                role : 'student',
                tenant : nextAuth0UserTenant,
            },
        };
        next();
    }

    const updated = new Date();
    updated.setMilliseconds(0);

    const credsid = uuid();

    before(async () => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);

        conversationStubGetClassifiersStub = sinon.stub(conversation, 'getClassifierStatuses');
        conversationStubTrainClassifierStub = sinon.stub(conversation, 'trainClassifierForProject');
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

        conversationStubTrainClassifierStub.callsFake((project: DbTypes.LocalProject /*, training: Types.ConversationTrainingData*/) => {
            const workspace: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : 'NEW-CREATED',
                credentialsid : credsid,
                name : project.name,
                language : 'en',
                created : new Date(Date.UTC(2017, 4, 4, 12, 0)),
                updated : new Date(Date.UTC(2017, 4, 4, 12, 1)),
                expiry : new Date(Date.UTC(2017, 4, 4, 13, 0)),
                url : 'http://conversation.service/api/classifiers/NEW-CREATED',
                status : 'Training',
            };
            return Promise.resolve(workspace);
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

        return store.deleteProjectsByClassId(TESTCLASS);
    });


    beforeEach(() => {
        nextAuth0UserId = 'userid';
        nextAuth0UserTenant = TESTCLASS;
    });

    after(async () => {
        authStub.restore();

        await store.deleteProjectsByClassId(TESTCLASS);
        await store.deleteAllPendingJobs();

        conversationStubGetClassifiersStub.restore();
        conversationStubTrainClassifierStub.restore();
        conversationStubTestClassifierStub.restore();
        conversationStubDeleteClassifierStub.restore();

        return store.disconnect();
    });


    let conversationStubGetClassifiersStub: sinon.SinonStub<any, any>;
    let conversationStubTrainClassifierStub: sinon.SinonStub<any, any>;
    let conversationStubTestClassifierStub: sinon.SinonStub<any, any>;
    let conversationStubDeleteClassifierStub: sinon.SinonStub<any, any>;


    describe('createLocalProject', () => {
        it('should validate missing input', () => {
            return request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/userid/localprojects')
                .send({})
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Invalid project type undefined');
                });
        });

        it('should only support text projects for local projects', () => {
            return request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/student/localprojects')
                .send({ type : 'imgtfjs', name : 'invalid type', labels : [] })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Local projects not supported for non-text projects');
                });
        });

        it('should verify class ids', () => {
            nextAuth0UserTenant = 'different-class';

            return request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/student/localprojects')
                .send({ type : 'text' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Invalid access');
                });
        });

        it('should create long expiry times for regular classes', () => {
            return request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/student/localprojects')
                .send({ type : 'text', name : 'expiry check', labels : [ 'one', 'two' ] })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    assert.strictEqual(body.name, 'expiry check');
                    assert.deepStrictEqual(body.labels, [ 'one', 'two' ]);

                    const fiftydays = 4320000000;
                    assert(new Date(body.expiry).getTime() > (Date.now() + fiftydays));
                });
        });
    });


    describe('deleteLocalProject', () => {
        it('should return not found for non-existent local projects', () => {
            return request(testServer)
                .del('/api/classes/' + TESTCLASS + '/students/userid/localprojects/not-a-real-project')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Not found');
                });
        });

        it('should delete projects', () => {
            let projectid: string;
            return request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/userid/localprojects')
                .send({ type : 'text', name : 'delete me', labels : [] })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    assert.strictEqual(body.name, 'delete me');
                    assert.deepStrictEqual(body.labels, []);
                    projectid = body.id;
                    return request(testServer)
                        .del('/api/classes/' + TESTCLASS + '/students/userid/localprojects/' + projectid)
                        .expect(httpstatus.NO_CONTENT);
                })
                .then(() => {
                    return request(testServer)
                        .del('/api/classes/' + TESTCLASS + '/students/userid/localprojects/' + projectid)
                        .expect(httpstatus.NOT_FOUND);
                });
        });
    });

    const VALID_TRAINING_DATA = {
        name: 'my project',
        language: 'en',
        intents: [
            {
                intent: 'this',
                examples: [
                    { text: 'example one' },
                    { text: 'example two' },
                ]
            },
            {
                intent: 'that',
                examples: [
                    { text: 'example three' },
                    { text: 'example four' },
                ]
            }
        ],
        entities: [],
        dialog_nodes: [],
        counterexamples: [],
    };

    describe('newLocalProjectModel', () => {
        it('should update project expiry and labels after new models', () => {
            let projectid: string;
            let expiry: Date;
            return request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/userid/localprojects')
                .send({ type : 'text', name : 'update this project', labels : [ 'this' ] })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    assert.strictEqual(body.name, 'update this project');
                    assert.deepStrictEqual(body.labels, [ 'this' ]);
                    projectid = body.id;
                    expiry = new Date(body.expiry);
                    return store.getLocalProject(projectid);
                })
                .then((proj) => {
                    assert(proj);
                    assert.strictEqual(proj.expiry.getTime(), expiry.getTime());

                    return request(testServer)
                        .post('/api/classes/' + TESTCLASS + '/students/userid/localprojects/' + projectid + '/models')
                        .send({ training: VALID_TRAINING_DATA })
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.CREATED)
                        .then((res) => {
                            assert(res.body.classifierid);
                            assert(res.body.credentialsid);
                            assert.strictEqual(res.body.status, 'Training');
                        });
                })
                .then(() => {
                    return store.getLocalProject(projectid);
                })
                .then((proj) => {
                    assert(proj);
                    assert(proj.expiry.getTime() > expiry.getTime());
                    assert.deepStrictEqual(proj.labels, [ 'this', 'that' ]);
                });
        });
    });

    describe('updateLocalProject', () => {
        it('should return not-found for unknown projects', () => {
            return request(testServer)
                .put('/api/classes/' + TESTCLASS + '/students/userid/localprojects/' + 'UNKNOWN')
                .send({ labels : [ 'this', 'that', 'the other' ] })
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Not found' });
                });
        });

        it('should update project expiry and labels after project updates', () => {
            let projectid: string;
            let expiry: Date;
            return request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/userid/localprojects')
                .send({ type : 'text', name : 'updating this project', labels : [ 'this' ] })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    assert.strictEqual(body.name, 'updating this project');
                    assert.deepStrictEqual(body.labels, [ 'this' ]);
                    projectid = body.id;
                    expiry = new Date(body.expiry);
                    return store.getLocalProject(projectid);
                })
                .then((proj) => {
                    assert(proj);
                    assert.strictEqual(proj.expiry.getTime(), expiry.getTime());

                    return request(testServer)
                        .put('/api/classes/' + TESTCLASS + '/students/userid/localprojects/' + projectid)
                        .send({ labels : [ 'this', 'that', 'the other' ] })
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then(() => {
                    return store.getLocalProject(projectid);
                })
                .then((proj) => {
                    assert(proj);
                    assert(proj.expiry.getTime() > expiry.getTime());
                    assert.deepStrictEqual(proj.labels, [ 'this', 'that', 'the other' ]);
                });
        });
    });

    describe('testLocalProjectModel', () => {
        it('should allow models to be tested', async () => {
            const credentials: Types.BluemixCredentialsDbRow = {
                id : credsid,
                username : uuid(),
                password : uuid(),
                servicetype : 'conv',
                url : uuid(),
                classid : TESTCLASS,
                credstypeid : 1,
            };
            const storedCredentials = await store.storeBluemixCredentials(TESTCLASS, credentials);

            const createProject = await request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/userid/localprojects')
                .send({ type : 'text', name : 'model tester', labels : [ 'this', 'that' ] })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);
            const projectBody = createProject.body;
            assert(projectBody.id);

            const createModel = await request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/userid/localprojects/' + projectBody.id + '/models')
                .send({ training: VALID_TRAINING_DATA })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);
            const modelBody = createModel.body;

            const testModel = await request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/userid/localprojects/' + projectBody.id + '/models/' + modelBody.id + '/label')
                .send({
                    credentialsid: credsid,
                    text: 'my test',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);
            const testBody = testModel.body;
            assert(Array.isArray(testBody));
            assert(testBody.every((result) => {
                return result.class_name &&
                       result.confidence;
            }));

            await store.deleteEntireProject('userid', TESTCLASS, projectBody);
            await store.deleteBluemixCredentials(storedCredentials.id);
        });
    });


    describe('getLocalProjectScratchKeys', () => {
        it('should return not found for non-existent local projects', () => {
            return request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/userid/localprojects/not-a-real-project/scratchkeys')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Not found');
                });
        });

        it('should return the same scratch key each time', async () => {
            const createProject = await request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/userid/localprojects')
                .send({ type : 'text', name : 'reuse me', labels : [] })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);
            const projectBody = createProject.body;
            assert(projectBody.id);

            const firstKey = await request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/userid/localprojects/' + projectBody.id + '/scratchkeys')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);
            const firstKeyBody = firstKey.body;

            const secondKey = await request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/userid/localprojects/' + projectBody.id + '/scratchkeys')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);
            const secondKeyBody = secondKey.body;

            assert.deepStrictEqual(firstKeyBody, secondKeyBody);

            await store.deleteEntireProject('userid', TESTCLASS, projectBody);
        });
    });
});