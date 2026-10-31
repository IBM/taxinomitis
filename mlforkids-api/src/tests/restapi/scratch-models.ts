import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import { v1 as uuid } from 'uuid';
import * as assert from 'assert';
import * as request from 'supertest';
import { status as httpstatus } from 'http-status';
import * as randomstring from 'randomstring';
import * as sinon from 'sinon';
import * as textmodels from '../../lib/training/textmodels';
import * as store from '../../lib/db/store';
import * as DbTypes from '../../lib/db/db-types';
import * as TrainingTypes from '../../lib/training/training-types';
import * as Express from 'express';
import * as requestUtil from '../../lib/utils/request';
import { NOT_PLAIN_TEXT } from '../../lib/utils/plaintext';
import testapiserver from './testserver';



let testServer: Express.Express;

const TESTCLASS = 'UNIQUECLASSIDSCMOD';


describe('REST API - scratchkey models', () => {

    let trainClassifierStub: sinon.SinonStub<any, any>;
    let trainClassifierForProjectStub: sinon.SinonStub<any, any>;
    let numbersTrainingServicePostStub: sinon.SinonStub<any, any>;
    let numbersTrainingServiceDeleteStub: sinon.SinonStub<any, any>;

    before(async () => {
        await store.init();
        testServer = testapiserver();

        const originalRequestPost = requestUtil.post;
        const originalRequestDelete = requestUtil.del;
        const stubbedRequestPost = (url: string, opts?: any, retryOnTimeout?: boolean) => {
            if (url === 'undefined/api/models') {
                // no test numbers service available
                return Promise.resolve();
            }
            else {
                // use a real test numbers service
                return originalRequestPost(url, opts, retryOnTimeout || false);
            }
        };
        const stubbedRequestDelete = (url: string, opts?: any) => {
            if (url === 'undefined/api/models') {
                // no test numbers service available
                return Promise.resolve();
            }
            else {
                // use a real test numbers service
                return originalRequestDelete(url, opts);
            }
        };

        numbersTrainingServicePostStub = sinon.stub(requestUtil, 'post').callsFake(stubbedRequestPost);
        numbersTrainingServiceDeleteStub = sinon.stub(requestUtil, 'del').callsFake(stubbedRequestDelete);
    });

    beforeEach(() => {
        // each test sets the training outcome it needs
        trainClassifierStub = sinon.stub(textmodels, 'trainClassifier')
            .rejects(new Error('Test did not set up trainClassifier'));
        trainClassifierForProjectStub = sinon.stub(textmodels, 'trainClassifierForProject')
            .rejects(new Error('Test did not set up trainClassifierForProject'));
    });

    afterEach(() => {
        trainClassifierStub.restore();
        trainClassifierForProjectStub.restore();
    });

    after(() => {
        numbersTrainingServicePostStub.restore();
        numbersTrainingServiceDeleteStub.restore();
        return store.disconnect();
    });


    function createWorkspace(name: string, status: TrainingTypes.ClassifierStatus): TrainingTypes.ConversationWorkspace {
        return {
            id : uuid(),
            workspace_id : uuid(),
            credentialsid : uuid(),
            url : randomstring.generate(),
            name,
            language : 'en',
            created : new Date(),
            status,
            updated : new Date(),
            expiry : new Date(),
        };
    }

    function createTrainingData(name: string, exampleText = 'hello'): TrainingTypes.ConversationTrainingData {
        return {
            name,
            language : 'en',
            intents : [
                { intent : 'greeting', examples : [ { text : exampleText } ] },
                { intent : 'farewell', examples : [ { text : 'goodbye' } ] },
            ],
            entities : [],
            dialog_nodes : [],
            counterexamples : [],
            metadata : {},
        };
    }



    describe('cloud projects', () => {

        async function createCloudProjectKey(userid: string, type: DbTypes.ProjectTypeLabel, name: string) {
            const project = await store.storeProject(userid, TESTCLASS, type, name, 'en', [], false);
            const key = await store.storeUntrainedScratchKey(project);
            return { project, key };
        }


        it('should train the text model for the project that the Scratch key belongs to', async () => {
            const userid = uuid();
            const { project, key } = await createCloudProjectKey(userid, 'text', 'hurrah');
            trainClassifierStub.resolves(createWorkspace(project.name, 'Training'));

            const res = await request(testServer)
                .post('/api/scratch/' + key + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(res.body, {
                status : 1,
                msg : 'Model not ready yet',
                type : 'text',
            });
            assert(trainClassifierStub.calledOnce);
            assert.strictEqual(trainClassifierStub.firstCall.args[0].id, project.id);
            assert(trainClassifierForProjectStub.notCalled);

            await store.deleteEntireUser(userid, TESTCLASS);
        });


        it('should report a model that failed to train', async () => {
            const userid = uuid();
            const { project, key } = await createCloudProjectKey(userid, 'text', 'badtrainingdata');
            trainClassifierStub.resolves(createWorkspace(project.name, 'Failed'));

            const res = await request(testServer)
                .post('/api/scratch/' + key + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(res.body, {
                status : 0,
                msg : 'Model Failed',
                type : 'text',
            });

            await store.deleteEntireUser(userid, TESTCLASS);
        });


        it('should report an error from training', async () => {
            const userid = uuid();
            const { key } = await createCloudProjectKey(userid, 'text', 'explode');
            trainClassifierStub.rejects(new Error('Something horrible happened'));

            const res = await request(testServer)
                .post('/api/scratch/' + key + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(res.body, {
                status : 0,
                msg : 'Failed to train machine learning model',
                type : 'text',
            });

            await store.deleteEntireUser(userid, TESTCLASS);
        });


        it('should refuse to train image models', async () => {
            const userid = uuid();
            const { key } = await createCloudProjectKey(userid, 'images', 'pictures');

            const res = await request(testServer)
                .post('/api/scratch/' + key + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_IMPLEMENTED);

            assert.deepStrictEqual(res.body, {
                error : 'Only text or numbers models can be trained using a Scratch key',
            });
            assert(trainClassifierStub.notCalled);

            await store.deleteEntireUser(userid, TESTCLASS);
        });


        it('should train a numbers ML model using Scratch keys', async () => {
            const name = 'numeric';

            const userid = uuid();
            const typelabel = 'numbers';
            const fields: DbTypes.NumbersProjectFieldSummary[] = [
                { name : 'age', type : 'number' },
            ];

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', fields, false);
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'young');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'old');

            await store.storeNumberTraining(project.id, false, [ 1 ], 'young');
            await store.storeNumberTraining(project.id, false, [ 2 ], 'young');
            await store.storeNumberTraining(project.id, false, [ 3 ], 'young');
            await store.storeNumberTraining(project.id, false, [ 80 ], 'old');
            await store.storeNumberTraining(project.id, false, [ 81 ], 'old');
            await store.storeNumberTraining(project.id, false, [ 82 ], 'old');

            const key = await store.storeUntrainedScratchKey(project);

            const res = await request(testServer)
                .post('/api/scratch/' + key + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(project.id, res.body.key);
            assert.strictEqual('Training', res.body.status);
            assert(res.body.lastupdate);
            assert(res.body.urls);
            assert(trainClassifierStub.notCalled);

            await store.deleteEntireUser(userid, TESTCLASS);
        });

    });



    describe('local projects', () => {

        async function createLocalProjectKey(userid: string, name: string) {
            const project = await store.storeLocalProject(userid, TESTCLASS, 'text', name, []);
            const key = await store.storeUntrainedScratchKey(project);
            return { project, key };
        }


        it('should train the text model for the project that the Scratch key belongs to, using the training data from the request', async () => {
            const userid = uuid();
            const { project, key } = await createLocalProjectKey(userid, 'hurrah');
            const training = createTrainingData(project.name);
            trainClassifierForProjectStub.resolves(createWorkspace(project.name, 'Training'));

            const res = await request(testServer)
                .post('/api/scratch/' + key + '/local/models')
                .send({ type : 'text', training })
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(res.body, {
                status : 1,
                msg : 'Model not ready yet',
                type : 'text',
            });
            assert(trainClassifierForProjectStub.calledOnce);
            assert.strictEqual(trainClassifierForProjectStub.firstCall.args[0].id, project.id);
            assert.deepStrictEqual(trainClassifierForProjectStub.firstCall.args[1], training);
            assert(trainClassifierStub.notCalled);

            await store.deleteEntireUser(userid, TESTCLASS);
        });


        it('should report a model that failed to train', async () => {
            const userid = uuid();
            const { project, key } = await createLocalProjectKey(userid, 'badtrainingdata');
            trainClassifierForProjectStub.resolves(createWorkspace(project.name, 'Failed'));

            const res = await request(testServer)
                .post('/api/scratch/' + key + '/local/models')
                .send({ type : 'text', training : createTrainingData(project.name) })
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(res.body, {
                status : 0,
                msg : 'Model Failed',
                type : 'text',
            });

            await store.deleteEntireUser(userid, TESTCLASS);
        });


        it('should report an error from training', async () => {
            const userid = uuid();
            const { project, key } = await createLocalProjectKey(userid, 'explode');
            trainClassifierForProjectStub.rejects(new Error('Something horrible happened'));

            const res = await request(testServer)
                .post('/api/scratch/' + key + '/local/models')
                .send({ type : 'text', training : createTrainingData(project.name) })
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(res.body, {
                status : 0,
                msg : 'Failed to train machine learning model',
                type : 'text',
            });

            await store.deleteEntireUser(userid, TESTCLASS);
        });


        it('should require a project type', async () => {
            const userid = uuid();
            const { project, key } = await createLocalProjectKey(userid, 'notype');

            const res = await request(testServer)
                .post('/api/scratch/' + key + '/local/models')
                .send({ training : createTrainingData(project.name) })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error : 'Missing data' });
            assert(trainClassifierForProjectStub.notCalled);

            await store.deleteEntireUser(userid, TESTCLASS);
        });


        it('should reject invalid training data', async () => {
            const userid = uuid();
            const { project, key } = await createLocalProjectKey(userid, 'invalid');

            const res = await request(testServer)
                .post('/api/scratch/' + key + '/local/models')
                .send({ type : 'text', training : { name : project.name, language : 'en' } })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error : 'Missing data' });
            assert(trainClassifierForProjectStub.notCalled);

            await store.deleteEntireUser(userid, TESTCLASS);
        });


        it('should reject training data that is not plain text', async () => {
            const userid = uuid();
            const { project, key } = await createLocalProjectKey(userid, 'notplain');

            const res = await request(testServer)
                .post('/api/scratch/' + key + '/local/models')
                .send({ type : 'text', training : createTrainingData(project.name, '%PDF-1.4 binary content') })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error : NOT_PLAIN_TEXT });
            assert(trainClassifierForProjectStub.notCalled);

            await store.deleteEntireUser(userid, TESTCLASS);
        });

    });

});
