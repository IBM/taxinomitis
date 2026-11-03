import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import { v1 as uuid } from 'uuid';
import * as assert from 'assert';
import * as request from 'supertest';
import { status as httpstatus } from 'http-status';
import * as sinon from 'sinon';
import * as express from 'express';
import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import * as textmodels from '../../lib/training/textmodels';
import * as textservice from '../../lib/training/textservice';
import * as env from '../../lib/utils/env';
import * as Types from '../../lib/training/training-types';
import testapiserver from './testserver';


let testServer: express.Express;


/**
 * Text models for a class without Watson Assistant keys, using the real
 *  DB and text models layer, with only the text service itself stubbed.
 */
describe('REST API - text service models', () => {

    // a class with no Watson Assistant credentials, and the default limits
    const TESTCLASS = 'UNIQUECLASSIDTXTMODELS';
    const MAX_MODELS_PER_STUDENT = 3;

    let userid: string;

    let authStub: sinon.SinonStub<any, any>;
    let isConfiguredStub: sinon.SinonStub<[], boolean>;
    let trainStub: sinon.SinonStub<any, any>;
    let classifyStub: sinon.SinonStub<any, any>;

    let nextModelNum = 0;
    function nextModelId(): string {
        nextModelNum += 1;
        return 'a1b2c3d4-0000-4000-8000-' + String(nextModelNum).padStart(12, '0');
    }

    function headFor(modelid: string): Buffer {
        return Buffer.from('head-for-' + modelid);
    }

    function authNoOp(req: express.Request, res: express.Response, next: (err?: Error) => void) {
        const reqWithUser = req as auth.RequestWithUser;
        reqWithUser.user = {
            sub : userid,
            app_metadata : {
                role : 'student',
                tenant : TESTCLASS,
            },
        };
        next();
    }

    const CLASSIFIER_TIMESTAMP = new Date('2026-11-01T10:00:00Z');
    const CLASSES: Types.Classification[] = [
        { class_name : 'happy', confidence : 87, classifierTimestamp : CLASSIFIER_TIMESTAMP },
        { class_name : 'sad', confidence : 13, classifierTimestamp : CLASSIFIER_TIMESTAMP },
    ];

    const LOCAL_TRAINING = {
        name : 'my local project',
        language : 'en',
        intents : [
            { intent : 'happy', examples : [ { text : 'I am happy' } ] },
            { intent : 'sad', examples : [ { text : 'I am sad' } ] },
        ],
        dialog_nodes : [],
        counterexamples : [],
        entities : [],
        metadata : {},
    };


    before(async () => {
        await store.init();
        await store.deleteClassResources(TESTCLASS);

        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
        isConfiguredStub = sinon.stub(env, 'isTextServiceConfigured');
        trainStub = sinon.stub(textservice, 'train');
        classifyStub = sinon.stub(textservice, 'classify');

        testServer = testapiserver();
    });
    beforeEach(() => {
        userid = uuid();

        isConfiguredStub.returns(true);
        trainStub.reset();
        trainStub.callsFake(() => {
            const modelid = nextModelId();
            return Promise.resolve({ modelid, head : headFor(modelid) });
        });
        classifyStub.reset();
        classifyStub.resolves({ classes : CLASSES, outcome : 'ok' });
    });
    afterEach(async () => {
        // don't leave trainings running into the next test
        finishTrainings();
        await textmodels.waitForTrainings();
    });
    after(async () => {
        authStub.restore();
        isConfiguredStub.restore();
        trainStub.restore();
        classifyStub.restore();

        await store.deleteClassResources(TESTCLASS);
        await store.disconnect();
    });


    async function createCloudProject(name = 'my text project') {
        const project = await store.storeProject(userid, TESTCLASS, 'text', name, 'en', [], false);
        await store.addLabelToProject(userid, TESTCLASS, project.id, 'happy');
        await store.addLabelToProject(userid, TESTCLASS, project.id, 'sad');
        await store.storeTextTraining(project.id, 'I am happy', 'happy');
        await store.storeTextTraining(project.id, 'I am sad', 'sad');
        return project;
    }
    function cloudModelsUrl(projectid: string) {
        return '/api/classes/' + TESTCLASS + '/students/' + userid + '/projects/' + projectid + '/models';
    }

    async function createLocalProject(name = 'my local project') {
        return store.storeLocalProject(userid, TESTCLASS, 'text', name, []);
    }
    function localModelsUrl(projectid: string) {
        return '/api/classes/' + TESTCLASS + '/students/' + userid + '/localprojects/' + projectid + '/models';
    }

    function trainCloud(projectid: string) {
        return request(testServer).post(cloudModelsUrl(projectid));
    }
    function trainLocal(projectid: string) {
        return request(testServer).post(localModelsUrl(projectid)).send({ training : LOCAL_TRAINING });
    }



    function listCloud(projectid: string) {
        return request(testServer).get(cloudModelsUrl(projectid)).expect(httpstatus.OK);
    }

    function busy(retryAfterMs: number): textservice.TextServiceTrainingError {
        return new textservice.TextServiceTrainingError(textmodels.ERROR_MESSAGES.SERVICE_BUSY, 'busy', true, retryAfterMs);
    }
    function failure(message: string): textservice.TextServiceTrainingError {
        return new textservice.TextServiceTrainingError(message, 'other', false);
    }

    // trainings started by deferredTraining that haven't finished
    const unfinishedTrainings: (() => void)[] = [];

    function finishTrainings(): void {
        for (const finish of unfinishedTrainings.splice(0)) {
            finish();
        }
    }

    /** trainings that the test finishes when it chooses */
    function deferredTraining(): () => void {
        trainStub.callsFake(() => new Promise((resolve) => {
            const modelid = nextModelId();
            unfinishedTrainings.push(() => resolve({ modelid, head : headFor(modelid) }));
        }));
        return finishTrainings;
    }



    describe('cloud projects', () => {

        it('should train, list, classify and delete a model', async () => {
            const finishTraining = deferredTraining();
            const project = await createCloudProject();

            // train
            let res = await trainCloud(project.id)
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);
            const placeholder = res.body.classifierid;
            assert.strictEqual(res.body.credentialsid, '');
            assert.strictEqual(res.body.status, 'Training');
            assert.strictEqual(res.body.name, 'my text project');
            assert(res.body.updated);
            assert(res.body.expiry);

            assert(trainStub.calledOnce);
            const training: Types.ConversationTrainingData = trainStub.firstCall.args[0];
            assert.deepStrictEqual(training.intents, [
                { intent : 'happy', examples : [ { text : 'I am happy' } ] },
                { intent : 'sad', examples : [ { text : 'I am sad' } ] },
            ]);

            // list while training
            res = await listCloud(project.id);
            assert.deepStrictEqual(res.body, [ {
                classifierid : placeholder,
                credentialsid : '',
                updated : res.body[0].updated,
                expiry : res.body[0].expiry,
                name : 'my text project',
                status : 'Training',
            } ]);

            finishTraining();
            await textmodels.waitForTrainings();

            // list once trained
            res = await listCloud(project.id);
            const modelid = res.body[0].classifierid;
            assert.notStrictEqual(modelid, placeholder);
            assert.strictEqual(res.body[0].status, 'Available');
            assert.strictEqual(new Date(res.body[0].expiry).getTime() - new Date(res.body[0].updated).getTime(),
                               24 * 60 * 60 * 1000);

            // classify
            res = await request(testServer)
                .post(cloudModelsUrl(project.id) + '/' + modelid + '/label')
                .send({ text : 'I am very happy', type : 'text', credentialsid : '' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);
            assert.deepStrictEqual(res.body, JSON.parse(JSON.stringify(CLASSES)));
            assert(classifyStub.calledOnce);
            assert.strictEqual(classifyStub.firstCall.args[0], modelid);
            assert.strictEqual(classifyStub.firstCall.args[2], 'I am very happy');
            const getHead = classifyStub.firstCall.args[3];
            assert.deepStrictEqual(await getHead(), headFor(modelid));

            // delete
            await request(testServer)
                .delete(cloudModelsUrl(project.id) + '/' + modelid)
                .expect(httpstatus.NO_CONTENT);

            res = await listCloud(project.id);
            assert.deepStrictEqual(res.body, []);
            await assert.rejects(getHead, { message : textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND });
        });


        it('should retrain a model with a new model id', async () => {
            const project = await createCloudProject();

            await trainCloud(project.id).expect(httpstatus.CREATED);
            await textmodels.waitForTrainings();
            const firstModelId = (await store.getTextClassifiers(project.id))[0].workspace_id;
            const firstKey = (await store.findScratchKeys(userid, project.id, TESTCLASS))[0];
            assert.strictEqual(firstKey.classifierid, firstModelId);

            const finishTraining = deferredTraining();
            let res = await trainCloud(project.id).expect(httpstatus.CREATED);
            assert.strictEqual(res.body.status, 'Training');
            const placeholder = res.body.classifierid;
            assert.notStrictEqual(placeholder, firstModelId);
            assert.strictEqual((await store.getScratchKey(firstKey.id)).classifierid, placeholder);

            finishTraining();
            await textmodels.waitForTrainings();

            const models = await store.getTextClassifiers(project.id);
            assert.strictEqual(models.length, 1);
            assert.strictEqual(models[0].id, placeholder);
            const secondModelId = models[0].workspace_id;
            assert.notStrictEqual(secondModelId, firstModelId);
            assert.notStrictEqual(secondModelId, placeholder);

            const key = await store.getScratchKey(firstKey.id);
            assert.strictEqual(key.classifierid, secondModelId);

            res = await listCloud(project.id);
            const head = await store.getTextClassifierHead(models[0].id);
            assert.deepStrictEqual(head?.head, headFor(secondModelId));
            assert.strictEqual(head?.updated.toISOString(), res.body[0].updated);
        });


        it('should give a duplicate request the training in progress', async () => {
            const finishTraining = deferredTraining();
            const project = await createCloudProject();

            const first = await trainCloud(project.id).expect(httpstatus.CREATED);
            const second = await trainCloud(project.id).expect(httpstatus.CREATED);

            assert.strictEqual(second.body.classifierid, first.body.classifierid);
            assert.strictEqual(second.body.status, 'Training');
            assert.strictEqual(second.body.updated, first.body.updated);

            finishTraining();
            await textmodels.waitForTrainings();
            assert(trainStub.calledOnce);
        });


        it('should make one model from concurrent requests', async () => {
            const finishTraining = deferredTraining();
            const project = await createCloudProject();

            const responses = await Promise.all([ 1, 2, 3, 4, 5 ].map(() => trainCloud(project.id).expect(httpstatus.CREATED)));

            const ids = new Set(responses.map((res) => res.body.classifierid));
            assert.strictEqual(ids.size, 1);
            assert.strictEqual((await store.getTextClassifiers(project.id)).length, 1);

            finishTraining();
            await textmodels.waitForTrainings();
            assert(trainStub.calledOnce);
        });


        it('should give a random answer while the model is training', async () => {
            const finishTraining = deferredTraining();
            const project = await createCloudProject();

            const trained = await trainCloud(project.id).expect(httpstatus.CREATED);

            const res = await request(testServer)
                .post(cloudModelsUrl(project.id) + '/' + trained.body.classifierid + '/label')
                .send({ text : 'I am very happy', type : 'text', credentialsid : '' })
                .expect(httpstatus.OK);
            assert.strictEqual(res.body.length, 1);
            assert.strictEqual(res.body[0].random, true);
            assert([ 'happy', 'sad' ].includes(res.body[0].class_name));
            assert(classifyStub.notCalled);

            finishTraining();
        });


        it('should throw away a training for a model deleted while it trains', async () => {
            const finishTraining = deferredTraining();
            const project = await createCloudProject();

            const trained = await trainCloud(project.id).expect(httpstatus.CREATED);
            await request(testServer)
                .delete(cloudModelsUrl(project.id) + '/' + trained.body.classifierid)
                .expect(httpstatus.NO_CONTENT);

            finishTraining();
            await textmodels.waitForTrainings();

            assert.deepStrictEqual((await listCloud(project.id)).body, []);
        });


        it('should report a missing model when classifying', async () => {
            const project = await createCloudProject();

            const res = await request(testServer)
                .post(cloudModelsUrl(project.id) + '/' + nextModelId() + '/label')
                .send({ text : 'I am very happy', type : 'text', credentialsid : '' })
                .expect(httpstatus.NOT_FOUND);
            assert.strictEqual(res.body.error, textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND + ' Refresh the page');
        });


        it('should report missing keys if the text service is not configured', async () => {
            isConfiguredStub.returns(false);
            const project = await createCloudProject();

            const res = await trainCloud(project.id).expect(httpstatus.CONFLICT);
            assert.strictEqual(res.body.code, 'MLMOD05');
            assert(trainStub.notCalled);
        });


        it('should retry when the text service is busy', async () => {
            trainStub.onFirstCall().rejects(busy(10));
            const project = await createCloudProject();

            const res = await trainCloud(project.id).expect(httpstatus.CREATED);
            assert.strictEqual(res.body.status, 'Training');

            await textmodels.waitForTrainings();
            assert(trainStub.calledTwice);
            assert.strictEqual((await listCloud(project.id)).body[0].status, 'Available');
        });


        it('should report a failed training once it has failed', async () => {
            trainStub.rejects(failure(textmodels.ERROR_MESSAGES.TRAINING_TOO_LARGE));
            const project = await createCloudProject();

            const res = await trainCloud(project.id).expect(httpstatus.CREATED);
            assert.strictEqual(res.body.status, 'Training');

            await textmodels.waitForTrainings();
            assert(trainStub.calledOnce);
            const listed = await listCloud(project.id);
            assert.strictEqual(listed.body.length, 1);
            assert.strictEqual(listed.body[0].status, 'Failed');
        });


        it('should leave no usable model if a retrain fails', async () => {
            const project = await createCloudProject();
            await trainCloud(project.id).expect(httpstatus.CREATED);
            await textmodels.waitForTrainings();
            const oldModelId = (await listCloud(project.id)).body[0].classifierid;

            trainStub.rejects(failure(textmodels.ERROR_MESSAGES.UNKNOWN));
            await trainCloud(project.id).expect(httpstatus.CREATED);
            await textmodels.waitForTrainings();

            assert.strictEqual((await listCloud(project.id)).body[0].status, 'Failed');
            await request(testServer)
                .post(cloudModelsUrl(project.id) + '/' + oldModelId + '/label')
                .send({ text : 'I am very happy', type : 'text', credentialsid : '' })
                .expect(httpstatus.NOT_FOUND);
            assert(classifyStub.notCalled);
        });
    });



    describe('local projects', () => {

        it('should train, list, classify and delete a model', async () => {
            const project = await createLocalProject();

            let res = await trainLocal(project.id)
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);
            assert.strictEqual(res.body.credentialsid, '');
            assert.strictEqual(res.body.status, 'Training');

            await textmodels.waitForTrainings();
            assert(trainStub.calledOnce);
            assert.deepStrictEqual(trainStub.firstCall.args[0].intents, LOCAL_TRAINING.intents);

            res = await request(testServer)
                .get(localModelsUrl(project.id))
                .expect(httpstatus.OK);
            assert.strictEqual(res.body.length, 1);
            assert.strictEqual(res.body[0].status, 'Available');
            const modelid = res.body[0].classifierid;

            res = await request(testServer)
                .post(localModelsUrl(project.id) + '/' + modelid + '/label')
                .send({ text : 'I am very happy', credentialsid : '' })
                .expect(httpstatus.OK);
            assert.deepStrictEqual(res.body, JSON.parse(JSON.stringify(CLASSES)));
            assert.strictEqual(classifyStub.firstCall.args[0], modelid);

            await request(testServer)
                .delete(localModelsUrl(project.id) + '/' + modelid)
                .expect(httpstatus.NO_CONTENT);

            res = await request(testServer)
                .get(localModelsUrl(project.id))
                .expect(httpstatus.OK);
            assert.deepStrictEqual(res.body, []);
        });
    });



    describe('model limit', () => {

        it('should count models that are still training', async () => {
            deferredTraining();
            for (let i = 0; i < MAX_MODELS_PER_STUDENT; i++) {
                const project = await createCloudProject();
                await trainCloud(project.id).expect(httpstatus.CREATED);
            }
            const project = await createCloudProject();
            const res = await trainCloud(project.id).expect(httpstatus.CONFLICT);
            assert.deepStrictEqual(res.body, { code : 'MLMOD16', error : textmodels.ERROR_MESSAGES.TOO_MANY_MODELS });
            assert.strictEqual(trainStub.callCount, MAX_MODELS_PER_STUDENT);
        });


        it('should stop a student with too many models from training a new one', async () => {
            for (let i = 0; i < MAX_MODELS_PER_STUDENT; i++) {
                const project = await createCloudProject();
                await trainCloud(project.id).expect(httpstatus.CREATED);
            }
            await textmodels.waitForTrainings();
            trainStub.resetHistory();

            const project = await createCloudProject();
            const res = await trainCloud(project.id).expect(httpstatus.CONFLICT);
            assert.deepStrictEqual(res.body, { code : 'MLMOD16', error : textmodels.ERROR_MESSAGES.TOO_MANY_MODELS });
            assert(trainStub.notCalled);
        });


        it('should count local and cloud projects towards the same limit', async () => {
            const cloudProject = await createCloudProject();
            await trainCloud(cloudProject.id).expect(httpstatus.CREATED);
            for (let i = 1; i < MAX_MODELS_PER_STUDENT; i++) {
                const localProject = await createLocalProject();
                await trainLocal(localProject.id).expect(httpstatus.CREATED);
            }

            const localProject = await createLocalProject();
            let res = await trainLocal(localProject.id).expect(httpstatus.CONFLICT);
            assert.strictEqual(res.body.code, 'MLMOD16');

            const anotherCloudProject = await createCloudProject();
            res = await trainCloud(anotherCloudProject.id).expect(httpstatus.CONFLICT);
            assert.strictEqual(res.body.code, 'MLMOD16');
        });


        it('should allow a student at the limit to retrain', async () => {
            const projects = [];
            for (let i = 0; i < MAX_MODELS_PER_STUDENT; i++) {
                const project = await createCloudProject();
                await trainCloud(project.id).expect(httpstatus.CREATED);
                projects.push(project);
            }
            await textmodels.waitForTrainings();

            const res = await trainCloud(projects[0].id).expect(httpstatus.CREATED);
            assert.strictEqual(res.body.status, 'Training');
        });


        it('should allow a new model once the student deletes one', async () => {
            deferredTraining();
            const projects = [];
            for (let i = 0; i < MAX_MODELS_PER_STUDENT; i++) {
                const project = await createCloudProject();
                const res = await trainCloud(project.id).expect(httpstatus.CREATED);
                projects.push({ project, modelid : res.body.classifierid });
            }

            // deleting while it is training
            await request(testServer)
                .delete(cloudModelsUrl(projects[0].project.id) + '/' + projects[0].modelid)
                .expect(httpstatus.NO_CONTENT);

            const project = await createCloudProject();
            await trainCloud(project.id).expect(httpstatus.CREATED);
        });
    });



    describe('Scratch keys', () => {

        function scratchUrl(key: string, path: string) {
            return '/api/scratch/' + key + path;
        }

        const TRAINING = { status : 1, msg : 'Model not ready yet', type : 'text' };
        const READY = { status : 2, msg : 'Ready', type : 'text' };

        it('should train, report status and classify for a cloud project', async () => {
            const finishTraining = deferredTraining();
            const project = await createCloudProject();
            const key = await store.storeUntrainedScratchKey(project);

            let res = await request(testServer)
                .post(scratchUrl(key, '/models'))
                .expect(httpstatus.OK);
            assert.deepStrictEqual(res.body, TRAINING);

            let scratchKey = await store.getScratchKey(key);
            assert.strictEqual(scratchKey.credentials?.servicetype, 'txt');
            assert.strictEqual(scratchKey.credentials?.username, 'txt');
            assert.strictEqual(scratchKey.credentials?.password, '');
            assert.strictEqual(scratchKey.credentials?.url, '');

            res = await request(testServer)
                .get(scratchUrl(key, '/status'))
                .expect(httpstatus.OK);
            assert.deepStrictEqual(res.body, TRAINING);

            // a random answer while the model is training
            res = await request(testServer)
                .get(scratchUrl(key, '/classify'))
                .query({ data : 'I am very happy' })
                .expect(httpstatus.OK);
            assert.strictEqual(res.body[0].random, true);
            assert(classifyStub.notCalled);

            finishTraining();
            await textmodels.waitForTrainings();

            res = await request(testServer)
                .get(scratchUrl(key, '/status'))
                .expect(httpstatus.OK);
            assert.deepStrictEqual(res.body, READY);

            scratchKey = await store.getScratchKey(key);
            res = await request(testServer)
                .get(scratchUrl(key, '/classify'))
                .query({ data : 'I am very happy' })
                .expect(httpstatus.OK);
            assert.deepStrictEqual(res.body, JSON.parse(JSON.stringify(CLASSES)));
            assert.strictEqual(classifyStub.firstCall.args[0], scratchKey.classifierid);
            assert.strictEqual(scratchKey.classifierid, (await store.getTextClassifiers(project.id))[0].workspace_id);
        });


        it('should train a local project', async () => {
            const project = await createLocalProject();
            const key = await store.storeUntrainedScratchKey(project);

            const res = await request(testServer)
                .post(scratchUrl(key, '/local/models'))
                .send({ type : 'text', training : LOCAL_TRAINING })
                .expect(httpstatus.OK);
            assert.deepStrictEqual(res.body, TRAINING);

            await textmodels.waitForTrainings();
            const status = await request(testServer)
                .get(scratchUrl(key, '/status'))
                .expect(httpstatus.OK);
            assert.deepStrictEqual(status.body, READY);
        });


        it('should create a key for an existing model', async () => {
            const project = await createCloudProject();
            await trainCloud(project.id).expect(httpstatus.CREATED);
            await textmodels.waitForTrainings();
            const modelid = (await listCloud(project.id)).body[0].classifierid;
            await store.deleteScratchKeysByProjectId(project.id);

            const res = await request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/' + userid + '/projects/' + project.id + '/scratchkeys')
                .expect(httpstatus.OK);
            assert.strictEqual(res.body.length, 1);
            assert.strictEqual(res.body[0].model, modelid);

            const scratchKey = await store.getScratchKey(res.body[0].id);
            assert.strictEqual(scratchKey.classifierid, modelid);
            assert.strictEqual(scratchKey.credentials?.servicetype, 'txt');
            assert.strictEqual(scratchKey.credentials?.username, 'txt');
        });


        it('should report a deleted model', async () => {
            const project = await createCloudProject();
            await trainCloud(project.id).expect(httpstatus.CREATED);
            await textmodels.waitForTrainings();
            const modelid = (await listCloud(project.id)).body[0].classifierid;
            const key = (await store.findScratchKeys(userid, project.id, TESTCLASS))[0];

            await request(testServer)
                .delete(cloudModelsUrl(project.id) + '/' + modelid)
                .expect(httpstatus.NO_CONTENT);

            // the key is reset, so the model can't be used
            const res = await request(testServer)
                .get(scratchUrl(key.id, '/status'))
                .expect(httpstatus.OK);
            assert.strictEqual(res.body.status, 0);
        });


        const TRAINING_ERRORS = [
            textmodels.ERROR_MESSAGES.TRAINING_TOO_LARGE,
            textmodels.ERROR_MESSAGES.SERVICE_ERROR,
        ];
        for (const message of TRAINING_ERRORS) {
            it('should report a failed training for a cloud project : ' + message, async () => {
                trainStub.rejects(failure(message));
                const project = await createCloudProject();
                const key = await store.storeUntrainedScratchKey(project);

                const res = await request(testServer)
                    .post(scratchUrl(key, '/models'))
                    .expect(httpstatus.OK);
                assert.deepStrictEqual(res.body, TRAINING);

                await textmodels.waitForTrainings();
                const status = await request(testServer)
                    .get(scratchUrl(key, '/status'))
                    .expect(httpstatus.OK);
                assert.deepStrictEqual(status.body, { status : 0, msg : 'Model Failed', type : 'text' });
            });

            it('should report a failed training for a local project : ' + message, async () => {
                trainStub.rejects(failure(message));
                const project = await createLocalProject();
                const key = await store.storeUntrainedScratchKey(project);

                const res = await request(testServer)
                    .post(scratchUrl(key, '/local/models'))
                    .send({ type : 'text', training : LOCAL_TRAINING })
                    .expect(httpstatus.OK);
                assert.deepStrictEqual(res.body, TRAINING);

                await textmodels.waitForTrainings();
                const status = await request(testServer)
                    .get(scratchUrl(key, '/status'))
                    .expect(httpstatus.OK);
                assert.deepStrictEqual(status.body, { status : 0, msg : 'Model Failed', type : 'text' });
            });
        }


        it('should report a student with too many models', async () => {
            for (let i = 0; i < MAX_MODELS_PER_STUDENT; i++) {
                const project = await createCloudProject();
                await trainCloud(project.id).expect(httpstatus.CREATED);
            }
            const project = await createCloudProject();
            const key = await store.storeUntrainedScratchKey(project);

            const res = await request(testServer)
                .post(scratchUrl(key, '/models'))
                .expect(httpstatus.OK);
            assert.deepStrictEqual(res.body, {
                status : 0,
                msg : textmodels.ERROR_MESSAGES.TOO_MANY_MODELS,
                type : 'text',
            });
        });


        it('should keep the generic reply for other training errors', async () => {
            const createStub = sinon.stub(store, 'createTextServiceTraining').rejects(new Error('Failed to store text model'));
            try {
                const project = await createCloudProject();
                const key = await store.storeUntrainedScratchKey(project);

                const res = await request(testServer)
                    .post(scratchUrl(key, '/models'))
                    .expect(httpstatus.OK);
                assert.deepStrictEqual(res.body, {
                    status : 0,
                    msg : 'Failed to train machine learning model',
                    type : 'text',
                });
            }
            finally {
                createStub.restore();
            }
        });
    });
});
