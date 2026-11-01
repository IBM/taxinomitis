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
    let authByIdStoreStub: sinon.SinonStub<[DbTypes.ClassTenantType, string], Promise<TrainingTypes.BluemixCredentials>>;

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
        authByIdStoreStub = sinon.stub(store, 'getBluemixCredentialsById').callsFake(mockstore.getBluemixCredentialsById);

        notAllowedStubs = [
            sinon.stub(store, 'countTrainingByLabel'),
            sinon.stub(store, 'getUniqueTrainingTextsByLabel'),
            sinon.stub(store, 'storeConversationWorkspace'),
            sinon.stub(store, 'updateConversationWorkspaceExpiry'),
            sinon.stub(store, 'deleteConversationWorkspace'),
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

    const POOLTENANT: DbTypes.ClassTenant = {
        ...TESTTENANT,
        id : 'POOLTENANT',
        tenantType : DbTypes.ClassTenantType.ManagedPool,
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

            const { workspace, credentials } = await conversation.createModel(project, TESTTENANT, training);
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
                () => conversation.createModel(project, TESTTENANT, createTraining(project.name, 'pt-br')),
                { message : textmodels.ERROR_MESSAGES.UNKNOWN });
        });


        it('should handle model limit failures to create a workspace', async () => {
            const project = createProject('projectbob', 'Too Many Models', 'en');

            await assert.rejects(
                () => conversation.createModel(project, TESTTENANT, createTraining(project.name, 'en')),
                { message : conversation.ERROR_MESSAGES.INSUFFICIENT_API_KEYS });
        });


        it('should handle rate limit failures to create a workspace', async () => {
            const project = createProject('projectbob', 'Coming Too Fast', 'en');

            await assert.rejects(
                () => conversation.createModel(project, TESTTENANT, createTraining(project.name, 'en')),
                { message : conversation.ERROR_MESSAGES.API_KEY_RATE_LIMIT });
        });


        it('should handle maintenance errors when creating a workspace', async () => {
            const project = createProject('projectbob', 'Watson Under Maintenance', 'en');

            await assert.rejects(
                () => conversation.createModel(project, TESTTENANT, createTraining(project.name, 'en')),
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
            const existing: TrainingTypes.ConversationWorkspace = {
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
            const existing: TrainingTypes.ConversationWorkspace = {
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



    describe('delete model', () => {

        it('should delete a workspace', async () => {
            deleteStub.resetHistory();

            await conversation.deleteModel(TESTTENANT, goodClassifier);

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

            await conversation.deleteModel(TESTTENANT, {
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
                await conversation.deleteModel(POOLTENANT, goodClassifier);

                assert(deleteStub.calledOnce);
                assert(poolDeletionStub.calledOnceWith(mockstore.creds as TrainingTypes.BluemixCredentialsPool));
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
                await conversation.deleteModel(POOLTENANT, goodClassifier);

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
                () => conversation.deleteModel(TESTTENANT, { ...goodClassifier, credentialsid : 'missing' }),
                { message : 'Unexpected response when retrieving service credentials' });

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
