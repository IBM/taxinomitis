import { describe, it, before, after, beforeEach } from 'node:test';

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


describe('Training - text models', () => {

    let getStub: sinon.SinonStub<any, any>;
    let createStub: sinon.SinonStub<any, any>;
    let deleteStub: sinon.SinonStub<any, any>;
    let getProjectStub: sinon.SinonStub<[string], Promise<DbTypes.Project | undefined>>;
    let authStoreStub: sinon.SinonStub<[DbTypes.ClassTenant, TrainingTypes.BluemixServiceType], Promise<TrainingTypes.BluemixCredentials[]>>;
    let authByIdStoreStub: sinon.SinonStub<[DbTypes.ClassTenantType, string], Promise<TrainingTypes.BluemixCredentials>>;
    let countStoreStub: sinon.SinonStub<[DbTypes.Project], Promise<{ [label: string]: number; }>>;
    let getConversationWorkspacesStub: sinon.SinonStub<[string], Promise<TrainingTypes.ConversationWorkspace[]>>;
    let getConversationWorkspaceStub: sinon.SinonStub<[string, string], Promise<TrainingTypes.ConversationWorkspace>>;
    let getStoreStub: sinon.SinonStub<[string, string, DbTypes.PagingOptions], Promise<string[]>>;
    let storeStoreStub: sinon.SinonStub<[TrainingTypes.BluemixCredentials, DbTypes.Project | DbTypes.LocalProject, TrainingTypes.ConversationWorkspace], Promise<TrainingTypes.ConversationWorkspace>>;
    let updateConversationStub: sinon.SinonStub<[TrainingTypes.ConversationWorkspace], Promise<void>>;
    let deleteStoreStub: sinon.SinonStub<[string], Promise<void>>;
    let storeScratchKeyStub: sinon.SinonStub<[DbTypes.Project | DbTypes.LocalProject, TrainingTypes.BluemixCredentials, string, Date], Promise<string>>;
    let resetExpiredScratchKeyStub: sinon.SinonStub<[string, DbTypes.ProjectTypeLabel], Promise<void>>;
    let updateScratchKeyTimestampStub: sinon.SinonStub<[DbTypes.Project | DbTypes.LocalProject, Date], Promise<void>>;
    let getClassStub: sinon.SinonStub<[string], Promise<DbTypes.ClassTenant>>;


    before(() => {
        getStub = sinon.stub(requestUtil, 'get').callsFake(mockConversation.getClassifier);
        createStub = sinon.stub(requestUtil, 'post');
        createStub.withArgs(sinon.match(/.*workspaces/), sinon.match.any).callsFake(mockConversation.createClassifier);
        createStub.withArgs(sinon.match(/.*message/), sinon.match.any).callsFake(mockConversation.testClassifier);
        deleteStub = sinon.stub(requestUtil, 'del').callsFake(mockConversation.deleteClassifier);

        getProjectStub = sinon.stub(store, 'getProject').callsFake(mockstore.getProject);
        authStoreStub = sinon.stub(store, 'getBluemixCredentials').callsFake(mockstore.getBluemixCredentials);
        authByIdStoreStub = sinon.stub(store, 'getBluemixCredentialsById').callsFake(mockstore.getBluemixCredentialsById);
        getConversationWorkspacesStub = sinon.stub(store, 'getConversationWorkspaces').callsFake(mockstore.getConversationWorkspaces);
        getConversationWorkspaceStub = sinon.stub(store, 'getConversationWorkspace');
        countStoreStub = sinon.stub(store, 'countTrainingByLabel').callsFake(mockstore.countTrainingByLabel);
        getStoreStub = sinon.stub(store, 'getUniqueTrainingTextsByLabel').callsFake(mockstore.getUniqueTrainingTextsByLabel);
        storeStoreStub = sinon.stub(store, 'storeConversationWorkspace').callsFake(mockstore.storeConversationWorkspace);
        updateConversationStub = sinon.stub(store, 'updateConversationWorkspaceExpiry').callsFake(mockstore.updateConversationWorkspaceExpiry);
        deleteStoreStub = sinon.stub(store, 'deleteConversationWorkspace').callsFake(mockstore.deleteConversationWorkspace);
        storeScratchKeyStub = sinon.stub(store, 'storeOrUpdateScratchKey').callsFake(mockstore.storeOrUpdateScratchKey);
        updateScratchKeyTimestampStub = sinon.stub(store, 'updateScratchKeyTimestamp').callsFake(mockstore.updateScratchKeyTimestamp);
        resetExpiredScratchKeyStub = sinon.stub(store, 'resetExpiredScratchKey').callsFake(mockstore.resetExpiredScratchKey);
        getClassStub = sinon.stub(store, 'getClassTenant').callsFake(mockstore.getClassTenant);
    });
    beforeEach(() => {
        createStub.resetHistory();
        deleteStub.resetHistory();
        storeStoreStub.resetHistory();
        updateConversationStub.resetHistory();
        deleteStoreStub.resetHistory();
        storeScratchKeyStub.resetHistory();
        updateScratchKeyTimestampStub.resetHistory();
        resetExpiredScratchKeyStub.resetHistory();
    });
    after(() => {
        getStub.restore();
        createStub.restore();
        deleteStub.restore();
        getProjectStub.restore();
        authStoreStub.restore();
        authByIdStoreStub.restore();
        getConversationWorkspacesStub.restore();
        getConversationWorkspaceStub.restore();
        countStoreStub.restore();
        getStoreStub.restore();
        storeStoreStub.restore();
        updateConversationStub.restore();
        deleteStoreStub.restore();
        storeScratchKeyStub.restore();
        updateScratchKeyTimestampStub.restore();
        resetExpiredScratchKeyStub.restore();
        getClassStub.restore();
    });


    const TESTTENANT: DbTypes.ClassTenant = {
        id: 'TESTTENANT',
        maxUsers : 10,
        tenantType : DbTypes.ClassTenantType.UnManaged,
        supportedProjectTypes : [ 'text', 'images', 'numbers', 'sounds' ],
        textClassifierExpiry : 1,
        maxProjectsPerUser : 10,
    };
    const CLASS: DbTypes.ClassTenant = {
        id: 'CLASSID',
        maxUsers : 6,
        tenantType : DbTypes.ClassTenantType.UnManaged,
        supportedProjectTypes : [ 'text', 'images', 'numbers' ],
        textClassifierExpiry : 1,
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


    function createProject(projectid: string, name: string, language: DbTypes.TextProjectLanguage, labels: string[]): DbTypes.Project {
        return {
            id : projectid,
            name,
            userid : 'bob', classid : TESTTENANT.id,
            type : 'text',
            language,
            labels,
            numfields : 0,
            isCrowdSourced : false,
        };
    }



    describe('create model', () => {

        it('should create a model using the training data from the project', async () => {
            const project = createProject('projectbob', 'Bob\'s text project', 'fr', ['temperature', 'conditions']);

            const classifier = await textmodels.trainClassifier(project);
            assert(classifier.id);

            assert.deepStrictEqual(classifier, {
                id : classifier.id,
                name : 'Bob\'s text project',
                language : 'fr',
                created : newClassifierDate,
                updated : newClassifierDate,
                expiry : newExpiryDate,
                workspace_id : '04f2d303-16fd-4f2e-80f4-2c66784cc0fe',
                credentialsid : '123',
                status : 'Training',
                url : 'http://conversation.service/v1/workspaces/04f2d303-16fd-4f2e-80f4-2c66784cc0fe',
            });

            const training = createStub.lastCall.args[1].body;
            assert.strictEqual(training.language, 'fr');
            assert.strictEqual(training.intents[0].intent, 'temperature');
            assert.strictEqual(training.intents[1].intent, 'conditions');
            assert.strictEqual(training.intents[0].examples.length, 18);
            assert.strictEqual(training.intents[1].examples.length, 16);

            assert(storeStoreStub.calledOnceWith(mockstore.creds, project, classifier));
            assert(storeScratchKeyStub.calledOnceWith(project, mockstore.creds,
                '04f2d303-16fd-4f2e-80f4-2c66784cc0fe', newClassifierDate));
        });


        it('should create a model using provided training data', async () => {
            const project = createProject('projectbob', 'Bob\'s text project', 'fr', []);
            const training: TrainingTypes.ConversationTrainingData = {
                name : project.name,
                language : 'fr',
                intents : [ { intent : 'label', examples : [ { text : 'example' } ] } ],
                dialog_nodes : [],
                counterexamples : [],
                entities : [],
                metadata : { createdby : 'machinelearningforkids' },
            };

            const classifier = await textmodels.trainClassifierForProject(project, training);
            assert.strictEqual(classifier.workspace_id, '04f2d303-16fd-4f2e-80f4-2c66784cc0fe');
            assert.deepStrictEqual(createStub.lastCall.args[1].body, training);
            assert(countStoreStub.neverCalledWith(project));

            assert(storeStoreStub.calledOnce);
            assert(storeScratchKeyStub.calledOnce);
        });


        it('should not store anything if the model could not be created', async () => {
            const project = createProject('projectbob', 'Bob\'s broken project', 'pt-br', ['temperature', 'conditions']);

            await assert.rejects(
                () => textmodels.trainClassifier(project),
                { message : textmodels.ERROR_MESSAGES.UNKNOWN });

            assert(storeStoreStub.notCalled);
            assert(storeScratchKeyStub.notCalled);
        });


        it('should report failures to store a new model', async () => {
            const project = createProject('projectbob', 'Bob\'s text project', 'fr', ['temperature', 'conditions']);

            const dbError = new Error('DB is unavailable');
            storeStoreStub.onFirstCall().rejects(dbError);
            const notifyStub = sinon.stub(notifications, 'notify');

            try {
                await assert.rejects(
                    () => textmodels.trainClassifier(project),
                    dbError);

                assert(notifyStub.calledOnce);
                assert(notifyStub.firstCall.args[0].includes('projectbob'));
                assert(notifyStub.firstCall.args[0].includes('DB is unavailable'));
                assert.strictEqual(notifyStub.firstCall.args[1], notifications.SLACK_CHANNELS.TRAINING_ERRORS);
                assert(storeScratchKeyStub.notCalled);
            }
            finally {
                notifyStub.restore();
                storeStoreStub.reset();
                storeStoreStub.callsFake(mockstore.storeConversationWorkspace);
            }
        });
    });



    describe('update model', () => {

        it('should update a model', async () => {
            const project = createProject('existingprojectid', 'existing', 'de', ['big', 'small']);

            const before = new Date();

            const classifier = await textmodels.trainClassifier(project);

            assert.notStrictEqual(existingClassifier.expiry.getTime(),
                                  classifier.expiry.getTime());
            assert(classifier.expiry.getTime() > before.getTime());

            assert(updateConversationStub.calledOnceWith(classifier));
            assert(updateScratchKeyTimestampStub.calledOnceWith(project, classifier.updated));
            assert(storeStoreStub.notCalled);
            assert(deleteStoreStub.notCalled);
        });


        it('should not update records if the model could not be updated', async () => {
            const project = createProject('existingprojectid-maintenance', 'existing', 'de', ['big', 'small']);

            await assert.rejects(
                () => textmodels.trainClassifier(project),
                { message : conversation.ERROR_MESSAGES.MAINTENANCE });

            assert(updateConversationStub.notCalled);
            assert(updateScratchKeyTimestampStub.notCalled);
            assert(deleteStoreStub.notCalled);
        });


        it('should delete the record of a model that could not be found', async () => {
            const project = createProject('deletedprojectid', 'existing', 'de', ['big', 'small']);
            const existing: TrainingTypes.ConversationWorkspace = {
                ...clone(existingClassifier),
                id : 'deletedworkspacedbid',
                workspace_id : 'deleted-from-watson',
            };
            getConversationWorkspacesStub.withArgs('deletedprojectid').resolves([ existing ]);

            try {
                await assert.rejects(
                    () => textmodels.trainClassifier(project),
                    { message : textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND });

                assert(deleteStoreStub.calledOnceWith('deletedworkspacedbid'));
                assert(updateConversationStub.notCalled);
            }
            finally {
                getConversationWorkspacesStub.withArgs('deletedprojectid').callsFake(mockstore.getConversationWorkspaces);
            }
        });


        it('should report a model that could not be found even if its record cannot be deleted', async () => {
            const project = createProject('deletedprojectid', 'existing', 'de', ['big', 'small']);
            const existing: TrainingTypes.ConversationWorkspace = {
                ...clone(existingClassifier),
                id : 'deletedworkspacedbid',
                workspace_id : 'deleted-from-watson',
            };
            getConversationWorkspacesStub.withArgs('deletedprojectid').resolves([ existing ]);
            deleteStoreStub.onFirstCall().rejects(new Error('DB is unavailable'));

            try {
                await assert.rejects(
                    () => textmodels.trainClassifier(project),
                    { message : textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND });

                assert(deleteStoreStub.calledOnceWith('deletedworkspacedbid'));
            }
            finally {
                getConversationWorkspacesStub.withArgs('deletedprojectid').callsFake(mockstore.getConversationWorkspaces);
                deleteStoreStub.reset();
                deleteStoreStub.callsFake(mockstore.deleteConversationWorkspace);
            }
        });
    });



    describe('train with Scratch key', () => {

        it('should report models that are training', async () => {
            const project = createProject('projectbob', 'Bob\'s text project', 'fr', ['temperature', 'conditions']);

            const status = await textmodels.trainWithScratchKey(project);
            assert.deepStrictEqual(status, { status : 1, msg : 'Model not ready yet', type : 'text' });
        });


        it('should report local models that are training', async () => {
            const project: DbTypes.LocalProject = {
                id : 'projectbob',
                name : 'Bob\'s text project',
                userid : 'bob', classid : TESTTENANT.id,
                type : 'text',
                labels : [],
                expiry : new Date(),
            };
            const training: TrainingTypes.ConversationTrainingData = {
                name : project.name,
                language : 'fr',
                intents : [ { intent : 'label', examples : [ { text : 'example' } ] } ],
                dialog_nodes : [],
                counterexamples : [],
                entities : [],
                metadata : { createdby : 'machinelearningforkids' },
            };

            const status = await textmodels.trainLocalWithScratchKey(project, training);
            assert.deepStrictEqual(status, { status : 1, msg : 'Model not ready yet', type : 'text' });
            assert.deepStrictEqual(createStub.lastCall.args[1].body, training);
        });
    });



    describe('classify', () => {

        it('should not send text from binary files to the Conversation service', async () => {
            await assert.rejects(
                () => textmodels.classifyWithScratchKey(scratchKey('good'), 'PK\u0003\u0004\u0014\u0000'),
                { message : textmodels.ERROR_MESSAGES.TEXT_NOT_PLAIN });

            assert.strictEqual(createStub.called, false);
        });


        it('should not send text that is too long to the Conversation service', async () => {
            await assert.rejects(
                () => textmodels.classifyWithScratchKey(scratchKey('good'), 'x'.repeat(2049)),
                { message : textmodels.ERROR_MESSAGES.TEXT_TOO_LONG });

            assert.strictEqual(createStub.called, false);
        });


        it('should allow text that is the maximum length', async () => {
            const classes = await textmodels.classifyWithScratchKey(scratchKey('good'), 'x'.repeat(2048));
            assert.strictEqual(classes.length, 2);
            assert(createStub.calledOnce);
        });


        it('should return classes from Conversation service', async () => {
            const key = scratchKey('good');

            const classes = await textmodels.classifyWithScratchKey(key, 'Hello');
            assert.deepStrictEqual(classes, [
                { class_name : 'temperature', confidence : 100, classifierTimestamp : key.updated },
                { class_name : 'conditions', confidence : 0, classifierTimestamp : key.updated },
            ]);
        });


        it('should choose a random label when nothing matches', async () => {
            const classes = await textmodels.classifyWithScratchKey(scratchKey('bad'), 'Hello');
            assert.strictEqual(classes.length, 1);
            assert.strictEqual(classes[0].confidence, 0);
            assert.strictEqual(classes[0].random, true);
            assert([ 'temperature', 'conditions' ].includes(classes[0].class_name));
        });


        it('should return nothing when nothing matches for an unknown project', async () => {
            // e.g. local projects, which aren't returned by getProject
            getProjectStub.withArgs('unknownproject').resolves(undefined);

            const key = { ...scratchKey('bad'), projectid : 'unknownproject' };
            const classes = await textmodels.classifyWithScratchKey(key, 'Hello');
            assert.deepStrictEqual(classes, []);
        });


        it('should classify using the stored record of the model', async () => {
            getConversationWorkspaceStub.withArgs('projectbob', 'good').resolves(clone(goodClassifier));

            const classifierTimestamp = new Date();
            const classes = await textmodels.classifyModel(CLASS, 'projectbob', 'good', classifierTimestamp, 'Hello');
            assert.deepStrictEqual(classes, [
                { class_name : 'temperature', confidence : 100, classifierTimestamp },
                { class_name : 'conditions', confidence : 0, classifierTimestamp },
            ]);
            assert(authByIdStoreStub.calledWith(CLASS.tenantType, goodClassifier.credentialsid));
        });


        it('should report models with no stored record as not found', async () => {
            getConversationWorkspaceStub.withArgs('projectbob', 'expired')
                .rejects(new Error('Unexpected response when retrieving conversation workspace details'));

            await assert.rejects(
                () => textmodels.classifyModel(CLASS, 'projectbob', 'expired', new Date(), 'Hello'),
                { message : textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND });

            assert.strictEqual(createStub.called, false);
        });


        function scratchKey(classifierid: string): DbTypes.ScratchKey {
            return {
                id : uuid(),
                name : 'TEST',
                type : 'text',
                projectid : 'projectbob',
                classifierid,
                credentials : creds,
                updated : new Date(),
            };
        }
    });



    describe('delete model', () => {

        it('should delete a model and its records', async () => {
            await textmodels.deleteClassifier(TESTTENANT, goodClassifier);

            assert(deleteStub.calledOnce);
            assert(deleteStub.calledWith('http://conversation.service/v1/workspaces/good', sinon.match.any));
            assert(deleteStoreStub.calledOnceWith(goodClassifier.id));
            assert(resetExpiredScratchKeyStub.calledOnceWith(goodClassifier.workspace_id, 'text'));
        });


        it('should keep the records of a model if the credentials are missing', async () => {
            await assert.rejects(
                () => textmodels.deleteClassifier(TESTTENANT, { ...goodClassifier, credentialsid : 'missing' }),
                { message : 'Unexpected response when retrieving service credentials' });

            assert(deleteStoreStub.notCalled);
            assert(resetExpiredScratchKeyStub.notCalled);
        });
    });



    describe('cleanup expired models', () => {

        let getExpiredStub: sinon.SinonStub<[], Promise<TrainingTypes.ConversationWorkspace[]>>;
        let getCombinedCredsStub: sinon.SinonStub<[string], Promise<TrainingTypes.BluemixCredentials>>;

        before(() => {
            getExpiredStub = sinon.stub(store, 'getExpiredConversationWorkspaces');
            getCombinedCredsStub = sinon.stub(store, 'getCombinedBluemixCredentialsById');
            getCombinedCredsStub.withArgs('123').resolves(creds);
            getCombinedCredsStub.rejects(new Error('Unexpected response when retrieving service credentials'));
        });
        after(() => {
            getExpiredStub.restore();
            getCombinedCredsStub.restore();
        });


        it('should delete expired models and their records', async () => {
            const lostCredentials = { ...trainingClassifier, credentialsid : 'missing' };
            getExpiredStub.resolves([ goodClassifier, lostCredentials ]);

            await textmodels.cleanupExpiredModels();

            assert(deleteStub.calledOnce);
            assert(deleteStub.calledWith('http://conversation.service/v1/workspaces/good', sinon.match.any));

            assert(deleteStoreStub.calledTwice);
            assert(deleteStoreStub.calledWith(goodClassifier.id));
            assert(deleteStoreStub.calledWith(lostCredentials.id));
            assert(resetExpiredScratchKeyStub.calledWith(goodClassifier.workspace_id, 'text'));
            assert(resetExpiredScratchKeyStub.calledWith(lostCredentials.workspace_id, 'text'));
        });
    });



    describe('get model statuses', () => {

        it('should get info for a ready model', async () => {
            const reqClone = clone([ goodClassifier ]);
            const one = await textmodels.getModelStatuses(CLASS, reqClone);

            assert.deepStrictEqual(one, [ goodClassifierWithStatus ]);
        });


        it('should get info for a broken model', async () => {
            const reqClone = clone([ brokenClassifier ]);
            const one = await textmodels.getModelStatuses(CLASS, reqClone);

            assert.deepStrictEqual(one, [ brokenClassifierWithStatus ]);
        });

        it('should get info for multiple models', async () => {
            const reqClone = clone([
                goodClassifier,
                brokenClassifier,
                trainingClassifier,
            ]);
            const three = await textmodels.getModelStatuses(CLASS, reqClone);

            assert.deepStrictEqual(three, [
                goodClassifierWithStatus,
                brokenClassifierWithStatus,
                trainingClassifierWithStatus,
            ]);
        });

        it('should get info for no models', async () => {
            const reqClone: TrainingTypes.ConversationWorkspace[] = [ ];
            const none = await textmodels.getModelStatuses(CLASS, reqClone);

            assert.deepStrictEqual(none, []);
        });


        it('should get info for unknown models', async () => {
            const reqClone = clone([
                brokenClassifier,
                unknownClassifier,
                trainingClassifier,
                goodClassifier,
            ]);
            const three = await textmodels.getModelStatuses(CLASS, reqClone);

            assert.deepStrictEqual(three, [
                brokenClassifierWithStatus,
                unknownClassifierWithStatus,
                trainingClassifierWithStatus,
                goodClassifierWithStatus,
            ]);
        });


        it('should report models with missing credentials as unavailable', async () => {
            const reqClone = clone([
                { ...goodClassifier, credentialsid : 'missing' },
            ]);
            const one = await textmodels.getModelStatuses(CLASS, reqClone);

            assert.strictEqual(one[0].status, 'Unavailable');
        });
    });


    describe('normalize text', () => {
        it('should return expected text', () => {
            const TESTS = [
                { input : 'HELLO', expected : 'hello' },
                { input : 'Hello', expected : 'hello' },
                { input : 'HÉLLO', expected : 'hello' },
                { input : 'héllo', expected : 'hello' },
                { input : 'àèìòùÀÈÌÒÙ', expected : 'aeiouaeiou' }
            ];
            for (const test of TESTS) {
                assert.strictEqual(test.expected, textmodels.normalizeText(test.input));
            }
        });
    });


    describe('validate training', () => {
        function training(): any {
            return {
                name : 'test',
                language : 'en',
                intents : [ { intent : 'label', examples : [ { text : 'example' } ] } ],
                dialog_nodes : [],
                counterexamples : [],
                entities : [],
                metadata : { createdby : 'machinelearningforkids' },
            };
        }

        it('should accept valid training', () => {
            assert(textmodels.validateTraining(training()));
        });

        it('should reject missing training', () => {
            assert(!textmodels.validateTraining(undefined as any));
        });

        it('should reject training with missing fields', () => {
            for (const field of [ 'name', 'language', 'intents', 'entities', 'dialog_nodes' ]) {
                const invalid = training();
                delete invalid[field];
                assert(!textmodels.validateTraining(invalid), field);
            }
        });

        it('should reject training with invalid intents', () => {
            const missingName = training();
            missingName.intents[0].intent = '';
            assert(!textmodels.validateTraining(missingName));

            const notText = training();
            notText.intents[0].examples[0].text = 123;
            assert(!textmodels.validateTraining(notText));
        });
    });


    describe('sanitize training', () => {
        it('should remove duplicates from a training set', () => {
            const language: DbTypes.TextProjectLanguage = 'en';
            const testinput = {
                name: "Me hace feliz",
                language,
                intents:[
                    {
                        intent: 'bien',
                        examples:[
                            {text:'guapo'},
                            {text:'hermoso'},
                            {text:'Amort'},
                            {text:'precioso'},
                            {text:'listo'},
                            {text:'inteligente'},
                            {text:'gracioso'},
                            {text:'amort'},
                            {text:'amor'},
                            {text:'tt'}
                        ]
                    },
                    {
                        intent: 'mal',
                        examples:[
                            {text:'feo'},
                            {text:'tonto'},
                            {text:'tontorron'},
                            {text:'aburrido'},
                            {text:'autista'},
                            {text:'retrasado'},
                            {text:'malo'},
                            {text:'tontorrón'},
                            {text:'Autista'}
                        ]
                    }
                ],
                dialog_nodes:[],
                counterexamples:[],
                entities:[],
                metadata:{createdby:'machinelearningforkids'}
            };
            const output = textmodels.sanitizeTraining(testinput);
            assert.deepStrictEqual(output.intents[0].examples.map(e => e.text),
                [ 'guapo', 'hermoso', 'Amort', 'precioso', 'listo',
                  'inteligente', 'gracioso', 'amor', 'tt' ]);
            assert.deepStrictEqual(output.intents[1].examples.map(e => e.text),
                [ 'feo', 'tonto', 'tontorron', 'aburrido', 'autista',
                  'retrasado', 'malo' ]);
        });

        it('should keep the project name', () => {
            const language: DbTypes.TextProjectLanguage = 'en';
            const TESTS = [
                { input : 'My project', expected : 'My project' },
                { input : 'My\tproject\nname', expected : 'My_project_name' },
                { input : 'x'.repeat(64), expected : 'x'.repeat(64) },
                { input : 'a'.repeat(64) + 'b'.repeat(10), expected : 'a'.repeat(64) },
            ];
            for (const test of TESTS) {
                const output = textmodels.sanitizeTraining({
                    name : test.input,
                    language,
                    intents : [ { intent : 'label', examples : [ { text : 'example' } ] } ],
                    dialog_nodes : [],
                    counterexamples : [],
                    entities : [],
                    metadata : { createdby : 'machinelearningforkids' },
                });
                assert.strictEqual(output.name, test.expected);
            }
        });

        it('should truncate long examples', () => {
            const language: DbTypes.TextProjectLanguage = 'en';
            const output = textmodels.sanitizeTraining({
                name : 'test',
                language,
                intents : [ { intent : 'label', examples : [ { text : 'x'.repeat(1100) }, { text : 'short' } ] } ],
                dialog_nodes : [],
                counterexamples : [],
                entities : [],
                metadata : { createdby : 'machinelearningforkids' },
            });
            assert.deepStrictEqual(output.intents[0].examples.map(e => e.text), [ 'x'.repeat(1024), 'short' ]);
        });
    });

    describe('check training is plain text', () => {
        const language: DbTypes.TextProjectLanguage = 'en';
        function training(examples: string[]) {
            return {
                name : 'test',
                language,
                intents : [
                    { intent : 'safe', examples : [ { text : 'www.google.com' } ] },
                    { intent : 'phishing', examples : examples.map((text) => { return { text }; }) },
                ],
                dialog_nodes : [],
                counterexamples : [],
                entities : [],
                metadata : { createdby : 'machinelearningforkids' },
            };
        }

        it('should allow plain text', () => {
            assert.strictEqual(textmodels.isPlainTextTraining(training([ 'www.goagle.com' ])), true);
        });

        it('should reject training with the contents of a binary file', () => {
            assert.strictEqual(textmodels.isPlainTextTraining(training([
                'www.goagle.com', 'PK\u0003\u0004\u0014\u0000\u0006\u0000',
            ])), false);
        });
    });
});
