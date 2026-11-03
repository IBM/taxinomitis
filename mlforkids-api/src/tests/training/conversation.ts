import { describe, it, before, after, afterEach } from 'node:test';

// tslint:disable:max-line-length

import { v1 as uuid } from 'uuid';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as clone from 'clone';

import * as store from '../../lib/db/store';
import * as conversation from '../../lib/training/conversation';
import * as textmodels from '../../lib/training/textmodels';
import * as DbTypes from '../../lib/db/db-types';
import * as TrainingTypes from '../../lib/training/training-types';
import * as requestUtil from '../../lib/utils/request';
import * as notifications from '../../lib/notifications/slack';

import * as mockstore from './mockstore';
import {
    mockConversation,
    newClassifierDate, newExpiryDate,
    goodClassifier, goodClassifierWithStatus,
    trainingClassifier, trainingClassifierWithStatus,
    brokenClassifier, brokenClassifierWithStatus,
    unknownClassifier, unknownClassifierWithStatus,
    existingClassifier,
} from './mockconversation';


describe('Training - Conversation', () => {

    let getStub: sinon.SinonStub<any, any>;
    let createStub: sinon.SinonStub<any, any>;
    let deleteStub: sinon.SinonStub<any, any>;
    let authStoreStub: sinon.SinonStub<[DbTypes.ClassTenant, TrainingTypes.BluemixServiceType], Promise<TrainingTypes.BluemixCredentials[]>>;
    let authByIdStoreStub: sinon.SinonStub<[string], Promise<TrainingTypes.BluemixCredentials>>;

    // the WA adapter must not read training data, or write
    //  model records or Scratch keys - these stubs are here
    //  to verify that they are never called
    let notAllowedStubs: sinon.SinonStub<any, any>[];


    before(() => {
        getStub = sinon.stub(requestUtil, 'get').callsFake(mockConversation.getClassifier);
        createStub = sinon.stub(requestUtil, 'post');
        createStub.withArgs(sinon.match(/.*workspaces/), sinon.match.any).callsFake(mockConversation.createClassifier);
        createStub.withArgs(sinon.match(/.*message/), sinon.match.any).callsFake(mockConversation.testClassifier);
        deleteStub = sinon.stub(requestUtil, 'del').callsFake(mockConversation.deleteClassifier);

        authStoreStub = sinon.stub(store, 'getBluemixCredentials').callsFake(mockstore.getBluemixCredentials);
        authByIdStoreStub = sinon.stub(store, 'getCombinedBluemixCredentialsById').callsFake(mockstore.getCombinedBluemixCredentialsById);

        notAllowedStubs = [
            sinon.stub(store, 'countTrainingByLabel'),
            sinon.stub(store, 'getUniqueTrainingTextsByLabel'),
            sinon.stub(store, 'storeTextClassifier'),
            sinon.stub(store, 'updateTextClassifierExpiry'),
            sinon.stub(store, 'deleteTextClassifier'),
            sinon.stub(store, 'storeOrUpdateScratchKey'),
            sinon.stub(store, 'updateScratchKeyTimestamp'),
            sinon.stub(store, 'resetExpiredScratchKey'),
        ];
    });
    afterEach(() => {
        for (const stub of notAllowedStubs) {
            assert(stub.notCalled);
        }
    });
    after(() => {
        getStub.restore();
        createStub.restore();
        deleteStub.restore();
        authStoreStub.restore();
        authByIdStoreStub.restore();
        for (const stub of notAllowedStubs) {
            stub.restore();
        }
    });


    const TESTTENANT: DbTypes.ClassTenant = {
        id: 'TESTTENANT',
        maxUsers : 10,
        tenantType : DbTypes.ClassTenantType.UnManaged,
        supportedProjectTypes : [ 'text', 'images', 'numbers', 'sounds' ],
        textClassifierExpiry : 2,
        maxProjectsPerUser : 10,
    };

    const creds: TrainingTypes.BluemixCredentials = {
        id : '123',
        username : 'useruseruseruseruseruseruseruseruser',
        password : 'passpasspass',
        servicetype : 'conv',
        url : 'http://conversation.service',
        classid : 'classid',
        credstype : 'unknown',
    };


    function createProject(projectid: string, name: string, language: DbTypes.TextProjectLanguage): DbTypes.Project {
        return {
            id : projectid,
            name,
            userid : 'bob', classid : TESTTENANT.id,
            type : 'text',
            language,
            labels : ['this', 'that'],
            numfields : 0,
            isCrowdSourced : false,
        };
    }

    function createTraining(name: string, language: DbTypes.TextProjectLanguage): TrainingTypes.ConversationTrainingData {
        return {
            name,
            language,
            intents : [
                { intent : 'this', examples : [ { text : 'one' }, { text : 'two' } ] },
                { intent : 'that', examples : [ { text : 'three' } ] },
            ],
            dialog_nodes : [],
            counterexamples : [],
            entities : [],
            metadata : { createdby : 'machinelearningforkids' },
        };
    }


    describe('create model', () => {

        it('should create a workspace', async () => {
            const project = createProject('projectbob', 'Bob\'s text project', 'fr');
            const training = createTraining(project.name, 'fr');

            const { workspace, credentials } = await conversation.createModel(project, TESTTENANT, 'class', training);
            assert(workspace.id);

            assert.deepStrictEqual(workspace, {
                id : workspace.id,
                name : 'Bob\'s text project',
                language : 'fr',
                created : newClassifierDate,
                updated : newClassifierDate,
                expiry : newExpiryDate,
                workspace_id : '04f2d303-16fd-4f2e-80f4-2c66784cc0fe',
                credentialsid : '123',
                servicetype : 'conv',
                status : 'Training',
                url : 'http://conversation.service/v1/workspaces/04f2d303-16fd-4f2e-80f4-2c66784cc0fe',
            });
            assert.deepStrictEqual(credentials, mockstore.creds);

            assert.deepStrictEqual(createStub.lastCall.args[1].body, training);
        });


        it('should handle failures to create a workspace', async () => {
            const project = createProject('projectbob', 'Bob\'s broken project', 'pt-br');

            await assert.rejects(
                () => conversation.createModel(project, TESTTENANT, 'class', createTraining(project.name, 'pt-br')),
                { message : textmodels.ERROR_MESSAGES.UNKNOWN });
        });


        it('should handle model limit failures to create a workspace', async () => {
            const project = createProject('projectbob', 'Too Many Models', 'en');

            await assert.rejects(
                () => conversation.createModel(project, TESTTENANT, 'class', createTraining(project.name, 'en')),
                { message : conversation.ERROR_MESSAGES.INSUFFICIENT_API_KEYS });
        });


        it('should handle rate limit failures to create a workspace', async () => {
            const project = createProject('projectbob', 'Coming Too Fast', 'en');

            await assert.rejects(
                () => conversation.createModel(project, TESTTENANT, 'class', createTraining(project.name, 'en')),
                { message : conversation.ERROR_MESSAGES.API_KEY_RATE_LIMIT });
        });


        it('should handle maintenance errors when creating a workspace', async () => {
            const project = createProject('projectbob', 'Watson Under Maintenance', 'en');

            await assert.rejects(
                () => conversation.createModel(project, TESTTENANT, 'class', createTraining(project.name, 'en')),
                { message : conversation.ERROR_MESSAGES.MAINTENANCE });
        });
    });



    describe('update model', () => {

        it('should update a workspace', async () => {
            const project = createProject('existingprojectid', 'existing', 'de');

            const before = new Date();

            const { workspace, credentials } = await conversation.updateModel(project, TESTTENANT,
                clone(existingClassifier), createTraining(project.name, 'de'));

            assert.strictEqual(workspace.id, existingClassifier.id);
            assert.strictEqual(workspace.workspace_id, existingClassifier.workspace_id);
            assert.notStrictEqual(existingClassifier.expiry.getTime(),
                                  workspace.expiry.getTime());
            assert(workspace.expiry.getTime() > before.getTime());
            assert.deepStrictEqual(credentials, mockstore.creds);
        });


        it('should handle maintenance errors when updating a workspace', async () => {
            const project = createProject('existingprojectid-maintenance', 'existing', 'de');
            const existing: TrainingTypes.TextClassifier = {
                ...clone(existingClassifier),
                id : 'existingworkspacedbid-maintenance',
                workspace_id : 'existing-classifier-maintenance',
            };

            await assert.rejects(
                () => conversation.updateModel(project, TESTTENANT, existing, createTraining(project.name, 'de')),
                { message : conversation.ERROR_MESSAGES.MAINTENANCE });
        });


        it('should report workspaces that have been deleted from Watson Assistant', async () => {
            const project = createProject('deletedprojectid', 'existing', 'de');
            const existing: TrainingTypes.TextClassifier = {
                ...clone(existingClassifier),
                id : 'deletedworkspacedbid',
                workspace_id : 'deleted-from-watson',
            };

            await assert.rejects(
                () => conversation.updateModel(project, TESTTENANT, existing, createTraining(project.name, 'de')),
                { message : textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND });
        });
    });



    describe('classify', () => {

        it('should return classes from Conversation service', async () => {
            const classifierTimestamp = new Date();
            classifierTimestamp.setMilliseconds(0);

            const classes = await conversation.classify(creds, 'good', classifierTimestamp, 'Hello');
            assert.deepStrictEqual(classes, [
                {
                    class_name : 'temperature',
                    confidence : 100,
                    classifierTimestamp,
                },
                {
                    class_name : 'conditions',
                    confidence : 0,
                    classifierTimestamp,
                },
            ]);
        });


        it('should return no classes when nothing matches', async () => {
            const classes = await conversation.classify(creds, 'bad', new Date(), 'Hello');
            assert.deepStrictEqual(classes, []);
        });


        it('should handle unexpected server errors from Conversation', async () => {
            await assert.rejects(
                () => conversation.classify(creds, 'broken500', new Date(), 'Hello'),
                { message : textmodels.ERROR_MESSAGES.SERVICE_ERROR });
        });


        it('should handle text too long errors from Conversation', async () => {
            await assert.rejects(
                () => conversation.classify(creds, 'toolong', new Date(), 'Hello'),
                { message : textmodels.ERROR_MESSAGES.TEXT_TOO_LONG });
        });
    });



    describe('credential pools', () => {

        const largePoolCreds: TrainingTypes.BluemixCredentialsPool = {
            ...mockstore.poolCreds,
            source : 'large-pool',
            id : '789',
            url : 'http://large.conversation.service',
        };

        let poolStub: sinon.SinonStub<any, any>;
        let poolFailureStub: sinon.SinonStub<any, any>;
        let poolDeletionStub: sinon.SinonStub<any, any>;
        let notifyStub: sinon.SinonStub<any, any>;

        before(() => {
            poolStub = sinon.stub(store, 'getBluemixCredentialsPoolBatch');
            poolFailureStub = sinon.stub(store, 'recordBluemixCredentialsPoolFailure');
            poolDeletionStub = sinon.stub(store, 'recordBluemixCredentialsPoolModelDeletion');
            notifyStub = sinon.stub(notifications, 'notify');
            authByIdStoreStub.withArgs(largePoolCreds.id).resolves(largePoolCreds);
        });
        afterEach(() => {
            poolStub.reset();
            poolFailureStub.reset();
            poolDeletionStub.reset();
            notifyStub.reset();
        });
        after(() => {
            poolStub.restore();
            poolFailureStub.restore();
            poolDeletionStub.restore();
            notifyStub.restore();
            authByIdStoreStub.reset();
            authByIdStoreStub.callsFake(mockstore.getCombinedBluemixCredentialsById);
        });


        it('should create a workspace using the large pool', async () => {
            poolStub.withArgs('large-pool', 'conv').resolves([ largePoolCreds ]);
            const project = createProject('projectbob', 'Bob\'s text project', 'en');

            const { workspace, credentials } = await conversation.createModel(project, TESTTENANT, 'large-pool', createTraining(project.name, 'en'));

            assert.strictEqual(credentials, largePoolCreds);
            assert.strictEqual(workspace.credentialsid, largePoolCreds.id);
            assert(poolStub.calledOnceWith('large-pool', 'conv'));
        });

        it('should record failures against the large pool, and alert the text service channel without ids', async () => {
            poolStub.withArgs('large-pool', 'conv').resolves([ largePoolCreds ]);
            const project = createProject('projectbob', 'Too Many Models', 'en');

            await assert.rejects(
                () => conversation.createModel(project, TESTTENANT, 'large-pool', createTraining(project.name, 'en')),
                { message : conversation.ERROR_MESSAGES.POOL_EXHAUSTED });

            assert(poolFailureStub.calledOnceWith(largePoolCreds));
            assert(poolStub.neverCalledWith('managed-pool'));

            assert(notifyStub.calledOnce);
            const [ text, channel ] = notifyStub.firstCall.args;
            assert.strictEqual(channel, notifications.SLACK_CHANNELS.TEXT_SERVICE);
            assert(text.includes('large-pool'));
            assert(!text.includes(project.id));
            assert(!text.includes(project.classid));
        });

        it('should alert about the managed pool in the training errors channel without ids', async () => {
            poolStub.withArgs('managed-pool', 'conv').resolves([ mockstore.poolCreds ]);
            const project = createProject('projectbob', 'Too Many Models', 'en');

            await assert.rejects(
                () => conversation.createModel(project, TESTTENANT, 'managed-pool', createTraining(project.name, 'en')),
                { message : conversation.ERROR_MESSAGES.POOL_EXHAUSTED });

            assert(poolFailureStub.calledOnceWith(mockstore.poolCreds));

            const [ text, channel ] = notifyStub.firstCall.args;
            assert.strictEqual(channel, notifications.SLACK_CHANNELS.TRAINING_ERRORS);
            assert(text.includes('managed-pool'));
            assert(!text.includes(project.id));
        });

        it('should record deletions of models using the large pool against the large pool', async () => {
            await conversation.deleteModel({ ...goodClassifier, credentialsid : largePoolCreds.id });

            assert(poolDeletionStub.calledOnceWith(largePoolCreds));
        });

        it('should check every pool for orphaned workspaces, even if one is empty', async () => {
            poolStub.withArgs('managed-pool', 'conv').rejects(new Error('Unexpected response when retrieving service credentials'));
            poolStub.withArgs('large-pool', 'conv').resolves([ largePoolCreds ]);
            authStoreStub.withArgs(sinon.match.has('id', 'session-users'), 'conv').resolves([]);
            const getClassStub = sinon.stub(store, 'getClassTenant').resolves({ ...TESTTENANT, id : 'session-users' });
            getStub.withArgs('http://large.conversation.service/v1/workspaces', sinon.match.any).resolves({ workspaces : [] });
            getStub.resetHistory();

            try {
                await conversation.cleanupOrphanedBluemixClassifiers();

                assert(poolStub.calledWith('managed-pool', 'conv'));
                assert(poolStub.calledWith('large-pool', 'conv'));
                assert(getStub.calledOnceWith('http://large.conversation.service/v1/workspaces'));
            }
            finally {
                getClassStub.restore();
                authStoreStub.reset();
                authStoreStub.callsFake(mockstore.getBluemixCredentials);
                getStub.reset();
                getStub.callsFake(mockConversation.getClassifier);
            }
        });
    });



    describe('delete model', () => {

        const poolClassifier: TrainingTypes.TextClassifier = {
            ...goodClassifier,
            credentialsid : mockstore.poolCreds.id,
        };

        it('should delete a workspace', async () => {
            deleteStub.resetHistory();

            await conversation.deleteModel(goodClassifier);

            assert(deleteStub.calledOnce);
            assert(deleteStub.calledWith('http://conversation.service/v1/workspaces/good', {
                auth : { user : 'useruseruseruseruseruseruseruseruser', pass : 'passpasspass' },
                qs : { version : '2017-05-26' },
                headers : { 'user-agent' : 'machinelearningforkids', 'X-Watson-Learning-Opt-Out': 'true' },
                json: true, gzip: true, timeout: 30000,
            }));
        });


        it('should cope with deleting a workspace missing from Bluemix', async () => {
            deleteStub.resetHistory();

            const missingErr: any = new Error();
            missingErr.statusCode = 404;

            deleteStub
                .withArgs('http://conversation.service/v1/workspaces/doesnotactuallyexist', sinon.match.any)
                .throws(missingErr);

            await conversation.deleteModel({
                id : uuid(),
                workspace_id : 'doesnotactuallyexist',
                credentialsid : '123',
                servicetype : 'conv',
                url : 'http://conversation.service/v1/workspaces/doesnotactuallyexist',
                name : 'This does not exist',
                language : 'fr',
                created : new Date(),
                expiry : new Date(),
            });

            assert(deleteStub.calledOnce);
            assert(deleteStub.calledWith('http://conversation.service/v1/workspaces/doesnotactuallyexist', {
                auth : { user : 'useruseruseruseruseruseruseruseruser', pass : 'passpasspass' },
                qs : { version : '2017-05-26' },
                headers : { 'user-agent' : 'machinelearningforkids', 'X-Watson-Learning-Opt-Out': 'true' },
                json: true, gzip: true, timeout: 30000,
            }));
        });


        it('should record deletions of models using pool credentials', async () => {
            deleteStub.resetHistory();
            const poolDeletionStub = sinon.stub(store, 'recordBluemixCredentialsPoolModelDeletion').resolves();

            try {
                await conversation.deleteModel(poolClassifier);

                assert(deleteStub.calledOnce);
                assert(poolDeletionStub.calledOnceWith(mockstore.poolCreds));
            }
            finally {
                poolDeletionStub.restore();
            }
        });


        it('should not record deletions of models using class credentials', async () => {
            deleteStub.resetHistory();
            const poolDeletionStub = sinon.stub(store, 'recordBluemixCredentialsPoolModelDeletion').resolves();

            try {
                await conversation.deleteModel(goodClassifier);

                assert(deleteStub.calledOnce);
                assert(poolDeletionStub.notCalled);
            }
            finally {
                poolDeletionStub.restore();
            }
        });


        it('should not fail if the deletion of a model using pool credentials cannot be recorded', async () => {
            deleteStub.resetHistory();
            const poolDeletionStub = sinon.stub(store, 'recordBluemixCredentialsPoolModelDeletion')
                .rejects(new Error('DB is unavailable'));

            try {
                await conversation.deleteModel(poolClassifier);

                assert(deleteStub.calledOnce);
                assert(poolDeletionStub.calledOnce);
            }
            finally {
                poolDeletionStub.restore();
            }
        });


        it('should fail if the credentials are missing', async () => {
            deleteStub.resetHistory();

            await assert.rejects(
                () => conversation.deleteModel({ ...goodClassifier, credentialsid : 'missing' }),
                { message : 'Unexpected response when retrieving the service credentials' });

            assert(deleteStub.notCalled);
        });
    });



    describe('get model status', () => {

        it('should get status for a ready workspace', async () => {
            const status = await conversation.getModelStatus(creds, clone(goodClassifier));
            assert.deepStrictEqual(status, goodClassifierWithStatus);
        });

        it('should get status for a broken workspace', async () => {
            const status = await conversation.getModelStatus(creds, clone(brokenClassifier));
            assert.deepStrictEqual(status, brokenClassifierWithStatus);
        });

        it('should get status for a workspace that is still training', async () => {
            const status = await conversation.getModelStatus(creds, clone(trainingClassifier));
            assert.deepStrictEqual(status, trainingClassifierWithStatus);
        });

        it('should get status for an unknown workspace', async () => {
            const status = await conversation.getModelStatus(creds, clone(unknownClassifier));
            assert.deepStrictEqual(status, unknownClassifierWithStatus);
        });


        it('should get status for a workspace used by a Scratch key', async () => {
            getStub.resetHistory();

            const status = await conversation.getScratchKeyModelStatus(creds, 'good', 'scratch project');
            assert.strictEqual(status.status, 'Available');
            assert.strictEqual(status.workspace_id, 'good');
            assert.strictEqual(status.name, 'scratch project');
            assert(getStub.calledOnceWith('http://conversation.service/v1/workspaces/good', sinon.match.any));
        });


        it('should encode workspace ids from Scratch keys', async () => {
            getStub.resetHistory();

            const status = await conversation.getScratchKeyModelStatus(creds, '../other', 'scratch project');
            assert.strictEqual(status.status, 'Non Existent');
            assert(getStub.calledOnceWith('http://conversation.service/v1/workspaces/..%2Fother', sinon.match.any));
        });
    });
});
