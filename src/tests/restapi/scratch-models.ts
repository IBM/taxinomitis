/*eslint-env mocha */
import { v1 as uuid } from 'uuid';
import * as assert from 'assert';
import * as request from 'supertest';
import * as requestPromise from 'request-promise';
import * as httpstatus from 'http-status';
import * as randomstring from 'randomstring';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as conversation from '../../lib/training/conversation';
import * as store from '../../lib/db/store';
import * as DbTypes from '../../lib/db/db-types';
import * as TrainingTypes from '../../lib/training/training-types';
import * as Express from 'express';
import testapiserver from './testserver';



let testServer: Express.Express;

const TESTCLASS = 'UNIQUECLASSID';


describe('REST API - scratchkey models', () => {

    let mockConversation: sinon.SinonStub<[DbTypes.Project], Promise<TrainingTypes.ConversationWorkspace>>;
    let numbersTrainingServicePostStub: sinon.SinonStub<any, any>;
    let numbersTrainingServiceDeleteStub: sinon.SinonStub<any, any>;

    before(async () => {
        await store.init();
        testServer = testapiserver();

        mockConversation = sinon.stub(conversation, 'trainClassifier').callsFake((project) => {
            if (project.name === 'explode') {
                return Promise.reject(new Error('Something horrible happened'));
            }
            const language: DbTypes.TextProjectLanguage = 'en';
            const training: TrainingTypes.ClassifierStatus = 'Training';
            const failed: TrainingTypes.ClassifierStatus = 'Failed';

            if (project.name === 'badtrainingdata') {
                return Promise.resolve({
                    id : uuid(),
                    workspace_id : uuid(),
                    credentialsid : uuid(),
                    url : randomstring.generate(),
                    name: 'badtrainingdata',
                    language,
                    created : new Date(),
                    status : failed,
                    updated : new Date(),
                    expiry : new Date(),
                });
            }
            if (project.name === 'hurrah') {
                return Promise.resolve({
                    id : uuid(),
                    workspace_id : uuid(),
                    credentialsid : uuid(),
                    url : randomstring.generate(),
                    name: 'hurrah',
                    language,
                    created : new Date(),
                    status : training,
                    updated : new Date(),
                    expiry : new Date(),
                });
            }
            throw new Error('Unexpected project');
        });

        const originalRequestPost = requestPromise.post;
        const originalRequestDelete = requestPromise.delete;
        const stubbedRequestPost = (url: string, opts?: any) => {
            if (url === 'undefined/api/models') {
                // no test numbers service available
                return Promise.resolve();
            }
            else {
                // use a real test numbers service
                return originalRequestPost(url, opts);
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

        // @ts-ignore
        numbersTrainingServicePostStub = sinon.stub(requestPromise, 'post').callsFake(stubbedRequestPost);
        // @ts-ignore
        numbersTrainingServiceDeleteStub = sinon.stub(requestPromise, 'delete').callsFake(stubbedRequestDelete);

        proxyquire('../../lib/scratchx/models', {
            '../training/conversation' : mockConversation,
        });
    });

    after(() => {
        mockConversation.restore();
        numbersTrainingServicePostStub.restore();
        numbersTrainingServiceDeleteStub.restore();
        return store.disconnect();
    });


    it('should handle projects that fail during model training', async () => {
        const name = 'explode';

        const userid = uuid();
        const typelabel = 'text';

        const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [], false);

        const key = await store.storeUntrainedScratchKey(project);

        return request(testServer)
            .post('/api/scratch/' + key + '/models')
            .expect('Content-Type', /json/)
            .expect(httpstatus.OK)
            .then(async (res) => {
                assert.deepStrictEqual(res.body, {
                    status : 0,
                    msg : 'Failed to train machine learning model',
                    type : typelabel,
                });

                await store.deleteEntireUser(userid, TESTCLASS);
            });
    });



    it('should handle projects that report training failures', async () => {
        const name = 'badtrainingdata';

        const userid = uuid();
        const typelabel = 'text';

        const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [], false);

        const key = await store.storeUntrainedScratchKey(project);

        return request(testServer)
            .post('/api/scratch/' + key + '/models')
            .expect('Content-Type', /json/)
            .expect(httpstatus.OK)
            .then(async (res) => {
                assert.deepStrictEqual(res.body, {
                    status : 0,
                    msg : 'Model Failed',
                    type : typelabel,
                });

                await store.deleteEntireUser(userid, TESTCLASS);
            });
    });



    it('should train a text ML model using Scratch keys', async () => {
        const name = 'hurrah';

        const userid = uuid();
        const typelabel = 'text';

        const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [], false);

        const key = await store.storeUntrainedScratchKey(project);

        return request(testServer)
            .post('/api/scratch/' + key + '/models')
            .expect('Content-Type', /json/)
            .expect(httpstatus.OK)
            .then(async (res) => {
                assert.deepStrictEqual(res.body, {
                    status : 1,
                    msg : 'Model not ready yet',
                    type : typelabel,
                });

                await store.deleteEntireUser(userid, TESTCLASS);
            });
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

        return request(testServer)
            .post('/api/scratch/' + key + '/models')
            .expect('Content-Type', /json/)
            .expect(httpstatus.OK)
            .then(async (res) => {
                assert.deepStrictEqual(res.body, {
                    status : 2,
                    msg : 'Ready',
                    type : typelabel,
                });

                await store.deleteEntireUser(userid, TESTCLASS);
            });
    });



});
