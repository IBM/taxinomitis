import { describe, it, before, after, beforeEach, afterEach } from 'node:test';

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
import * as textservice from '../../lib/training/textservice';
import * as env from '../../lib/utils/env';

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
    let authByIdStoreStub: sinon.SinonStub<[string], Promise<TrainingTypes.BluemixCredentials>>;
    let countStoreStub: sinon.SinonStub<[DbTypes.Project], Promise<{ [label: string]: number; }>>;
    let getTextClassifiersStub: sinon.SinonStub<[string], Promise<TrainingTypes.TextClassifier[]>>;
    let getTextClassifierStub: sinon.SinonStub<[string, string], Promise<TrainingTypes.TextClassifier>>;
    let getStoreStub: sinon.SinonStub<[string, string, DbTypes.PagingOptions], Promise<string[]>>;
    let storeStoreStub: sinon.SinonStub<[DbTypes.Project | DbTypes.LocalProject, TrainingTypes.TextClassifier], Promise<TrainingTypes.TextClassifier>>;
    let updateConversationStub: sinon.SinonStub<[TrainingTypes.TextClassifier], Promise<void>>;
    let deleteStoreStub: sinon.SinonStub<[string], Promise<void>>;
    let storeScratchKeyStub: sinon.SinonStub<[DbTypes.Project | DbTypes.LocalProject, TrainingTypes.BluemixCredentials, string, Date], Promise<string>>;
    let resetExpiredScratchKeyStub: sinon.SinonStub<[string, DbTypes.ProjectTypeLabel], Promise<void>>;
    let updateScratchKeyTimestampStub: sinon.SinonStub<[DbTypes.Project | DbTypes.LocalProject, Date], Promise<void>>;
    let getClassStub: sinon.SinonStub<[string], Promise<DbTypes.ClassTenant>>;
    let usageStub: sinon.SinonStub<[DbTypes.TextServiceUsageEvent], Promise<void>>;


    before(() => {
        usageStub = sinon.stub(store, 'storeTextServiceUsageEvent').resolves();
        getStub = sinon.stub(requestUtil, 'get').callsFake(mockConversation.getClassifier);
        createStub = sinon.stub(requestUtil, 'post');
        createStub.withArgs(sinon.match(/.*workspaces/), sinon.match.any).callsFake(mockConversation.createClassifier);
        createStub.withArgs(sinon.match(/.*message/), sinon.match.any).callsFake(mockConversation.testClassifier);
        deleteStub = sinon.stub(requestUtil, 'del').callsFake(mockConversation.deleteClassifier);

        getProjectStub = sinon.stub(store, 'getProject').callsFake(mockstore.getProject);
        authStoreStub = sinon.stub(store, 'getBluemixCredentials').callsFake(mockstore.getBluemixCredentials);
        authByIdStoreStub = sinon.stub(store, 'getCombinedBluemixCredentialsById').callsFake(mockstore.getCombinedBluemixCredentialsById);
        getTextClassifiersStub = sinon.stub(store, 'getTextClassifiers').callsFake(mockstore.getTextClassifiers);
        getTextClassifierStub = sinon.stub(store, 'getTextClassifier');
        countStoreStub = sinon.stub(store, 'countTrainingByLabel').callsFake(mockstore.countTrainingByLabel);
        getStoreStub = sinon.stub(store, 'getUniqueTrainingTextsByLabel').callsFake(mockstore.getUniqueTrainingTextsByLabel);
        storeStoreStub = sinon.stub(store, 'storeTextClassifier').callsFake(mockstore.storeTextClassifier);
        updateConversationStub = sinon.stub(store, 'updateTextClassifierExpiry').callsFake(mockstore.updateConversationWorkspaceExpiry);
        deleteStoreStub = sinon.stub(store, 'deleteTextClassifier').callsFake(mockstore.deleteTextClassifier);
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
        usageStub.restore();
        getStub.restore();
        createStub.restore();
        deleteStub.restore();
        getProjectStub.restore();
        authStoreStub.restore();
        authByIdStoreStub.restore();
        getTextClassifiersStub.restore();
        getTextClassifierStub.restore();
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
                servicetype : 'conv',
                status : 'Training',
                url : 'http://conversation.service/v1/workspaces/04f2d303-16fd-4f2e-80f4-2c66784cc0fe',
            });

            const training = createStub.lastCall.args[1].body;
            assert.strictEqual(training.language, 'fr');
            assert.strictEqual(training.intents[0].intent, 'temperature');
            assert.strictEqual(training.intents[1].intent, 'conditions');
            assert.strictEqual(training.intents[0].examples.length, 18);
            assert.strictEqual(training.intents[1].examples.length, 16);

            assert(storeStoreStub.calledOnceWith(project, classifier));
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
                storeStoreStub.callsFake(mockstore.storeTextClassifier);
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
            const existing: TrainingTypes.TextClassifier = {
                ...clone(existingClassifier),
                id : 'deletedworkspacedbid',
                workspace_id : 'deleted-from-watson',
            };
            getTextClassifiersStub.withArgs('deletedprojectid').resolves([ existing ]);

            try {
                await assert.rejects(
                    () => textmodels.trainClassifier(project),
                    { message : textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND });

                assert(deleteStoreStub.calledOnceWith('deletedworkspacedbid'));
                assert(updateConversationStub.notCalled);
            }
            finally {
                getTextClassifiersStub.withArgs('deletedprojectid').callsFake(mockstore.getTextClassifiers);
            }
        });


        it('should report a model that could not be found even if its record cannot be deleted', async () => {
            const project = createProject('deletedprojectid', 'existing', 'de', ['big', 'small']);
            const existing: TrainingTypes.TextClassifier = {
                ...clone(existingClassifier),
                id : 'deletedworkspacedbid',
                workspace_id : 'deleted-from-watson',
            };
            getTextClassifiersStub.withArgs('deletedprojectid').resolves([ existing ]);
            deleteStoreStub.onFirstCall().rejects(new Error('DB is unavailable'));

            try {
                await assert.rejects(
                    () => textmodels.trainClassifier(project),
                    { message : textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND });

                assert(deleteStoreStub.calledOnceWith('deletedworkspacedbid'));
            }
            finally {
                getTextClassifiersStub.withArgs('deletedprojectid').callsFake(mockstore.getTextClassifiers);
                deleteStoreStub.reset();
                deleteStoreStub.callsFake(mockstore.deleteTextClassifier);
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
            getTextClassifierStub.withArgs('projectbob', 'good').resolves(clone(goodClassifier));

            const classifierTimestamp = new Date();
            const classes = await textmodels.classifyModel(CLASS, 'projectbob', 'good', classifierTimestamp, 'Hello');
            assert.deepStrictEqual(classes, [
                { class_name : 'temperature', confidence : 100, classifierTimestamp },
                { class_name : 'conditions', confidence : 0, classifierTimestamp },
            ]);
            assert(authByIdStoreStub.calledWith(goodClassifier.credentialsid));
        });


        it('should report models with no stored record as not found', async () => {
            getTextClassifierStub.withArgs('projectbob', 'expired')
                .rejects(new Error('Unexpected response when retrieving text classifier details'));

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
                { message : 'Unexpected response when retrieving the service credentials' });

            assert(deleteStoreStub.notCalled);
            assert(resetExpiredScratchKeyStub.notCalled);
        });
    });



    describe('cleanup expired models', () => {

        let getExpiredStub: sinon.SinonStub<[], Promise<TrainingTypes.TextClassifier[]>>;

        before(() => {
            getExpiredStub = sinon.stub(store, 'getExpiredConversationWorkspaces');
        });
        after(() => {
            getExpiredStub.restore();
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
            const reqClone: TrainingTypes.TextClassifier[] = [ ];
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



    describe('text service models', () => {

        let isConfiguredStub: sinon.SinonStub<[], boolean>;
        let trainStub: sinon.SinonStub<any, any>;
        let classifyStub: sinon.SinonStub<any, any>;
        let countTxtStub: sinon.SinonStub<any, any>;
        let getHeadStub: sinon.SinonStub<any, any>;
        let poolStub: sinon.SinonStub<any, any>;
        let createTrainingStub: sinon.SinonStub<any, any>;
        let claimStub: sinon.SinonStub<any, any>;
        let placeholderStub: sinon.SinonStub<any, any>;
        let finishStub: sinon.SinonStub<any, any>;
        let failStub: sinon.SinonStub<any, any>;
        let getStateStub: sinon.SinonStub<any, any>;
        let replacePlaceholderStub: sinon.SinonStub<any, any>;

        const KEYLESS: DbTypes.ClassTenant = {
            id : 'KEYLESS',
            maxUsers : 10,
            tenantType : DbTypes.ClassTenantType.UnManaged,
            supportedProjectTypes : [ 'text' ],
            textClassifierExpiry : 2,
            maxProjectsPerUser : 3,
        };
        const POOL: DbTypes.ClassTenant = { ...KEYLESS, id : 'POOL', tenantType : DbTypes.ClassTenantType.ManagedPool };
        const MANAGED: DbTypes.ClassTenant = { ...KEYLESS, id : 'session-users', tenantType : DbTypes.ClassTenantType.Managed };

        const HEAD = Buffer.from([ 0x4d, 0x4c, 0x46, 0x4b, 0x01, 0x02 ]);
        const MODELID = 'b0a5a5c8-2f2c-4d5e-9d3e-8a1f6e2b7c40';
        const TRAINED = new Date('2026-10-30T10:00:00Z');
        const TWO_HOURS = 2 * 60 * 60 * 1000;

        const TXT_KEY_CREDENTIALS = sinon.match({ url : '', username : 'txt', password : '' });

        function keylessProject(projectid: string): DbTypes.Project {
            return { ...createProject(projectid, 'Keyless project', 'en', [ 'temperature', 'conditions' ]), classid : KEYLESS.id };
        }

        function keylessLocalProject(projectid: string): DbTypes.LocalProject {
            return {
                id : projectid, name : 'Keyless local project',
                userid : 'bob', classid : KEYLESS.id,
                type : 'text', labels : [], expiry : new Date(),
            };
        }

        const TRAINING: TrainingTypes.ConversationTrainingData = {
            name : 'Keyless local project',
            language : 'en',
            intents : [
                { intent : 'label', examples : [ { text : 'example' } ] },
                { intent : 'other', examples : [ { text : 'another example' } ] },
            ],
            dialog_nodes : [],
            counterexamples : [],
            entities : [],
            metadata : { createdby : 'machinelearningforkids' },
        };

        function busy(retryAfterMs?: number): textservice.TextServiceTrainingError {
            return new textservice.TextServiceTrainingError(textmodels.ERROR_MESSAGES.SERVICE_BUSY, 'busy', true, retryAfterMs);
        }
        function droppedConnection(): textservice.TextServiceTrainingError {
            return new textservice.TextServiceTrainingError(textmodels.ERROR_MESSAGES.SERVICE_ERROR, 'network', true);
        }
        function invalidTraining(): textservice.TextServiceTrainingError {
            return new textservice.TextServiceTrainingError(textmodels.ERROR_MESSAGES.UNKNOWN, 'invalid', false);
        }

        // trainings started by deferredTraining that haven't finished,
        //  which are finished after each test, so that a failed test
        //  doesn't leave a training running into the next test
        const unfinishedTrainings: (() => void)[] = [];

        /** a training that the test finishes when it chooses */
        function deferredTraining(): { resolve: () => void, reject: (err: Error) => void } {
            let resolve: () => void = () => { /* replaced below */ };
            let reject: (err: Error) => void = () => { /* replaced below */ };
            trainStub.callsFake(() => new Promise((res, rej) => {
                resolve = () => res({ modelid : MODELID, head : HEAD });
                reject = rej;
                unfinishedTrainings.push(resolve);
            }));
            return {
                resolve : () => resolve(),
                reject : (err: Error) => reject(err),
            };
        }


        //
        // a fake of the text service models stored in the DB, so that a test
        //  can follow a model through its training
        //

        interface FakeTextServiceModel {
            readonly projectid: string;
            readonly model: { -readonly [K in keyof TrainingTypes.TextClassifier]: TrainingTypes.TextClassifier[K] };
            head?: Buffer;
            updated: Date;
            trainingstarted?: Date;
            trainingfailed?: Date;
        }
        const fakeModels = new Map<string, FakeTextServiceModel>();

        function isCurrentTraining(stored: FakeTextServiceModel | undefined, started: Date): stored is FakeTextServiceModel {
            return !!stored && !!stored.trainingstarted && stored.trainingstarted.getTime() === started.getTime();
        }

        const fakeStore = {
            createTextServiceTraining : (project: DbTypes.Project, model: TrainingTypes.TextClassifier, started: Date) => {
                for (const stored of fakeModels.values()) {
                    if (stored.projectid === project.id) {
                        return Promise.resolve('already-training');
                    }
                }
                fakeModels.set(model.id, { projectid : project.id, model : { ...model }, updated : started, trainingstarted : started });
                return Promise.resolve('created');
            },
            claimTextServiceTraining : (id: string, now: Date, abandonIfStartedBefore: Date) => {
                const stored = fakeModels.get(id);
                if (!stored || (stored.trainingstarted && stored.trainingstarted >= abandonIfStartedBefore)) {
                    return Promise.resolve(undefined);
                }
                stored.trainingstarted = now;
                delete stored.trainingfailed;
                delete stored.head;
                return Promise.resolve(now);
            },
            setTextServiceModelPlaceholder : (id: string) => {
                const stored = fakeModels.get(id);
                if (stored) {
                    stored.model.workspace_id = id;
                }
                return Promise.resolve();
            },
            finishTextServiceTraining : (id: string, started: Date, trained: { modelid: string, head: Buffer, finished: Date, expiry: Date }) => {
                const stored = fakeModels.get(id);
                if (!isCurrentTraining(stored, started)) {
                    return Promise.resolve(false);
                }
                stored.head = trained.head;
                stored.updated = trained.finished;
                delete stored.trainingstarted;
                stored.model.workspace_id = trained.modelid;
                stored.model.expiry = trained.expiry;
                return Promise.resolve(true);
            },
            failTextServiceTraining : (id: string, started: Date, failed: Date) => {
                const stored = fakeModels.get(id);
                if (!isCurrentTraining(stored, started)) {
                    return Promise.resolve(false);
                }
                stored.trainingfailed = failed;
                delete stored.trainingstarted;
                return Promise.resolve(true);
            },
            getTextServiceTrainingState : (id: string) => {
                const stored = fakeModels.get(id);
                if (!stored) {
                    return Promise.resolve(undefined);
                }
                return Promise.resolve({
                    id,
                    hashead : !!stored.head,
                    updated : stored.updated,
                    ...(stored.trainingstarted ? { trainingstarted : stored.trainingstarted } : {}),
                    ...(stored.trainingfailed ? { trainingfailed : stored.trainingfailed } : {}),
                });
            },
            getTextClassifierHead : (id: string) => {
                const stored = fakeModels.get(id);
                if (!stored || !stored.head) {
                    return Promise.resolve(undefined);
                }
                return Promise.resolve({ id, projectid : stored.projectid, userid : 'bob', head : stored.head, updated : stored.updated });
            },
            getTextClassifiers : (projectid: string) => {
                const found = [ ...fakeModels.values() ]
                    .filter((stored) => stored.projectid === projectid)
                    .map((stored) => ({ ...stored.model }));
                return found.length > 0 ? Promise.resolve(found) : mockstore.getTextClassifiers(projectid);
            },
            getTextClassifier : (projectid: string, modelid: string) => {
                for (const stored of fakeModels.values()) {
                    if (stored.projectid === projectid && stored.model.workspace_id === modelid) {
                        return Promise.resolve({ ...stored.model });
                    }
                }
                return Promise.reject(new Error('Unexpected response when retrieving text classifier details'));
            },
            deleteTextClassifier : (id: string) => {
                fakeModels.delete(id);
                return Promise.resolve();
            },
        };


        before(() => {
            isConfiguredStub = sinon.stub(env, 'isTextServiceConfigured').returns(true);
            trainStub = sinon.stub(textservice, 'train');
            classifyStub = sinon.stub(textservice, 'classify');
            countTxtStub = sinon.stub(store, 'countTextModelsByUser');
            getHeadStub = sinon.stub(store, 'getTextClassifierHead');
            poolStub = sinon.stub(store, 'getBluemixCredentialsPoolBatch');
            createTrainingStub = sinon.stub(store, 'createTextServiceTraining');
            claimStub = sinon.stub(store, 'claimTextServiceTraining');
            placeholderStub = sinon.stub(store, 'setTextServiceModelPlaceholder');
            finishStub = sinon.stub(store, 'finishTextServiceTraining');
            failStub = sinon.stub(store, 'failTextServiceTraining');
            getStateStub = sinon.stub(store, 'getTextServiceTrainingState');
            replacePlaceholderStub = sinon.stub(store, 'replaceScratchKeyPlaceholder');

            getClassStub.withArgs(KEYLESS.id).resolves(KEYLESS);
            getClassStub.withArgs(POOL.id).resolves(POOL);
            getClassStub.withArgs(MANAGED.id).resolves(MANAGED);
            authStoreStub.withArgs(sinon.match.has('id', KEYLESS.id), 'conv')
                .rejects(new Error('Unexpected response when retrieving service credentials'));
        });
        beforeEach(() => {
            fakeModels.clear();

            // training for both of the labels in keylessProject, as
            //  the text service needs at least two labels with examples
            countStoreStub.reset();
            countStoreStub.resolves({ temperature : 2, conditions : 2 });

            isConfiguredStub.returns(true);
            trainStub.reset();
            trainStub.resolves({ modelid : MODELID, head : HEAD });
            classifyStub.reset();
            countTxtStub.reset();
            countTxtStub.resolves(0);
            poolStub.reset();
            poolStub.callsFake((pool: TrainingTypes.PoolCredentialSource) => Promise.resolve([ { ...mockstore.poolCreds, source : pool } ]));

            getHeadStub.reset();
            getHeadStub.callsFake(fakeStore.getTextClassifierHead);
            createTrainingStub.reset();
            createTrainingStub.callsFake(fakeStore.createTextServiceTraining);
            claimStub.reset();
            claimStub.callsFake(fakeStore.claimTextServiceTraining);
            placeholderStub.reset();
            placeholderStub.callsFake(fakeStore.setTextServiceModelPlaceholder);
            finishStub.reset();
            finishStub.callsFake(fakeStore.finishTextServiceTraining);
            failStub.reset();
            failStub.callsFake(fakeStore.failTextServiceTraining);
            getStateStub.reset();
            getStateStub.callsFake(fakeStore.getTextServiceTrainingState);
            replacePlaceholderStub.reset();
            replacePlaceholderStub.resolves();

            getTextClassifiersStub.reset();
            getTextClassifiersStub.callsFake(fakeStore.getTextClassifiers);
            getTextClassifierStub.reset();
            getTextClassifierStub.callsFake(fakeStore.getTextClassifier);
            deleteStoreStub.reset();
            deleteStoreStub.callsFake(fakeStore.deleteTextClassifier);
            storeScratchKeyStub.reset();
            storeScratchKeyStub.callsFake(mockstore.storeOrUpdateScratchKey);
        });
        afterEach(async () => {
            for (const finish of unfinishedTrainings.splice(0)) {
                finish();
            }
            await textmodels.waitForTrainings();
        });
        after(() => {
            countStoreStub.reset();
            countStoreStub.callsFake(mockstore.countTrainingByLabel);

            isConfiguredStub.restore();
            trainStub.restore();
            classifyStub.restore();
            countTxtStub.restore();
            getHeadStub.restore();
            poolStub.restore();
            createTrainingStub.restore();
            claimStub.restore();
            placeholderStub.restore();
            finishStub.restore();
            failStub.restore();
            getStateStub.restore();
            replacePlaceholderStub.restore();

            getClassStub.reset();
            getClassStub.callsFake(mockstore.getClassTenant);
            authStoreStub.reset();
            authStoreStub.callsFake(mockstore.getBluemixCredentials);
            getTextClassifiersStub.reset();
            getTextClassifiersStub.callsFake(mockstore.getTextClassifiers);
            getTextClassifierStub.reset();
            deleteStoreStub.reset();
            deleteStoreStub.callsFake(mockstore.deleteTextClassifier);
            storeScratchKeyStub.reset();
            storeScratchKeyStub.callsFake(mockstore.storeOrUpdateScratchKey);
        });


        function existingTxtModel(projectid: string): TrainingTypes.TextClassifier {
            return {
                id : 'txt-dbid-' + projectid,
                workspace_id : 'old-' + MODELID,
                credentialsid : '',
                servicetype : 'txt',
                url : '',
                name : 'Keyless project',
                language : 'en',
                created : new Date('2026-10-30T10:00:00Z'),
                expiry : new Date('2026-10-30T12:00:00Z'),
            };
        }

        /** stores a text service model that has finished training */
        function storeTrainedModel(projectid: string): TrainingTypes.TextClassifier {
            const model = existingTxtModel(projectid);
            fakeModels.set(model.id, { projectid, model : { ...model }, head : HEAD, updated : TRAINED });
            return model;
        }

        function txtScratchKey(projectid: string, classifierid: string): DbTypes.ScratchKey {
            return {
                id : uuid(),
                name : 'Keyless project',
                type : 'text',
                projectid,
                classifierid,
                credentials : {
                    id : '', servicetype : 'txt',
                    url : '', username : 'txt', password : '',
                    classid : KEYLESS.id, credstype : 'unknown',
                },
                updated : new Date('2026-10-30T10:00:00Z'),
            };
        }

        async function getStoredModel(projectid: string): Promise<TrainingTypes.TextClassifier> {
            const models = await store.getTextClassifiers(projectid);
            assert.strictEqual(models.length, 1);
            const [ withStatus ] = await textmodels.getModelStatuses(KEYLESS, models);
            return withStatus;
        }

        /** runs every timer (e.g. retry backoff) until the background trainings end */
        async function runTrainings(clock: sinon.SinonFakeTimers): Promise<void> {
            const finished = textmodels.waitForTrainings();
            await clock.runAllAsync();
            await finished;
        }

        /**
         * Runs a test with fake timers, so that retry waits are instant.
         *
         * The background trainings are always run to the end before the
         *  real timers are restored, even if the test fails - otherwise a
         *  training left waiting on a fake timer would never end, and the
         *  next test waiting for trainings would hang.
         */
        async function withFakeTimers(test: (clock: sinon.SinonFakeTimers) => Promise<void>): Promise<void> {
            const clock = sinon.useFakeTimers({
                now : new Date('2026-11-02T10:00:00Z'),
                toFake : [ 'setTimeout', 'clearTimeout', 'Date' ],
            });
            try {
                await test(clock);
            }
            finally {
                await runTrainings(clock);
                clock.restore();
            }
        }


        describe('routing new models', () => {

            it('should use the text service for a class without Watson Assistant keys', async () => {
                const project = keylessProject('keylessproject');

                const before = new Date();
                const classifier = await textmodels.trainClassifier(project);
                const after = new Date();

                assert.strictEqual(createStub.called, false);

                assert.deepStrictEqual(classifier, {
                    id : classifier.id,
                    // placeholder while the model is training
                    workspace_id : classifier.id,
                    credentialsid : '',
                    servicetype : 'txt',
                    url : '',
                    name : 'Keyless project',
                    language : 'en',
                    created : classifier.created,
                    updated : classifier.created,
                    expiry : new Date(classifier.created.getTime() + TWO_HOURS),
                    status : 'Training',
                });
                assert.strictEqual(classifier.id.length, 36);
                assert(classifier.created.getTime() >= before.getTime());
                assert(classifier.created.getTime() <= after.getTime());

                await textmodels.waitForTrainings();
                assert(trainStub.calledOnce);
            });

            it('should use Watson Assistant for a class with its own keys', async () => {
                const project = createProject('projectbob', 'Bob\'s text project', 'fr', [ 'temperature', 'conditions' ]);

                const classifier = await textmodels.trainClassifier(project);

                assert.strictEqual(classifier.servicetype, 'conv');
                assert(trainStub.notCalled);
                assert(countTxtStub.notCalled);
            });

            it('should report missing keys if the text service is not configured', async () => {
                isConfiguredStub.returns(false);
                const project = keylessProject('keylessproject');

                await assert.rejects(
                    () => textmodels.trainClassifier(project),
                    { message : 'Unexpected response when retrieving service credentials' });

                assert(trainStub.notCalled);
                assert(createTrainingStub.notCalled);
            });

            it('should use the Watson Assistant pool for managed pool classes', async () => {
                const project = { ...createProject('poolproject', 'Bob\'s text project', 'en', [ 'temperature' ]), classid : POOL.id };

                const classifier = await textmodels.trainClassifier(project);

                assert.strictEqual(classifier.servicetype, 'conv');
                assert(poolStub.calledOnce);
                assert(trainStub.notCalled);
                assert(countTxtStub.notCalled);
            });

            it('should use Watson Assistant for session users without checking for keys', async () => {
                // even if the class weren't a managed class
                getClassStub.withArgs(MANAGED.id).resolves({ ...MANAGED, tenantType : DbTypes.ClassTenantType.UnManaged });
                authStoreStub.resetHistory();
                const project = { ...createProject('sessionproject', 'Bob\'s text project', 'en', [ 'temperature' ]), classid : MANAGED.id };

                try {
                    const classifier = await textmodels.trainClassifier(project);

                    assert.strictEqual(classifier.servicetype, 'conv');
                    assert(trainStub.notCalled);
                    assert(countTxtStub.notCalled);
                    // only the Watson Assistant adapter gets the credentials
                    assert(authStoreStub.calledOnce);
                }
                finally {
                    getClassStub.withArgs(MANAGED.id).resolves(MANAGED);
                }
            });

            it('should use Watson Assistant for managed classes', async () => {
                const project = { ...createProject('managedproject', 'Bob\'s text project', 'en', [ 'temperature' ]), classid : MANAGED.id };

                const classifier = await textmodels.trainClassifier(project);

                assert.strictEqual(classifier.servicetype, 'conv');
                assert(trainStub.notCalled);
                assert(countTxtStub.notCalled);
            });
        });


        describe('checking training for the text service', () => {

            function trainingWithIntents(intents: TrainingTypes.ConversationIntent[]): TrainingTypes.ConversationTrainingData {
                return { ...TRAINING, intents };
            }

            const INVALID: { name: string, intents: TrainingTypes.ConversationIntent[] }[] = [
                { name : 'only one label', intents : [ { intent : 'label', examples : [ { text : 'example' } ] } ] },
                { name : 'only one label with examples', intents : [
                    { intent : 'label', examples : [ { text : 'example' } ] },
                    { intent : 'empty', examples : [] },
                ] },
                { name : 'labels with the same name', intents : [
                    { intent : 'label', examples : [ { text : 'example' } ] },
                    { intent : 'label', examples : [ { text : 'another example' } ] },
                ] },
            ];
            for (const testcase of INVALID) {
                it('should turn away a new model with ' + testcase.name, async () => {
                    const project = keylessLocalProject('invalidproject');

                    await assert.rejects(() => textmodels.trainClassifierForProject(project, trainingWithIntents(testcase.intents)),
                        { message : textmodels.ERROR_MESSAGES.INVALID_TRAINING });

                    assert(trainStub.notCalled);
                    assert(createTrainingStub.notCalled);
                    assert.strictEqual(fakeModels.size, 0);
                });

                it('should turn away a retrain with ' + testcase.name + ', keeping the existing model', async () => {
                    const project = keylessLocalProject('invalidproject');
                    const existing = storeTrainedModel(project.id);

                    await assert.rejects(() => textmodels.trainClassifierForProject(project, trainingWithIntents(testcase.intents)),
                        { message : textmodels.ERROR_MESSAGES.INVALID_TRAINING });

                    assert(trainStub.notCalled);
                    assert(claimStub.notCalled);
                    const stored = await getStoredModel(project.id);
                    assert.strictEqual(stored.id, existing.id);
                    assert.strictEqual(stored.status, 'Available');
                });
            }

            it('should leave out labels without examples', async () => {
                const project = keylessLocalProject('emptylabelproject');
                const intents = [
                    { intent : 'label', examples : [ { text : 'example' } ] },
                    { intent : 'empty', examples : [] },
                    { intent : 'other', examples : [ { text : 'another example' } ] },
                ];

                await textmodels.trainClassifierForProject(project, trainingWithIntents(intents));
                await textmodels.waitForTrainings();

                assert(trainStub.calledOnce);
                assert.deepStrictEqual(trainStub.firstCall.args[0].intents, [ intents[0], intents[2] ]);
            });
        });


        describe('accepting a new text service model', () => {

            it('should answer before the text service has trained the model', async () => {
                const training = deferredTraining();
                const project = keylessProject('keylessproject');

                const classifier = await textmodels.trainClassifier(project);

                assert.strictEqual(classifier.status, 'Training');
                assert.strictEqual(classifier.workspace_id, classifier.id);

                training.resolve();
                await textmodels.waitForTrainings();
            });

            it('should send the training data to the text service', async () => {
                const project = keylessLocalProject('keylesslocal');

                await textmodels.trainClassifierForProject(project, TRAINING);
                await textmodels.waitForTrainings();

                assert(trainStub.calledOnceWithExactly(TRAINING));
            });

            it('should point the Scratch key at the placeholder', async () => {
                const project = keylessProject('keylessproject');

                const classifier = await textmodels.trainClassifier(project);

                assert(storeScratchKeyStub.calledOnceWith(project, TXT_KEY_CREDENTIALS, classifier.id, classifier.created));
                assert(storeStoreStub.notCalled);

                await textmodels.waitForTrainings();
            });

            it('should report a model that is training, then available', async () => {
                const training = deferredTraining();
                const project = keylessProject('keylessproject');

                const classifier = await textmodels.trainClassifier(project);

                const training1 = await getStoredModel(project.id);
                assert.strictEqual(training1.status, 'Training');
                assert.strictEqual(training1.workspace_id, classifier.id);
                assert.deepStrictEqual(training1.updated, classifier.created);

                training.resolve();
                await textmodels.waitForTrainings();

                const available = await getStoredModel(project.id);
                assert.strictEqual(available.status, 'Available');
                assert.strictEqual(available.workspace_id, MODELID);
                assert(available.updated && available.updated.getTime() >= classifier.created.getTime());
                assert.deepStrictEqual(available.expiry, new Date((available.updated as Date).getTime() + TWO_HOURS));

                assert(replacePlaceholderStub.calledOnceWith(project.id, classifier.id, MODELID, available.updated));
            });

            it('should give a duplicate request the training that is in progress', async () => {
                const training = deferredTraining();
                const project = keylessProject('keylessproject');

                const first = await textmodels.trainClassifier(project);
                const second = await textmodels.trainClassifier(project);

                assert.strictEqual(second.id, first.id);
                assert.strictEqual(second.workspace_id, first.id);
                assert.strictEqual(second.status, 'Training');
                assert.deepStrictEqual(second.updated, first.created);

                training.resolve();
                await textmodels.waitForTrainings();
                assert(trainStub.calledOnce);
            });

            it('should make one model from concurrent requests', async () => {
                const training = deferredTraining();
                const project = keylessProject('keylessproject');

                const [ first, second ] = await Promise.all([
                    textmodels.trainClassifier(project),
                    textmodels.trainClassifier(project),
                ]);

                // both requests tried to create the model
                assert(createTrainingStub.calledTwice);
                assert.strictEqual(fakeModels.size, 1);
                assert.strictEqual(second.id, first.id);
                assert.strictEqual(first.status, 'Training');
                assert.strictEqual(second.status, 'Training');

                training.resolve();
                await textmodels.waitForTrainings();
                assert(trainStub.calledOnce);
            });

            it('should record a failed training if the Scratch key cannot be stored', async () => {
                const project = keylessProject('keylessproject');
                storeScratchKeyStub.rejects(new Error('Failed to store Scratch key'));
                const notifyStub = sinon.stub(notifications, 'notify');

                try {
                    await assert.rejects(
                        () => textmodels.trainClassifier(project),
                        { message : 'Failed to store Scratch key' });

                    assert(trainStub.notCalled);
                    assert.strictEqual((await getStoredModel(project.id)).status, 'Failed');

                    assert(notifyStub.calledOnce);
                    assert(notifyStub.firstCall.args[0].includes('Failed to store Scratch key'));
                    assert(!notifyStub.firstCall.args[0].includes(project.id));
                    assert.strictEqual(notifyStub.firstCall.args[1], notifications.SLACK_CHANNELS.TEXT_SERVICE);
                }
                finally {
                    notifyStub.restore();
                }
            });

            it('should report failures to store a new model', async () => {
                const project = keylessProject('keylessproject');
                createTrainingStub.rejects(new Error('Failed to store text model'));
                const notifyStub = sinon.stub(notifications, 'notify');

                try {
                    await assert.rejects(
                        () => textmodels.trainClassifier(project),
                        { message : 'Failed to store text model' });

                    assert(trainStub.notCalled);
                    assert(storeScratchKeyStub.notCalled);
                    assert(notifyStub.calledOnce);
                    assert(!notifyStub.firstCall.args[0].includes(project.id));
                    assert.strictEqual(notifyStub.firstCall.args[1], notifications.SLACK_CHANNELS.TEXT_SERVICE);
                }
                finally {
                    notifyStub.restore();
                }
            });
        });


        describe('training text service models in the background', () => {

            it('should retry after the time the service asks for when it is busy', async () => {
                await withFakeTimers(async (clock) => {
                    trainStub.onFirstCall().rejects(busy(30000));
                    const project = keylessProject('keylessproject');

                    await textmodels.trainClassifier(project);
                    await clock.tickAsync(29999);
                    assert(trainStub.calledOnce);
                    await clock.tickAsync(1);
                    assert(trainStub.calledTwice);

                    await runTrainings(clock);
                    assert.strictEqual((await getStoredModel(project.id)).status, 'Available');
                });
            });

            it('should retry after a backoff when the connection is dropped', async () => {
                await withFakeTimers(async (clock) => {
                    trainStub.onFirstCall().rejects(droppedConnection());
                    const project = keylessProject('keylessproject');

                    await textmodels.trainClassifier(project);
                    await clock.tickAsync(4999);
                    assert(trainStub.calledOnce);
                    await clock.tickAsync(1);
                    assert(trainStub.calledTwice);

                    await runTrainings(clock);
                    assert.strictEqual((await getStoredModel(project.id)).status, 'Available');
                });
            });

            it('should back off for longer after each failure', async () => {
                await withFakeTimers(async (clock) => {
                    const calls: number[] = [];
                    trainStub.callsFake(() => {
                        calls.push(Date.now());
                        return Promise.reject(calls.length < 7 ? busy() : droppedConnection());
                    });
                    const project = keylessProject('keylessproject');

                    await textmodels.trainClassifier(project);
                    await runTrainings(clock);

                    const waits = calls.slice(1).map((time, idx) => (time - calls[idx]) / 1000);
                    assert.deepStrictEqual(waits.slice(0, 7), [ 5, 10, 20, 40, 60, 60, 60 ]);
                });
            });

            it('should fail at once with an error that cannot be retried', async () => {
                await withFakeTimers(async (clock) => {
                    trainStub.rejects(invalidTraining());
                    const project = keylessProject('keylessproject');

                    await textmodels.trainClassifier(project);
                    await runTrainings(clock);

                    assert(trainStub.calledOnce);
                    assert.strictEqual(Date.now(), new Date('2026-11-02T10:00:00Z').getTime());
                    assert.strictEqual((await getStoredModel(project.id)).status, 'Failed');
                    assert(replacePlaceholderStub.notCalled);
                });
            });

            it('should fail if the service is still failing after six minutes', async () => {
                await withFakeTimers(async (clock) => {
                    trainStub.rejects(droppedConnection());
                    const project = keylessProject('keylessproject');

                    await textmodels.trainClassifier(project);
                    await runTrainings(clock);

                    // retries after 5, 15, 35, 75, 135, 195, 255, 315 seconds
                    assert.strictEqual(trainStub.callCount, 9);
                    assert(Date.now() <= new Date('2026-11-02T10:06:00Z').getTime());

                    const failed = await getStoredModel(project.id);
                    assert.strictEqual(failed.status, 'Failed');
                    assert.strictEqual(failed.workspace_id, failed.id);
                });
            });

            it('should only start a retry that can finish before the training is abandoned', async () => {
                await withFakeTimers(async (clock) => {
                    // each attempt runs for as long as the text service
                    //  training timeout allows
                    const TRAINING_TIMEOUT_MS = 180 * 1000;
                    const attempts: { start: number, end: number }[] = [];
                    trainStub.callsFake(() => {
                        const start = Date.now();
                        return new Promise((resolve, reject) => {
                            setTimeout(() => {
                                attempts.push({ start, end : Date.now() });
                                reject(busy(30000));
                            }, TRAINING_TIMEOUT_MS);
                        });
                    });
                    const project = keylessProject('keylessproject');

                    await textmodels.trainClassifier(project);
                    await runTrainings(clock);

                    const accepted = new Date('2026-11-02T10:00:00Z').getTime();
                    assert(attempts.length > 1);
                    for (const attempt of attempts) {
                        assert(attempt.end - accepted < textmodels.ABANDON_TRAINING_AFTER_MS);
                    }
                    assert.strictEqual((await getStoredModel(project.id)).status, 'Failed');
                });
            });

            it('should throw away the result of a training for a deleted model', async () => {
                const training = deferredTraining();
                const project = keylessProject('keylessproject');

                const classifier = await textmodels.trainClassifier(project);
                await textmodels.deleteClassifier(KEYLESS, classifier);

                training.resolve();
                await textmodels.waitForTrainings();

                assert(finishStub.calledOnce);
                assert.strictEqual(fakeModels.size, 0);
                assert(replacePlaceholderStub.notCalled);
            });

            it('should stop retrying if the model is deleted', async () => {
                await withFakeTimers(async (clock) => {
                    trainStub.rejects(busy());
                    const project = keylessProject('keylessproject');

                    const classifier = await textmodels.trainClassifier(project);
                    await clock.tickAsync(0);
                    assert(trainStub.calledOnce);

                    await textmodels.deleteClassifier(KEYLESS, classifier);
                    await runTrainings(clock);

                    assert(trainStub.calledOnce);
                    assert(failStub.notCalled);
                });
            });

            it('should keep a trained model if the Scratch key cannot be updated', async () => {
                const project = keylessProject('keylessproject');
                replacePlaceholderStub.rejects(new Error('Failed to update Scratch key'));
                const notifyStub = sinon.stub(notifications, 'notify');

                try {
                    await textmodels.trainClassifier(project);
                    await textmodels.waitForTrainings();

                    assert.strictEqual((await getStoredModel(project.id)).status, 'Available');
                    assert(failStub.notCalled);
                    assert(notifyStub.calledOnce);
                    assert(notifyStub.firstCall.args[0].includes('Failed to update Scratch key'));
                    assert(!notifyStub.firstCall.args[0].includes(project.id));
                    assert.strictEqual(notifyStub.firstCall.args[1], notifications.SLACK_CHANNELS.TEXT_SERVICE);
                }
                finally {
                    notifyStub.restore();
                }
            });

            it('should report failures to store a trained model', async () => {
                const project = keylessProject('keylessproject');
                finishStub.rejects(new Error('Failed to store trained text model'));
                const notifyStub = sinon.stub(notifications, 'notify');

                try {
                    await textmodels.trainClassifier(project);
                    await textmodels.waitForTrainings();

                    assert(notifyStub.calledOnce);
                    assert(notifyStub.firstCall.args[0].includes('Failed to store trained text model'));
                    assert(!notifyStub.firstCall.args[0].includes(project.id));
                    assert.strictEqual(notifyStub.firstCall.args[1], notifications.SLACK_CHANNELS.TEXT_SERVICE);
                    assert.strictEqual((await getStoredModel(project.id)).status, 'Failed');
                }
                finally {
                    notifyStub.restore();
                }
            });
        });


        describe('shutting down while text service models are training', () => {

            let notifyStub: sinon.SinonStub<[string, string], void>;

            beforeEach(() => {
                notifyStub = sinon.stub(notifications, 'notify');
            });
            afterEach(() => {
                notifyStub.restore();
                textmodels.resumeTrainingsForTests();
            });

            function cutoffIn(ms: number): Date {
                return new Date(Date.now() + ms);
            }

            it('should wait for a training that finishes before the cut-off', async () => {
                await withFakeTimers(async (clock) => {
                    const training = deferredTraining();
                    const project = keylessProject('keylessproject');

                    await textmodels.trainClassifier(project);

                    let stopped = false;
                    const stopping = textmodels.stopTrainings(cutoffIn(240000))
                        .then(() => { stopped = true; });

                    await clock.tickAsync(60000);
                    assert.strictEqual(stopped, false);

                    training.resolve();
                    await clock.tickAsync(0);
                    await stopping;

                    assert.strictEqual(Date.now(), new Date('2026-11-02T10:01:00Z').getTime());
                    assert.strictEqual((await getStoredModel(project.id)).status, 'Available');
                    assert(failStub.notCalled);
                    assert(notifyStub.notCalled);
                });
            });

            it('should record trainings still running at the cut-off as failed', async () => {
                await withFakeTimers(async (clock) => {
                    deferredTraining();
                    const first = keylessProject('firstproject');
                    const second = keylessProject('secondproject');

                    await textmodels.trainClassifier(first);
                    await textmodels.trainClassifier(second);

                    const stopping = textmodels.stopTrainings(cutoffIn(240000));
                    await clock.tickAsync(240000);
                    await stopping;

                    assert.strictEqual(Date.now(), new Date('2026-11-02T10:04:00Z').getTime());
                    assert(failStub.calledTwice);
                    assert.strictEqual((await getStoredModel(first.id)).status, 'Failed');
                    assert.strictEqual((await getStoredModel(second.id)).status, 'Failed');

                    // one alert for all of them, without ids
                    assert(notifyStub.calledOnce);
                    assert(notifyStub.firstCall.args[0].includes('before 2 text model'));
                    assert(!notifyStub.firstCall.args[0].includes(first.id));
                    assert.strictEqual(notifyStub.firstCall.args[1], notifications.SLACK_CHANNELS.TEXT_SERVICE);

                    // results that arrive after the cut-off are thrown away
                    for (const finish of unfinishedTrainings.splice(0)) {
                        finish();
                    }
                    await runTrainings(clock);
                    assert.strictEqual((await getStoredModel(first.id)).status, 'Failed');
                    assert.strictEqual((await getStoredModel(second.id)).status, 'Failed');
                    assert(replacePlaceholderStub.notCalled);
                });
            });

            it('should not start a new retry after shutdown begins', async () => {
                await withFakeTimers(async (clock) => {
                    trainStub.onFirstCall().rejects(busy(30000));
                    const project = keylessProject('keylessproject');

                    await textmodels.trainClassifier(project);
                    await clock.tickAsync(0);
                    assert(trainStub.calledOnce);

                    const stopping = textmodels.stopTrainings(cutoffIn(240000));
                    await clock.tickAsync(30000);
                    await stopping;

                    // ended when the wait before the retry ended, not at the cut-off
                    assert.strictEqual(Date.now(), new Date('2026-11-02T10:00:30Z').getTime());
                    assert(trainStub.calledOnce);
                    assert(failStub.calledOnce);
                    assert.strictEqual((await getStoredModel(project.id)).status, 'Failed');

                    assert(notifyStub.calledOnce);
                    assert(notifyStub.firstCall.args[0].includes('before 1 text model'));
                    assert.strictEqual(notifyStub.firstCall.args[1], notifications.SLACK_CHANNELS.TEXT_SERVICE);
                });
            });

            it('should not start a new retry once shutdown has started, before trainings are stopped', async () => {
                await withFakeTimers(async (clock) => {
                    trainStub.onFirstCall().rejects(busy(30000));
                    const project = keylessProject('keylessproject');

                    await textmodels.trainClassifier(project);
                    await clock.tickAsync(0);
                    assert(trainStub.calledOnce);

                    // the shutdown signal, while the HTTP server is still closing
                    textmodels.startShutdown();
                    await clock.tickAsync(30000);

                    assert(trainStub.calledOnce);
                    assert(failStub.calledOnce);
                    assert.strictEqual((await getStoredModel(project.id)).status, 'Failed');

                    // the server has closed - the training that wasn't
                    //  retried is still included in the alert
                    await textmodels.stopTrainings(cutoffIn(240000));
                    assert.strictEqual(Date.now(), new Date('2026-11-02T10:00:30Z').getTime());
                    assert(notifyStub.calledOnce);
                    assert(notifyStub.firstCall.args[0].includes('before 1 text model'));
                });
            });
        });


        describe('routing by training size', () => {

            const THRESHOLD = 100000;

            /**
             * training with these examples, that Watson Assistant can create a model for
             *
             * The first example is split between two labels, as the text service
             *  needs at least two, without changing the size of the training.
             */
            function trainingWithExamples(texts: string[], language: DbTypes.TextProjectLanguage = 'en'): TrainingTypes.ConversationTrainingData {
                const first = Array.from(texts[0]);
                const half = Math.ceil(first.length / 2);
                return {
                    ...TRAINING,
                    name : 'Bob\'s text project',
                    language,
                    intents : [
                        { intent : 'label', examples : [ { text : first.slice(0, half).join('') } ] },
                        { intent : 'other', examples : [ first.slice(half).join(''), ...texts.slice(1) ].map((text) => ({ text })) },
                    ],
                };
            }

            it('should use the text service for a training below the threshold', async () => {
                const project = keylessLocalProject('sizeproject');

                const classifier = await textmodels.trainClassifierForProject(project,
                    trainingWithExamples([ 'a'.repeat(THRESHOLD - 1) ]));

                assert.strictEqual(classifier.servicetype, 'txt');
                assert(poolStub.notCalled);
            });

            it('should use the large Watson Assistant pool for a training at the threshold', async () => {
                const project = keylessLocalProject('sizeproject');

                const classifier = await textmodels.trainClassifierForProject(project,
                    trainingWithExamples([ 'a'.repeat(THRESHOLD - 10), 'b'.repeat(10) ]));

                assert.strictEqual(classifier.servicetype, 'conv');
                assert(poolStub.calledOnceWith('large-pool', 'conv'));
                assert(trainStub.notCalled);
                assert(createTrainingStub.notCalled);
            });

            const WEIGHTED_EDGES: { language: DbTypes.TextProjectLanguage, below: number, atOrAbove: number }[] = [
                // 33333 x 3 = 99999, 33334 x 3 = 100002
                { language : 'ko', below : 33333, atOrAbove : 33334 },
                { language : 'ja', below : 33333, atOrAbove : 33334 },
                { language : 'zh-cn', below : 33333, atOrAbove : 33334 },
                { language : 'zh-tw', below : 33333, atOrAbove : 33334 },
                // 66666 x 1.5 = 99999, 66667 x 1.5 = 100000.5
                { language : 'ar', below : 66666, atOrAbove : 66667 },
                { language : 'xx', below : 99999, atOrAbove : 100000 },
                { language : 'fr', below : 99999, atOrAbove : 100000 },
            ];
            for (const edge of WEIGHTED_EDGES) {
                it('should weight ' + edge.language + ' training at the edge of the threshold', async () => {
                    const below = await textmodels.trainClassifierForProject(keylessLocalProject('below' + edge.language),
                        trainingWithExamples([ 'a'.repeat(edge.below) ], edge.language));
                    const atOrAbove = await textmodels.trainClassifierForProject(keylessLocalProject('above' + edge.language),
                        trainingWithExamples([ 'a'.repeat(edge.atOrAbove) ], edge.language));

                    assert.strictEqual(below.servicetype, 'txt');
                    assert.strictEqual(atOrAbove.servicetype, 'conv');
                });
            }

            it('should count characters as code points, not UTF-16 units', async () => {
                // each emoji is two UTF-16 units, so the text has a
                //  length of almost twice the threshold
                const emoji = '\u{1F600}';
                const classifier = await textmodels.trainClassifierForProject(keylessLocalProject('emojiproject'),
                    trainingWithExamples([ emoji.repeat(THRESHOLD - 1) ]));

                assert.strictEqual(classifier.servicetype, 'txt');
            });

            it('should not count label names', async () => {
                const training = trainingWithExamples([ 'a'.repeat(THRESHOLD - 1) ]);
                const classifier = await textmodels.trainClassifierForProject(keylessLocalProject('labelsproject'), {
                    ...training,
                    intents : [ ...training.intents, { intent : 'l'.repeat(1000), examples : [] } ],
                });

                assert.strictEqual(classifier.servicetype, 'txt');
            });

            for (const tenant of [ POOL, MANAGED ]) {
                it('should not change where large training goes for a ' + DbTypes.ClassTenantType[tenant.tenantType] + ' class', async () => {
                    const project = { ...keylessLocalProject('large' + tenant.id), classid : tenant.id };

                    const classifier = await textmodels.trainClassifierForProject(project,
                        trainingWithExamples([ 'a'.repeat(THRESHOLD) ]));

                    assert.strictEqual(classifier.servicetype, 'conv');
                    if (tenant === POOL) {
                        assert(poolStub.calledOnceWith('managed-pool', 'conv'));
                    }
                    else {
                        assert(poolStub.notCalled);
                    }
                });
            }

            describe('threshold from the environment', () => {

                afterEach(() => {
                    delete process.env.TEXT_SERVICE_LARGE_THRESHOLD;
                });

                it('should use a lower threshold from the environment', async () => {
                    process.env.TEXT_SERVICE_LARGE_THRESHOLD = '1000';

                    const below = await textmodels.trainClassifierForProject(keylessLocalProject('envbelow'),
                        trainingWithExamples([ 'a'.repeat(999) ]));
                    const atOrAbove = await textmodels.trainClassifierForProject(keylessLocalProject('envabove'),
                        trainingWithExamples([ 'a'.repeat(1000) ]));

                    assert.strictEqual(below.servicetype, 'txt');
                    assert.strictEqual(atOrAbove.servicetype, 'conv');
                });

                it('should send every new model to Watson Assistant with a threshold of 0', async () => {
                    process.env.TEXT_SERVICE_LARGE_THRESHOLD = '0';

                    const classifier = await textmodels.trainClassifierForProject(keylessLocalProject('envzero'),
                        trainingWithExamples([ 'a' ]));

                    assert.strictEqual(classifier.servicetype, 'conv');
                });

                it('should use a higher threshold from the environment', async () => {
                    process.env.TEXT_SERVICE_LARGE_THRESHOLD = '200000';

                    const classifier = await textmodels.trainClassifierForProject(keylessLocalProject('envhigher'),
                        trainingWithExamples([ 'a'.repeat(THRESHOLD) ]));

                    assert.strictEqual(classifier.servicetype, 'txt');
                });

                for (const invalid of [ 'lots', '-1', '1.5', '' ]) {
                    it('should use the default threshold if the environment has "' + invalid + '"', async () => {
                        process.env.TEXT_SERVICE_LARGE_THRESHOLD = invalid;

                        const below = await textmodels.trainClassifierForProject(keylessLocalProject('invalidbelow'),
                            trainingWithExamples([ 'a'.repeat(THRESHOLD - 1) ]));
                        const atOrAbove = await textmodels.trainClassifierForProject(keylessLocalProject('invalidabove'),
                            trainingWithExamples([ 'a'.repeat(THRESHOLD) ]));

                        assert.strictEqual(below.servicetype, 'txt');
                        assert.strictEqual(atOrAbove.servicetype, 'conv');
                    });
                }
            });

            it('should use the class\'s own keys for large training', async () => {
                const project = { ...keylessLocalProject('largekeyed'), classid : TESTTENANT.id };

                const classifier = await textmodels.trainClassifierForProject(project,
                    trainingWithExamples([ 'a'.repeat(THRESHOLD) ]));

                assert.strictEqual(classifier.servicetype, 'conv');
                assert.strictEqual(classifier.credentialsid, mockstore.creds.id);
                assert(poolStub.notCalled);
            });
        });


        describe('moving large retraining to Watson Assistant', () => {

            /** training that is above the threshold, that Watson Assistant can create a model for */
            function largeTraining(name = 'Bob\'s text project'): TrainingTypes.ConversationTrainingData {
                return {
                    ...TRAINING,
                    name,
                    intents : [ { intent : 'label', examples : [ { text : 'a'.repeat(100000) } ] } ],
                };
            }

            it('should move a text service model to Watson Assistant, deleting the text service model', async () => {
                const project = keylessLocalProject('moveproject');
                const existing = storeTrainedModel(project.id);

                const classifier = await textmodels.trainClassifierForProject(project, largeTraining());

                assert.strictEqual(classifier.servicetype, 'conv');
                assert.notStrictEqual(classifier.id, existing.id);
                assert(poolStub.calledOnceWith('large-pool', 'conv'));
                assert(trainStub.notCalled);

                assert(deleteStoreStub.calledOnceWith(existing.id));
                // the Scratch key points at the placeholder while the model moves
                assert(storeScratchKeyStub.firstCall.calledWith(project, TXT_KEY_CREDENTIALS, existing.id));
                assert(resetExpiredScratchKeyStub.calledOnceWith(existing.id, 'text'));
                assert.strictEqual(await store.getTextServiceTrainingState(existing.id), undefined);
                assert.strictEqual(await store.getTextClassifierHead(existing.id), undefined);

                assert(storeStoreStub.calledOnceWith(project, classifier));
                assert(storeScratchKeyStub.lastCall.calledWith(project, sinon.match({ servicetype : 'conv' }), classifier.workspace_id));
            });

            it('should move using the class\'s own keys if it has some', async () => {
                const project = { ...keylessLocalProject('movekeyed'), classid : TESTTENANT.id };
                storeTrainedModel(project.id);

                const classifier = await textmodels.trainClassifierForProject(project, largeTraining());

                assert.strictEqual(classifier.servicetype, 'conv');
                assert.strictEqual(classifier.credentialsid, mockstore.creds.id);
                assert(poolStub.notCalled);
            });

            it('should not apply the model limit to a move', async () => {
                const project = keylessLocalProject('movelimit');
                storeTrainedModel(project.id);
                countTxtStub.resolves(3);

                const classifier = await textmodels.trainClassifierForProject(project, largeTraining());

                assert.strictEqual(classifier.servicetype, 'conv');
            });

            it('should leave no model if the move fails', async () => {
                const project = keylessLocalProject('movefails');
                const existing = storeTrainedModel(project.id);
                const notifyStub = sinon.stub(notifications, 'notify');
                const recordFailureStub = sinon.stub(store, 'recordBluemixCredentialsPoolFailure');

                try {
                    await assert.rejects(
                        () => textmodels.trainClassifierForProject(project, largeTraining('Too Many Models')),
                        { message : conversation.ERROR_MESSAGES.POOL_EXHAUSTED });

                    // the failure is recorded against the large pool credentials
                    assert(recordFailureStub.calledOnceWith(sinon.match({ id : mockstore.poolCreds.id, source : 'large-pool' })));

                    assert.strictEqual(await store.getTextServiceTrainingState(existing.id), undefined);
                    assert(resetExpiredScratchKeyStub.calledOnceWith(existing.id, 'text'));
                    assert(storeStoreStub.notCalled);

                    assert(notifyStub.calledOnce);
                    assert.strictEqual(notifyStub.firstCall.args[1], notifications.SLACK_CHANNELS.TEXT_SERVICE);
                    assert(!notifyStub.firstCall.args[0].includes(project.id));
                }
                finally {
                    notifyStub.restore();
                    recordFailureStub.restore();
                }
            });

            it('should not move while a text service training is in progress', async () => {
                const training = deferredTraining();
                const project = keylessLocalProject('movetraining');
                const existing = storeTrainedModel(project.id);

                const first = await textmodels.trainClassifierForProject(project, TRAINING);
                const second = await textmodels.trainClassifierForProject(project, largeTraining());

                assert.strictEqual(second.servicetype, 'txt');
                assert.strictEqual(second.id, existing.id);
                assert.strictEqual(second.status, 'Training');
                assert.deepStrictEqual(second.updated, first.updated);
                assert(poolStub.notCalled);
                assert(deleteStoreStub.notCalled);

                training.resolve();
                await textmodels.waitForTrainings();
            });

            it('should give a duplicate request during a move the move in progress', async () => {
                const project = keylessLocalProject('moveduplicate');
                const existing = storeTrainedModel(project.id);

                // the Watson Assistant create waits until the duplicate has been answered
                let finishCreate: () => void = () => { /* replaced below */ };
                const createCalled = new Promise<void>((calledResolve) => {
                    poolStub.callsFake(() => {
                        calledResolve();
                        return new Promise((poolResolve) => {
                            finishCreate = () => poolResolve([ { ...mockstore.poolCreds, source : 'large-pool' } ]);
                        });
                    });
                });

                const moving = textmodels.trainClassifierForProject(project, largeTraining());
                await createCalled;

                const duplicate = await textmodels.trainClassifierForProject(project, largeTraining());
                assert.strictEqual(duplicate.id, existing.id);
                assert.strictEqual(duplicate.status, 'Training');

                finishCreate();
                const moved = await moving;
                assert.strictEqual(moved.servicetype, 'conv');
                assert(poolStub.calledOnce);
                assert(storeStoreStub.calledOnce);
            });

            it('should keep a Watson Assistant model on Watson Assistant when its training shrinks', async () => {
                const project = { ...keylessLocalProject('existingprojectid'), classid : KEYLESS.id };

                const classifier = await textmodels.trainClassifierForProject(project, {
                    ...TRAINING,
                    name : 'Bob\'s text project',
                });

                assert.strictEqual(classifier.servicetype, 'conv');
                assert(trainStub.notCalled);
                assert(createTrainingStub.notCalled);
                assert(deleteStoreStub.notCalled);
            });
        });


        describe('model limit', () => {

            it('should not train a new model for a student at the limit', async () => {
                const project = keylessProject('keylessproject');
                countTxtStub.withArgs('bob').resolves(3);

                await assert.rejects(
                    () => textmodels.trainClassifier(project),
                    { message : textmodels.ERROR_MESSAGES.TOO_MANY_MODELS });

                assert(trainStub.notCalled);
                assert(createTrainingStub.notCalled);
            });

            it('should train a new model for a student below the limit', async () => {
                const project = keylessProject('keylessproject');
                countTxtStub.withArgs('bob').resolves(2);

                await textmodels.trainClassifier(project);
                await textmodels.waitForTrainings();

                assert(trainStub.calledOnce);
            });

            it('should apply the limit to local projects', async () => {
                const project = keylessLocalProject('keylesslocal');
                countTxtStub.withArgs('bob').resolves(3);

                await assert.rejects(
                    () => textmodels.trainClassifierForProject(project, TRAINING),
                    { message : textmodels.ERROR_MESSAGES.TOO_MANY_MODELS });

                assert(trainStub.notCalled);
            });

            it('should not limit Watson Assistant models for a class with its own keys', async () => {
                const project = createProject('projectbob', 'Bob\'s text project', 'fr', [ 'temperature', 'conditions' ]);
                countTxtStub.resolves(100);

                const classifier = await textmodels.trainClassifier(project);

                assert.strictEqual(classifier.servicetype, 'conv');
                assert(countTxtStub.notCalled);
            });

            it('should apply the limit to large training for a class without keys', async () => {
                const project = keylessLocalProject('keylesslarge');
                countTxtStub.withArgs('bob').resolves(3);

                await assert.rejects(
                    () => textmodels.trainClassifierForProject(project, {
                        ...TRAINING,
                        name : 'Bob\'s text project',
                        intents : [ { intent : 'label', examples : [ { text : 'a'.repeat(100000) } ] } ],
                    }),
                    { message : textmodels.ERROR_MESSAGES.TOO_MANY_MODELS });

                assert(poolStub.notCalled);
                assert(createStub.notCalled);
            });
        });


        describe('retraining text service models', () => {

            for (const tenant of [ KEYLESS, POOL, MANAGED ]) {
                it('should retrain using the text service for a ' + DbTypes.ClassTenantType[tenant.tenantType] + ' class', async () => {
                    const project = { ...keylessProject('retrainproject'), classid : tenant.id };
                    const existing = storeTrainedModel(project.id);
                    const recordFailureStub = sinon.stub(store, 'recordBluemixCredentialsPoolFailure');

                    try {
                        const classifier = await textmodels.trainClassifier(project);

                        assert.strictEqual(classifier.id, existing.id);
                        assert.strictEqual(classifier.workspace_id, existing.id);
                        assert.strictEqual(classifier.status, 'Training');
                        assert(storeScratchKeyStub.calledOnceWith(project, TXT_KEY_CREDENTIALS, existing.id, classifier.updated));

                        await textmodels.waitForTrainings();

                        assert(trainStub.calledOnce);
                        assert.strictEqual(createStub.called, false);
                        assert(poolStub.notCalled);
                        assert(recordFailureStub.notCalled);
                        assert(updateConversationStub.notCalled);

                        const retrained = await getStoredModel(project.id);
                        assert.strictEqual(retrained.status, 'Available');
                        assert.strictEqual(retrained.workspace_id, MODELID);
                        assert.deepStrictEqual(retrained.expiry, new Date((retrained.updated as Date).getTime() + TWO_HOURS));
                    }
                    finally {
                        recordFailureStub.restore();
                    }
                });
            }

            it('should retrain a student\'s model when they are at the limit', async () => {
                const project = keylessProject('retrainproject');
                storeTrainedModel(project.id);
                countTxtStub.resolves(3);

                const classifier = await textmodels.trainClassifier(project);
                assert.strictEqual(classifier.status, 'Training');
                await textmodels.waitForTrainings();
                assert(trainStub.calledOnce);
            });

            it('should retrain using the text service even if it is no longer configured', async () => {
                isConfiguredStub.returns(false);
                const project = keylessProject('retrainproject');
                storeTrainedModel(project.id);

                await textmodels.trainClassifier(project);
                await textmodels.waitForTrainings();
                assert(trainStub.calledOnce);
            });

            it('should give a duplicate retrain the training that is in progress', async () => {
                const training = deferredTraining();
                const project = keylessProject('retrainproject');
                const existing = storeTrainedModel(project.id);

                const first = await textmodels.trainClassifier(project);
                const second = await textmodels.trainClassifier(project);

                assert.strictEqual(second.id, existing.id);
                assert.strictEqual(second.workspace_id, existing.id);
                assert.strictEqual(second.status, 'Training');
                assert.deepStrictEqual(second.updated, first.updated);

                training.resolve();
                await textmodels.waitForTrainings();
                assert(trainStub.calledOnce);
            });

            it('should remove the old model, giving random answers until the new one is trained', async () => {
                const training = deferredTraining();
                const project = keylessProject('retrainproject');
                const existing = storeTrainedModel(project.id);
                getProjectStub.withArgs(project.id).resolves(project);

                try {
                    await textmodels.trainClassifier(project);

                    assert.strictEqual(await store.getTextClassifierHead(existing.id), undefined);
                    await assert.rejects(
                        () => textmodels.classifyModel(KEYLESS, project.id, existing.workspace_id, new Date(), 'Hello'),
                        { message : textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND });

                    const classes = await textmodels.classifyModel(KEYLESS, project.id, existing.id, new Date(), 'Hello');
                    assert.strictEqual(classes.length, 1);
                    assert.strictEqual(classes[0].random, true);
                    assert(project.labels.includes(classes[0].class_name));

                    const scratchClasses = await textmodels.classifyWithScratchKey(txtScratchKey(project.id, existing.id), 'Hello');
                    assert.strictEqual(scratchClasses[0].random, true);

                    assert(classifyStub.notCalled);

                    training.resolve();
                    await textmodels.waitForTrainings();

                    classifyStub.resolves({ classes : [ { class_name : 'temperature', confidence : 90, classifierTimestamp : new Date() } ], outcome : 'ok' });
                    await textmodels.classifyModel(KEYLESS, project.id, MODELID, new Date(), 'Hello');
                    assert(classifyStub.calledOnceWith(MODELID));
                }
                finally {
                    getProjectStub.withArgs(project.id).callsFake(mockstore.getProject);
                }
            });

            it('should leave no usable model if retraining fails', async () => {
                trainStub.rejects(invalidTraining());
                const project = keylessProject('retrainproject');
                const existing = storeTrainedModel(project.id);
                getProjectStub.withArgs(project.id).resolves(project);

                try {
                    await textmodels.trainClassifier(project);
                    await textmodels.waitForTrainings();

                    assert.strictEqual((await getStoredModel(project.id)).status, 'Failed');
                    await assert.rejects(
                        () => textmodels.classifyModel(KEYLESS, project.id, existing.workspace_id, new Date(), 'Hello'),
                        { message : textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND });

                    const classes = await textmodels.classifyModel(KEYLESS, project.id, existing.id, new Date(), 'Hello');
                    assert.strictEqual(classes[0].random, true);
                    assert(classifyStub.notCalled);
                }
                finally {
                    getProjectStub.withArgs(project.id).callsFake(mockstore.getProject);
                }
            });

            it('should retrain a model whose training failed', async () => {
                trainStub.onFirstCall().rejects(invalidTraining());
                const project = keylessProject('retrainproject');
                storeTrainedModel(project.id);

                await textmodels.trainClassifier(project);
                await textmodels.waitForTrainings();
                assert.strictEqual((await getStoredModel(project.id)).status, 'Failed');

                const classifier = await textmodels.trainClassifier(project);
                assert.strictEqual(classifier.status, 'Training');
                await textmodels.waitForTrainings();
                assert.strictEqual((await getStoredModel(project.id)).status, 'Available');
            });

            it('should retrain a model whose training was abandoned, and report it', async () => {
                const project = keylessProject('retrainproject');
                const existing = storeTrainedModel(project.id);
                const stored = fakeModels.get(existing.id) as FakeTextServiceModel;
                delete stored.head;
                stored.trainingstarted = new Date(Date.now() - textmodels.ABANDON_TRAINING_AFTER_MS - 1000);
                const notifyStub = sinon.stub(notifications, 'notify');

                try {
                    const classifier = await textmodels.trainClassifier(project);
                    assert.strictEqual(classifier.status, 'Training');
                    await textmodels.waitForTrainings();
                    assert(trainStub.calledOnce);

                    assert(notifyStub.calledOnce);
                    assert(notifyStub.firstCall.args[0].includes('abandoned'));
                    assert(!notifyStub.firstCall.args[0].includes(project.id));
                    assert(!notifyStub.firstCall.args[0].includes(existing.id));
                    assert.strictEqual(notifyStub.firstCall.args[1], notifications.SLACK_CHANNELS.TEXT_SERVICE);
                }
                finally {
                    notifyStub.restore();
                }
            });

            it('should report a model that was deleted while it was being retrained as not found', async () => {
                const project = keylessProject('retrainproject');
                const existing = storeTrainedModel(project.id);
                // the model is deleted after the request found it
                claimStub.callsFake(async (id: string, now: Date, abandonIfStartedBefore: Date) => {
                    fakeModels.delete(id);
                    return fakeStore.claimTextServiceTraining(id, now, abandonIfStartedBefore);
                });

                await assert.rejects(
                    () => textmodels.trainClassifier(project),
                    { message : textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND });
                assert(trainStub.notCalled);
                assert(claimStub.calledOnceWith(existing.id));
            });
        });


        describe('text service model statuses', () => {

            for (const tenant of [ KEYLESS, POOL, MANAGED ]) {
                it('should report a trained model as available for a ' + DbTypes.ClassTenantType[tenant.tenantType] + ' class', async () => {
                    const model = storeTrainedModel('statusproject');
                    authByIdStoreStub.resetHistory();
                    getStub.resetHistory();

                    const statuses = await textmodels.getModelStatuses(tenant, [ { ...model } ]);

                    assert.deepStrictEqual(statuses, [ { ...model, status : 'Available', updated : TRAINED } ]);
                    assert(authByIdStoreStub.notCalled);
                    assert(getStub.neverCalledWith(sinon.match(/workspaces/)));
                });
            }

            it('should report a model with no record as non existent', async () => {
                const model = existingTxtModel('statusproject');

                const statuses = await textmodels.getModelStatuses(KEYLESS, [ model ]);

                assert.strictEqual(statuses[0].status, 'Non Existent');
            });

            it('should report a training older than the limit as failed, and report it', async () => {
                const model = storeTrainedModel('statusproject');
                const stored = fakeModels.get(model.id) as FakeTextServiceModel;
                delete stored.head;
                stored.trainingstarted = new Date(Date.now() - textmodels.ABANDON_TRAINING_AFTER_MS - 1000);
                const notifyStub = sinon.stub(notifications, 'notify');

                try {
                    const statuses = await textmodels.getModelStatuses(KEYLESS, [ { ...model } ]);

                    assert.strictEqual(statuses[0].status, 'Failed');
                    assert(notifyStub.calledOnce);
                    assert(notifyStub.firstCall.args[0].includes('abandoned'));
                    assert(!notifyStub.firstCall.args[0].includes(model.id));
                    assert.strictEqual(notifyStub.firstCall.args[1], notifications.SLACK_CHANNELS.TEXT_SERVICE);
                }
                finally {
                    notifyStub.restore();
                }
            });

            it('should get statuses for a mix of models', async () => {
                const model = storeTrainedModel('statusproject');

                const statuses = await textmodels.getModelStatuses(CLASS, [ clone(goodClassifier), { ...model } ]);

                assert.deepStrictEqual(statuses[0], goodClassifierWithStatus);
                assert.strictEqual(statuses[1].status, 'Available');
            });
        });


        describe('classifying with text service models', () => {

            const CLASSES = [
                { class_name : 'temperature', confidence : 91, classifierTimestamp : new Date('2026-11-01T10:00:00Z') },
                { class_name : 'conditions', confidence : 9, classifierTimestamp : new Date('2026-11-01T10:00:00Z') },
            ];

            it('should classify using the stored record of the model', async () => {
                const model = storeTrainedModel('classifyproject');
                classifyStub.resolves({ classes : CLASSES, outcome : 'ok' });

                const timestamp = new Date('2026-11-01T10:00:00Z');
                const classes = await textmodels.classifyModel(POOL, 'classifyproject', model.workspace_id, timestamp, 'Hello');

                assert.deepStrictEqual(classes, CLASSES);
                assert(classifyStub.calledOnceWith(model.workspace_id, timestamp, 'Hello'));
                assert.strictEqual(createStub.called, false);
            });

            it('should only read the head if the service asks for it', async () => {
                const model = storeTrainedModel('classifyproject');
                classifyStub.resolves({ classes : CLASSES, outcome : 'ok' });

                await textmodels.classifyModel(KEYLESS, 'classifyproject', model.workspace_id, new Date(), 'Hello');
                assert(getHeadStub.notCalled);

                const getHead = classifyStub.firstCall.args[3];
                assert.strictEqual(await getHead(), HEAD);
                assert(getHeadStub.calledOnceWith(model.id));
            });

            it('should report a missing head as a missing model', async () => {
                const model = storeTrainedModel('classifyproject');
                delete (fakeModels.get(model.id) as FakeTextServiceModel).head;
                classifyStub.resolves({ classes : CLASSES, outcome : 'ok' });

                await textmodels.classifyModel(KEYLESS, 'classifyproject', model.workspace_id, new Date(), 'Hello');

                const getHead = classifyStub.firstCall.args[3];
                await assert.rejects(getHead, { message : textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND });
            });

            it('should check the text before calling the text service', async () => {
                const model = storeTrainedModel('classifyproject');

                await assert.rejects(
                    () => textmodels.classifyModel(KEYLESS, 'classifyproject', model.workspace_id, new Date(), 'x'.repeat(2049)),
                    { message : textmodels.ERROR_MESSAGES.TEXT_TOO_LONG });
                assert(classifyStub.notCalled);
            });

            it('should classify with a Scratch key', async () => {
                const model = storeTrainedModel('classifyproject');
                classifyStub.resolves({ classes : CLASSES, outcome : 'ok' });
                const key = txtScratchKey('classifyproject', model.workspace_id);

                const classes = await textmodels.classifyWithScratchKey(key, 'Hello');

                assert.deepStrictEqual(classes, CLASSES);
                assert(classifyStub.calledOnceWith(model.workspace_id, key.updated, 'Hello'));
                assert.strictEqual(createStub.called, false);
            });

            it('should report a Scratch key for a deleted model as not found', async () => {
                await assert.rejects(
                    () => textmodels.classifyWithScratchKey(txtScratchKey('classifyproject', 'deleted'), 'Hello'),
                    { message : textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND });
                assert(classifyStub.notCalled);
            });
        });


        describe('deleting text service models', () => {

            for (const tenant of [ KEYLESS, POOL, MANAGED ]) {
                it('should delete only from the DB for a ' + DbTypes.ClassTenantType[tenant.tenantType] + ' class', async () => {
                    const model = existingTxtModel('deleteproject');
                    const deletionStub = sinon.stub(store, 'recordBluemixCredentialsPoolModelDeletion');
                    authByIdStoreStub.resetHistory();

                    try {
                        await textmodels.deleteClassifier(tenant, model);

                        assert(deleteStoreStub.calledOnceWith(model.id));
                        assert(resetExpiredScratchKeyStub.calledOnceWith(model.workspace_id, 'text'));
                        assert(deleteStub.notCalled);
                        assert(authByIdStoreStub.notCalled);
                        assert(deletionStub.notCalled);
                    }
                    finally {
                        deletionStub.restore();
                    }
                });
            }
        });


        describe('cleaning up expired text service models', () => {

            let getExpiredStub: sinon.SinonStub<[], Promise<TrainingTypes.TextClassifier[]>>;

            before(() => {
                getExpiredStub = sinon.stub(store, 'getExpiredConversationWorkspaces');
            });
            after(() => {
                getExpiredStub.restore();
            });

            it('should delete expired text service models from the DB only', async () => {
                const expiredTxt = existingTxtModel('expiredproject');
                getExpiredStub.resolves([ goodClassifier, expiredTxt ]);

                await textmodels.cleanupExpiredModels();

                assert(deleteStoreStub.calledTwice);
                assert(deleteStoreStub.calledWith(expiredTxt.id));
                assert(resetExpiredScratchKeyStub.calledWith(expiredTxt.workspace_id, 'text'));
                assert(authByIdStoreStub.neverCalledWith(''));

                // Watson Assistant models are deleted as before
                assert(deleteStub.calledOnce);
                assert(deleteStub.calledWith('http://conversation.service/v1/workspaces/good', sinon.match.any));
                assert(deleteStoreStub.calledWith(goodClassifier.id));
                assert(resetExpiredScratchKeyStub.calledWith(goodClassifier.workspace_id, 'text'));
            });
        });


        describe('Scratch keys for text service models', () => {

            it('should create a Scratch key for an existing model', async () => {
                const project = keylessProject('scratchproject');
                const model = storeTrainedModel(project.id);
                storeScratchKeyStub.resolves('newkeyid');
                authByIdStoreStub.resetHistory();

                const key = await textmodels.createTextScratchKey(project);

                assert.deepStrictEqual(key, { id : 'newkeyid', model : model.workspace_id });
                assert(storeScratchKeyStub.calledOnceWith(project, TXT_KEY_CREDENTIALS, model.workspace_id, model.created));
                assert(authByIdStoreStub.notCalled);
            });

            it('should report a trained model as ready', async () => {
                const model = storeTrainedModel('scratchproject');

                const status = await textmodels.getScratchKeyStatus(txtScratchKey('scratchproject', model.workspace_id));

                assert.deepStrictEqual(status, { status : 2, msg : 'Ready', type : 'text' });
            });

            it('should report a deleted model as unavailable', async () => {
                const status = await textmodels.getScratchKeyStatus(txtScratchKey('scratchproject', 'deleted'));

                assert.deepStrictEqual(status, { status : 0, msg : 'Model Non Existent', type : 'text' });
            });

            it('should report a new cloud model as training, then ready', async () => {
                const training = deferredTraining();
                const project = keylessProject('scratchproject');

                const trainStatus = await textmodels.trainWithScratchKey(project);
                assert.deepStrictEqual(trainStatus, { status : 1, msg : 'Model not ready yet', type : 'text' });

                const placeholder = storeScratchKeyStub.firstCall.args[2];
                const training1 = await textmodels.getScratchKeyStatus(txtScratchKey(project.id, placeholder));
                assert.deepStrictEqual(training1, { status : 1, msg : 'Model not ready yet', type : 'text' });

                training.resolve();
                await textmodels.waitForTrainings();

                // the Scratch key is pointed at the trained model
                assert(replacePlaceholderStub.calledOnceWith(project.id, placeholder, MODELID));
                const ready = await textmodels.getScratchKeyStatus(txtScratchKey(project.id, MODELID));
                assert.deepStrictEqual(ready, { status : 2, msg : 'Ready', type : 'text' });
            });

            it('should report a new local model as training', async () => {
                const status = await textmodels.trainLocalWithScratchKey(keylessLocalProject('scratchlocal'), TRAINING);
                assert.deepStrictEqual(status, { status : 1, msg : 'Model not ready yet', type : 'text' });
                await textmodels.waitForTrainings();
            });

            it('should report a failed training as unavailable', async () => {
                trainStub.rejects(invalidTraining());
                const project = keylessProject('scratchproject');

                await textmodels.trainWithScratchKey(project);
                await textmodels.waitForTrainings();

                // the Scratch key keeps the placeholder
                assert(replacePlaceholderStub.notCalled);
                const placeholder = storeScratchKeyStub.firstCall.args[2];
                const status = await textmodels.getScratchKeyStatus(txtScratchKey(project.id, placeholder));
                assert.deepStrictEqual(status, { status : 0, msg : 'Model Failed', type : 'text' });
            });

            it('should report a retrain as training, then ready', async () => {
                const training = deferredTraining();
                const project = keylessProject('scratchproject');
                const existing = storeTrainedModel(project.id);

                const trainStatus = await textmodels.trainWithScratchKey(project);
                assert.deepStrictEqual(trainStatus, { status : 1, msg : 'Model not ready yet', type : 'text' });

                const training1 = await textmodels.getScratchKeyStatus(txtScratchKey(project.id, existing.id));
                assert.deepStrictEqual(training1, { status : 1, msg : 'Model not ready yet', type : 'text' });

                training.resolve();
                await textmodels.waitForTrainings();

                assert(replacePlaceholderStub.calledOnceWith(project.id, existing.id, MODELID));
                const ready = await textmodels.getScratchKeyStatus(txtScratchKey(project.id, MODELID));
                assert.deepStrictEqual(ready, { status : 2, msg : 'Ready', type : 'text' });
            });
        });


        describe('usage events', () => {

            const CLIENT: DbTypes.TextServiceUsageClient = { source : 'scratchkey', country : 'NZ' };

            // TRAINING has two labels, each with one example (of 7 and 15 characters)
            const TRAINING_SIZE = { labels : 2, examples : 2, chars : 22, weightedchars : 22 };

            let notifyStub: sinon.SinonStub<[string, string], void>;

            beforeEach(() => {
                usageStub.reset();
                usageStub.resolves();
                notifyStub = sinon.stub(notifications, 'notify');
            });
            afterEach(() => {
                notifyStub.restore();
                textmodels.resumeTrainingsForTests();
            });

            /** the events recorded, without values that weren't known, so they can be compared exactly */
            function recorded(): DbTypes.TextServiceUsageEvent[] {
                return usageStub.getCalls().map((call) => {
                    const known = Object.entries(call.args[0]).filter(([ , value ]) => value !== undefined);
                    return Object.fromEntries(known) as DbTypes.TextServiceUsageEvent;
                });
            }
            function recordedEvents(event: DbTypes.TextServiceUsageEventType): DbTypes.TextServiceUsageEvent[] {
                return recorded().filter((item) => item.event === event);
            }
            function recordedEvent(event: DbTypes.TextServiceUsageEventType): DbTypes.TextServiceUsageEvent {
                const found = recordedEvents(event);
                assert.strictEqual(found.length, 1, 'expected one ' + event + ' event, got ' + JSON.stringify(found));
                return found[0];
            }

            /** training that is above the threshold, that Watson Assistant can create a model for */
            function largeTraining(): TrainingTypes.ConversationTrainingData {
                return { ...WA_TRAINING, intents : [ { intent : 'label', examples : [ { text : 'a'.repeat(100000) } ] } ] };
            }
            /** training that Watson Assistant can create a model for */
            const WA_TRAINING = { ...TRAINING, name : 'Bob\'s text project' };
            const LARGE_SIZE = { labels : 1, examples : 1, chars : 100000, weightedchars : 100000 };


            describe('train-accept', () => {

                it('should record an accepted new model', async () => {
                    const project = keylessLocalProject('usageproject');

                    const classifier = await textmodels.trainClassifierForProject(project, TRAINING, CLIENT);

                    const { recorded : when, durationms, ...event } = recordedEvent('train-accept');
                    assert(when instanceof Date);
                    assert(typeof durationms === 'number' && durationms >= 0);
                    assert.deepStrictEqual(event, {
                        event : 'train-accept',
                        outcome : 'accepted',
                        projectid : project.id,
                        modelid : classifier.id,
                        tenanttype : DbTypes.ClassTenantType.UnManaged,
                        language : 'en',
                        size : TRAINING_SIZE,
                        client : CLIENT,
                    });
                });

                it('should record the size weighted by the language', async () => {
                    await textmodels.trainClassifierForProject(keylessLocalProject('usageproject'),
                        { ...TRAINING, language : 'ja' }, CLIENT);

                    const event = recordedEvent('train-accept');
                    assert.strictEqual(event.language, 'ja');
                    assert.deepStrictEqual(event.size, { labels : 2, examples : 2, chars : 22, weightedchars : 66 });
                });

                it('should record an accepted retrain', async () => {
                    const project = keylessLocalProject('usageproject');
                    const existing = storeTrainedModel(project.id);

                    await textmodels.trainClassifierForProject(project, TRAINING, CLIENT);

                    const event = recordedEvent('train-accept');
                    assert.strictEqual(event.outcome, 'accepted');
                    assert.strictEqual(event.modelid, existing.id);
                    assert.deepStrictEqual(event.size, TRAINING_SIZE);
                });

                it('should record a duplicate request during a training', async () => {
                    const training = deferredTraining();
                    const project = keylessLocalProject('usageproject');

                    const first = await textmodels.trainClassifierForProject(project, TRAINING, CLIENT);
                    await textmodels.trainClassifierForProject(project, TRAINING, CLIENT);

                    const outcomes = recordedEvents('train-accept').map((event) => [ event.outcome, event.modelid ]);
                    assert.deepStrictEqual(outcomes, [ [ 'accepted', first.id ], [ 'duplicate', first.id ] ]);

                    training.resolve();
                });

                it('should record a duplicate request that creates at the same time', async () => {
                    const training = deferredTraining();
                    const project = keylessLocalProject('usageproject');

                    await Promise.all([
                        textmodels.trainClassifierForProject(project, TRAINING, CLIENT),
                        textmodels.trainClassifierForProject(project, TRAINING, CLIENT),
                    ]);

                    const outcomes = recordedEvents('train-accept').map((event) => event.outcome).sort();
                    assert.deepStrictEqual(outcomes, [ 'accepted', 'duplicate' ]);

                    training.resolve();
                });

                it('should record training that the text service would not accept', async () => {
                    const project = keylessLocalProject('usageproject');
                    const training = { ...TRAINING, intents : [ TRAINING.intents[0] ] };

                    await assert.rejects(() => textmodels.trainClassifierForProject(project, training, CLIENT),
                        { message : textmodels.ERROR_MESSAGES.INVALID_TRAINING });

                    const event = recordedEvent('train-accept');
                    assert.strictEqual(event.outcome, 'invalid');
                    assert.strictEqual(event.modelid, undefined);
                    assert.deepStrictEqual(event.size, { labels : 1, examples : 1, chars : 7, weightedchars : 7 });
                });

                it('should record a student at the model limit', async () => {
                    countTxtStub.withArgs('bob').resolves(3);
                    const project = keylessLocalProject('usageproject');

                    await assert.rejects(() => textmodels.trainClassifierForProject(project, TRAINING, CLIENT),
                        { message : textmodels.ERROR_MESSAGES.TOO_MANY_MODELS });

                    const { recorded : when, durationms, ...event } = recordedEvent('train-accept');
                    assert(when instanceof Date);
                    assert(typeof durationms === 'number' && durationms >= 0);
                    assert.deepStrictEqual(event, {
                        event : 'train-accept',
                        outcome : 'limit',
                        projectid : project.id,
                        tenanttype : DbTypes.ClassTenantType.UnManaged,
                        language : 'en',
                        size : TRAINING_SIZE,
                        client : CLIENT,
                    });
                });

                it('should record a large new model sent to Watson Assistant', async () => {
                    const project = keylessLocalProject('usageproject');

                    const classifier = await textmodels.trainClassifierForProject(project, largeTraining(), CLIENT);

                    const event = recordedEvent('train-accept');
                    assert.strictEqual(event.outcome, 'large');
                    assert.strictEqual(event.modelid, classifier.id);
                    assert.deepStrictEqual(event.size, LARGE_SIZE);
                    assert.deepStrictEqual(event.client, CLIENT);
                });

                it('should record a large retrain moving to Watson Assistant', async () => {
                    const project = keylessLocalProject('usageproject');
                    storeTrainedModel(project.id);

                    const classifier = await textmodels.trainClassifierForProject(project, largeTraining(), CLIENT);

                    const event = recordedEvent('train-accept');
                    assert.strictEqual(event.outcome, 'move');
                    assert.strictEqual(event.modelid, classifier.id);
                    assert.deepStrictEqual(event.size, LARGE_SIZE);
                });

                it('should not record trainings for classes with their own keys', async () => {
                    const project = createProject('projectbob', 'Bob\'s text project', 'fr', [ 'temperature', 'conditions' ]);

                    await textmodels.trainClassifier(project, CLIENT);

                    assert.deepStrictEqual(recorded(), []);
                });

                it('should not record trainings for managed pool classes', async () => {
                    const project = { ...createProject('poolproject', 'Bob\'s text project', 'en', [ 'temperature' ]), classid : POOL.id };

                    await textmodels.trainClassifier(project, CLIENT);

                    assert.deepStrictEqual(recorded(), []);
                });
            });


            describe('train-attempt', () => {

                it('should record a successful call to the text service', async () => {
                    const project = keylessLocalProject('usageproject');

                    const classifier = await textmodels.trainClassifierForProject(project, TRAINING, CLIENT);
                    await textmodels.waitForTrainings();

                    const { recorded : when, durationms, ...event } = recordedEvent('train-attempt');
                    assert(when instanceof Date);
                    assert(typeof durationms === 'number' && durationms >= 0);
                    assert.deepStrictEqual(event, {
                        event : 'train-attempt',
                        outcome : 'ok',
                        projectid : project.id,
                        modelid : classifier.id,
                        tenanttype : DbTypes.ClassTenantType.UnManaged,
                        language : 'en',
                        size : TRAINING_SIZE,
                        attempt : 1,
                        client : CLIENT,
                    });
                });

                it('should record every attempt, with how long the service asked to wait', async () => {
                    await withFakeTimers(async (clock) => {
                        trainStub.onFirstCall().rejects(busy(30000));
                        trainStub.onSecondCall().rejects(droppedConnection());

                        await textmodels.trainClassifierForProject(keylessLocalProject('usageproject'), TRAINING, CLIENT);
                        await runTrainings(clock);

                        const attempts = recordedEvents('train-attempt').map((event) => {
                            return { outcome : event.outcome, attempt : event.attempt, retryafterms : event.retryafterms, client : event.client };
                        });
                        assert.deepStrictEqual(attempts, [
                            { outcome : 'busy', attempt : 1, retryafterms : 30000, client : CLIENT },
                            { outcome : 'network', attempt : 2, retryafterms : undefined, client : CLIENT },
                            { outcome : 'ok', attempt : 3, retryafterms : undefined, client : CLIENT },
                        ]);
                    });
                });

                it('should record unexpected failures as other', async () => {
                    trainStub.rejects(new Error('something unexpected'));

                    await textmodels.trainClassifierForProject(keylessLocalProject('usageproject'), TRAINING, CLIENT);
                    await textmodels.waitForTrainings();

                    assert.strictEqual(recordedEvent('train-attempt').outcome, 'other');
                });
            });


            describe('train-end', () => {

                it('should record a model that is available', async () => {
                    await withFakeTimers(async (clock) => {
                        trainStub.onFirstCall().rejects(busy(30000));
                        const project = keylessLocalProject('usageproject');

                        const classifier = await textmodels.trainClassifierForProject(project, TRAINING, CLIENT);
                        await runTrainings(clock);

                        const { recorded : when, ...event } = recordedEvent('train-end');
                        assert(when instanceof Date);
                        assert.deepStrictEqual(event, {
                            event : 'train-end',
                            outcome : 'available',
                            projectid : project.id,
                            modelid : classifier.id,
                            tenanttype : DbTypes.ClassTenantType.UnManaged,
                            language : 'en',
                            size : TRAINING_SIZE,
                            totalms : 30000,
                            attempt : 2,
                            client : CLIENT,
                        });
                    });
                });

                it('should record a failed training', async () => {
                    trainStub.rejects(invalidTraining());

                    await textmodels.trainClassifierForProject(keylessLocalProject('usageproject'), TRAINING, CLIENT);
                    await textmodels.waitForTrainings();

                    const event = recordedEvent('train-end');
                    assert.strictEqual(event.outcome, 'failed');
                    assert.strictEqual(event.attempt, 1);
                    assert.deepStrictEqual(event.client, CLIENT);
                });

                it('should record a training for a deleted model as discarded', async () => {
                    const training = deferredTraining();
                    const project = keylessLocalProject('usageproject');

                    const classifier = await textmodels.trainClassifierForProject(project, TRAINING, CLIENT);
                    await textmodels.deleteClassifier(KEYLESS, classifier);
                    training.resolve();
                    await textmodels.waitForTrainings();

                    assert.strictEqual(recordedEvent('train-end').outcome, 'discarded');
                });

                it('should record a training that stops retrying after a delete as discarded', async () => {
                    await withFakeTimers(async (clock) => {
                        trainStub.onFirstCall().rejects(busy(30000));
                        const project = keylessLocalProject('usageproject');

                        const classifier = await textmodels.trainClassifierForProject(project, TRAINING, CLIENT);
                        await clock.tickAsync(0);
                        await textmodels.deleteClassifier(KEYLESS, classifier);
                        await runTrainings(clock);

                        assert(trainStub.calledOnce);
                        const event = recordedEvent('train-end');
                        assert.strictEqual(event.outcome, 'discarded');
                        assert.strictEqual(event.attempt, 1);
                    });
                });

                it('should record a training failed at the shutdown cut-off once', async () => {
                    await withFakeTimers(async (clock) => {
                        const training = deferredTraining();

                        await textmodels.trainClassifierForProject(keylessLocalProject('usageproject'), TRAINING, CLIENT);
                        await clock.tickAsync(0);

                        const stopping = textmodels.stopTrainings(new Date(Date.now() + 240000));
                        await clock.tickAsync(240000);
                        await stopping;

                        const event = recordedEvent('train-end');
                        assert.strictEqual(event.outcome, 'shutdown');
                        assert.strictEqual(event.totalms, 240000);
                        assert.deepStrictEqual(event.client, CLIENT);

                        // the training finishing afterwards doesn't record another end
                        training.resolve();
                        await runTrainings(clock);
                        assert.strictEqual(recordedEvents('train-end').length, 1);
                    });
                });

                it('should record a training not retried during shutdown', async () => {
                    await withFakeTimers(async (clock) => {
                        trainStub.onFirstCall().rejects(busy(30000));

                        await textmodels.trainClassifierForProject(keylessLocalProject('usageproject'), TRAINING, CLIENT);
                        await clock.tickAsync(0);
                        const stopping = textmodels.stopTrainings(new Date(Date.now() + 240000));
                        await clock.tickAsync(30000);
                        await stopping;

                        assert.strictEqual(recordedEvent('train-end').outcome, 'shutdown');
                    });
                });

                it('should record an abandoned training found by a status check once', async () => {
                    const model = storeTrainedModel('usageproject');
                    const stored = fakeModels.get(model.id) as FakeTextServiceModel;
                    delete stored.head;
                    const started = new Date(Date.now() - textmodels.ABANDON_TRAINING_AFTER_MS - 1000);
                    stored.trainingstarted = started;

                    const first = await textmodels.getModelStatuses(KEYLESS, [ { ...model } ]);
                    const second = await textmodels.getModelStatuses(KEYLESS, [ { ...model } ]);

                    assert.strictEqual(first[0].status, 'Failed');
                    assert.strictEqual(second[0].status, 'Failed');

                    const { recorded : when, totalms, ...event } = recordedEvent('train-end');
                    assert(when instanceof Date);
                    // a status check doesn't know the project, but the
                    //  model id matches the train-accept event
                    assert.deepStrictEqual(event, {
                        event : 'train-end',
                        outcome : 'abandoned',
                        modelid : model.id,
                    });
                    assert(typeof totalms === 'number' && totalms > textmodels.ABANDON_TRAINING_AFTER_MS);
                    assert(notifyStub.calledOnce);
                });

                it('should record an abandoned training replaced by a retrain', async () => {
                    const project = keylessLocalProject('usageproject');
                    const model = storeTrainedModel(project.id);
                    const stored = fakeModels.get(model.id) as FakeTextServiceModel;
                    delete stored.head;
                    stored.trainingstarted = new Date(Date.now() - textmodels.ABANDON_TRAINING_AFTER_MS - 1000);

                    await textmodels.trainClassifierForProject(project, TRAINING, CLIENT);
                    await textmodels.waitForTrainings();

                    const outcomes = recordedEvents('train-end').map((event) => event.outcome);
                    assert.deepStrictEqual(outcomes, [ 'abandoned', 'available' ]);

                    // the new training's size and client aren't the abandoned training's
                    const { recorded : when, totalms, ...abandoned } = recordedEvents('train-end')[0];
                    assert(when instanceof Date);
                    assert(typeof totalms === 'number' && totalms > textmodels.ABANDON_TRAINING_AFTER_MS);
                    assert.deepStrictEqual(abandoned, {
                        event : 'train-end',
                        outcome : 'abandoned',
                        projectid : project.id,
                        modelid : model.id,
                        tenanttype : DbTypes.ClassTenantType.UnManaged,
                        language : 'en',
                    });
                });
            });


            describe('classify', () => {

                const CLASSES = [
                    { class_name : 'temperature', confidence : 91, classifierTimestamp : new Date('2026-11-01T10:00:00Z') },
                    { class_name : 'conditions', confidence : 9, classifierTimestamp : new Date('2026-11-01T10:00:00Z') },
                ];

                it('should record classifying with a cached model', async () => {
                    const model = storeTrainedModel('usageproject');
                    classifyStub.resolves({ classes : CLASSES, outcome : 'ok' });

                    await textmodels.classifyModel(KEYLESS, 'usageproject', model.workspace_id, new Date(), 'Héllo \u{1F600}', CLIENT);

                    const { recorded : when, durationms, ...event } = recordedEvent('classify');
                    assert(when instanceof Date);
                    assert(typeof durationms === 'number' && durationms >= 0);
                    assert.deepStrictEqual(event, {
                        event : 'classify',
                        outcome : 'ok',
                        projectid : 'usageproject',
                        modelid : model.id,
                        language : 'en',
                        // code points, not UTF-16 units
                        size : { chars : 7 },
                        client : CLIENT,
                    });
                });

                it('should record classifying that needed the head', async () => {
                    const model = storeTrainedModel('usageproject');
                    classifyStub.resolves({ classes : CLASSES, outcome : 'cached-miss' });

                    await textmodels.classifyWithScratchKey(txtScratchKey('usageproject', model.workspace_id), 'Hello', CLIENT);

                    const event = recordedEvent('classify');
                    assert.strictEqual(event.outcome, 'cached-miss');
                    assert.deepStrictEqual(event.client, CLIENT);
                });

                it('should record a random answer while a model is training', async () => {
                    const training = deferredTraining();
                    // a project id that the mock store can choose random labels for
                    const project = keylessProject('projectbob');
                    const classifier = await textmodels.trainClassifier(project, CLIENT);
                    usageStub.resetHistory();

                    const classes = await textmodels.classifyWithScratchKey(txtScratchKey(project.id, classifier.id), 'Hello', CLIENT);

                    assert.strictEqual(classes[0].random, true);
                    assert(classifyStub.notCalled);
                    const event = recordedEvent('classify');
                    assert.strictEqual(event.outcome, 'placeholder');
                    assert.strictEqual(event.modelid, classifier.id);

                    training.resolve();
                });

                it('should record failures from the text service', async () => {
                    const model = storeTrainedModel('usageproject');
                    classifyStub.rejects(new textservice.TextServiceClassifyError(textmodels.ERROR_MESSAGES.SERVICE_ERROR, 'timeout'));

                    await assert.rejects(() => textmodels.classifyModel(KEYLESS, 'usageproject', model.workspace_id, new Date(), 'Hello', CLIENT),
                        { message : textmodels.ERROR_MESSAGES.SERVICE_ERROR });

                    assert.strictEqual(recordedEvent('classify').outcome, 'timeout');
                });

                it('should record other failures as other', async () => {
                    const model = storeTrainedModel('usageproject');
                    classifyStub.rejects(new Error(textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND));

                    await assert.rejects(() => textmodels.classifyModel(KEYLESS, 'usageproject', model.workspace_id, new Date(), 'Hello', CLIENT),
                        { message : textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND });

                    assert.strictEqual(recordedEvent('classify').outcome, 'other');
                });

                it('should not record text that is rejected before it is classified', async () => {
                    const model = storeTrainedModel('usageproject');

                    await assert.rejects(() => textmodels.classifyModel(KEYLESS, 'usageproject', model.workspace_id, new Date(), 'a'.repeat(3000), CLIENT),
                        { message : textmodels.ERROR_MESSAGES.TEXT_TOO_LONG });

                    assert.deepStrictEqual(recorded(), []);
                });

                it('should not record classifying with Watson Assistant models', async () => {
                    getTextClassifierStub.withArgs('projectbob', goodClassifier.workspace_id).resolves(clone(goodClassifier));

                    await textmodels.classifyModel(CLASS, 'projectbob', goodClassifier.workspace_id, new Date(), 'Hello', CLIENT);

                    assert.deepStrictEqual(recorded(), []);
                });
            });


            describe('large-pool', () => {

                it('should record a new model trained using the large pool', async () => {
                    const project = keylessLocalProject('usageproject');

                    const classifier = await textmodels.trainClassifierForProject(project, largeTraining(), CLIENT);

                    const { recorded : when, durationms, ...event } = recordedEvent('large-pool');
                    assert(when instanceof Date);
                    assert(typeof durationms === 'number' && durationms >= 0);
                    assert.deepStrictEqual(event, {
                        event : 'large-pool',
                        outcome : 'ok',
                        projectid : project.id,
                        modelid : classifier.id,
                        tenanttype : DbTypes.ClassTenantType.UnManaged,
                        language : 'en',
                        size : LARGE_SIZE,
                        client : CLIENT,
                    });
                });

                it('should record the large pool running out', async () => {
                    poolStub.resolves([]);

                    await assert.rejects(() => textmodels.trainClassifierForProject(keylessLocalProject('usageproject'), largeTraining(), CLIENT),
                        { message : conversation.ERROR_MESSAGES.POOL_EXHAUSTED });

                    const event = recordedEvent('large-pool');
                    assert.strictEqual(event.outcome, 'exhausted');
                    assert.strictEqual(event.modelid, undefined);
                    assert.strictEqual(recordedEvent('train-accept').outcome, 'large');
                });

                it('should record other failures using the large pool', async () => {
                    poolStub.rejects(new Error('DB is down'));

                    await assert.rejects(() => textmodels.trainClassifierForProject(keylessLocalProject('usageproject'), largeTraining(), CLIENT),
                        { message : 'DB is down' });

                    assert.strictEqual(recordedEvent('large-pool').outcome, 'other');
                });

                it('should record a move to Watson Assistant using the large pool', async () => {
                    const project = keylessLocalProject('usageproject');
                    storeTrainedModel(project.id);

                    const classifier = await textmodels.trainClassifierForProject(project, largeTraining(), CLIENT);

                    const event = recordedEvent('large-pool');
                    assert.strictEqual(event.outcome, 'ok');
                    assert.strictEqual(event.modelid, classifier.id);
                });

                it('should record retraining a model from the large pool', async () => {
                    const LARGE_POOL_CREDS = { ...mockstore.poolCreds, id : 'largepoolcreds', source : 'large-pool' as const };
                    const convModel = { ...clone(goodClassifier), credentialsid : LARGE_POOL_CREDS.id };
                    const project = keylessLocalProject('usageproject');
                    authByIdStoreStub.withArgs(LARGE_POOL_CREDS.id).resolves(LARGE_POOL_CREDS);
                    getTextClassifiersStub.withArgs(project.id).resolves([ convModel ]);

                    try {
                        await textmodels.trainClassifierForProject(project, WA_TRAINING, CLIENT);

                        const event = recordedEvent('large-pool');
                        assert.strictEqual(event.outcome, 'ok');
                        assert.strictEqual(event.modelid, convModel.id);
                        assert.deepStrictEqual(event.size, TRAINING_SIZE);
                        assert.deepStrictEqual(recordedEvents('train-accept'), []);
                    }
                    finally {
                        authByIdStoreStub.withArgs(LARGE_POOL_CREDS.id).callsFake(mockstore.getCombinedBluemixCredentialsById);
                    }
                });

                it('should not record retraining a model from a class\'s own keys', async () => {
                    const convModel = clone(goodClassifier);
                    const project = keylessLocalProject('usageproject');
                    getTextClassifiersStub.withArgs(project.id).resolves([ convModel ]);

                    await textmodels.trainClassifierForProject(project, WA_TRAINING, CLIENT);

                    assert.deepStrictEqual(recorded(), []);
                });
            });


            it('should never record text or label names', async () => {
                const SECRET_LABEL = 'secretlabelname';
                const SECRET_TEXT = 'my secret example text';
                const training = {
                    ...TRAINING,
                    name : 'secret project name',
                    intents : [
                        { intent : SECRET_LABEL, examples : [ { text : SECRET_TEXT } ] },
                        { intent : SECRET_LABEL + 'two', examples : [ { text : SECRET_TEXT + ' two' } ] },
                    ],
                };
                const project = keylessLocalProject('usageproject');
                classifyStub.resolves({ classes : [ { class_name : SECRET_LABEL, confidence : 90, classifierTimestamp : new Date() } ], outcome : 'ok' });

                await textmodels.trainClassifierForProject(project, training, CLIENT);
                await textmodels.waitForTrainings();
                const [ model ] = await store.getTextClassifiers(project.id);
                await textmodels.classifyModel(KEYLESS, project.id, model.workspace_id, new Date(), 'my secret test text', CLIENT);
                await textmodels.trainClassifierForProject(keylessLocalProject('usagelarge'),
                    { ...largeTraining(), intents : [ { intent : SECRET_LABEL, examples : [ { text : SECRET_TEXT + 'a'.repeat(100000) } ] } ] },
                    CLIENT);

                const events = recorded();
                assert.deepStrictEqual([ ...new Set(events.map((event) => event.event)) ].sort(),
                    [ 'classify', 'large-pool', 'train-accept', 'train-attempt', 'train-end' ]);
                const all = JSON.stringify(events);
                for (const secret of [ SECRET_LABEL, 'secret example', 'secret test', 'secret project' ]) {
                    assert(!all.includes(secret), secret + ' was recorded');
                }
            });


            it('should train as normal if events cannot be recorded', async () => {
                usageStub.rejects(new Error('DB is down'));
                const project = keylessLocalProject('usageproject');

                const classifier = await textmodels.trainClassifierForProject(project, TRAINING, CLIENT);
                await textmodels.waitForTrainings();

                assert.strictEqual(classifier.status, 'Training');
                assert.strictEqual((await getStoredModel(project.id)).status, 'Available');
                assert(usageStub.called);
            });
        });
    });
});
