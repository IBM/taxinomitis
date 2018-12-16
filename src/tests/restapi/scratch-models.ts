/*eslint-env mocha */
import * as uuid from 'uuid/v1';
import * as assert from 'assert';
import * as request from 'supertest';
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

    let mockConversation: sinon.SinonStub;

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
        proxyquire('../../lib/scratchx/models', {
            '../training/conversation' : mockConversation,
        });
    });

    after(() => {
        mockConversation.restore();
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
                });

                await store.deleteEntireUser(userid, TESTCLASS);
            });
    });



    it('should train a ML model using Scratch keys', async () => {
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
                });

                await store.deleteEntireUser(userid, TESTCLASS);
            });
    });

});
