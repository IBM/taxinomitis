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


    before(() => {
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
        let storeTxtStub: sinon.SinonStub<any, any>;
        let updateTxtStub: sinon.SinonStub<any, any>;
        let getHeadStub: sinon.SinonStub<any, any>;
        let getHeadUpdatedStub: sinon.SinonStub<any, any>;
        let poolStub: sinon.SinonStub<any, any>;

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
            intents : [ { intent : 'label', examples : [ { text : 'example' } ] } ],
            dialog_nodes : [],
            counterexamples : [],
            entities : [],
            metadata : { createdby : 'machinelearningforkids' },
        };

        before(() => {
            isConfiguredStub = sinon.stub(env, 'isTextServiceConfigured').returns(true);
            trainStub = sinon.stub(textservice, 'train');
            classifyStub = sinon.stub(textservice, 'classify');
            countTxtStub = sinon.stub(store, 'countTextServiceModelsByUser');
            storeTxtStub = sinon.stub(store, 'storeTextServiceModel');
            updateTxtStub = sinon.stub(store, 'updateTextServiceModel');
            getHeadStub = sinon.stub(store, 'getTextClassifierHead');
            getHeadUpdatedStub = sinon.stub(store, 'getTextClassifierHeadUpdated');
            poolStub = sinon.stub(store, 'getBluemixCredentialsPoolBatch');

            getClassStub.withArgs(KEYLESS.id).resolves(KEYLESS);
            getClassStub.withArgs(POOL.id).resolves(POOL);
            getClassStub.withArgs(MANAGED.id).resolves(MANAGED);
            authStoreStub.withArgs(sinon.match.has('id', KEYLESS.id), 'conv')
                .rejects(new Error('Unexpected response when retrieving service credentials'));
        });
        beforeEach(() => {
            isConfiguredStub.returns(true);
            trainStub.reset();
            trainStub.resolves({ modelid : MODELID, head : HEAD });
            classifyStub.reset();
            countTxtStub.reset();
            countTxtStub.resolves(0);
            storeTxtStub.reset();
            storeTxtStub.resolves();
            updateTxtStub.reset();
            updateTxtStub.resolves();
            getHeadStub.reset();
            getHeadUpdatedStub.reset();
            poolStub.reset();
            poolStub.resolves([ { ...creds, credstype : 'conv_plus' } ]);
        });
        after(() => {
            isConfiguredStub.restore();
            trainStub.restore();
            classifyStub.restore();
            countTxtStub.restore();
            storeTxtStub.restore();
            updateTxtStub.restore();
            getHeadStub.restore();
            getHeadUpdatedStub.restore();
            poolStub.restore();

            getClassStub.reset();
            getClassStub.callsFake(mockstore.getClassTenant);
            authStoreStub.reset();
            authStoreStub.callsFake(mockstore.getBluemixCredentials);
        });


        describe('routing new models', () => {

            it('should use the text service for a class without Watson Assistant keys', async () => {
                const project = keylessProject('keylessproject');

                const before = new Date();
                const classifier = await textmodels.trainClassifier(project);
                const after = new Date();

                assert(trainStub.calledOnce);
                assert.strictEqual(createStub.called, false);

                assert.deepStrictEqual(classifier, {
                    id : classifier.id,
                    workspace_id : MODELID,
                    credentialsid : '',
                    servicetype : 'txt',
                    url : '',
                    name : 'Keyless project',
                    language : 'en',
                    created : classifier.created,
                    updated : classifier.created,
                    expiry : new Date(classifier.created.getTime() + (2 * 60 * 60 * 1000)),
                    status : 'Available',
                });
                assert.strictEqual(classifier.id.length, 36);
                assert(classifier.created.getTime() >= before.getTime());
                assert(classifier.created.getTime() <= after.getTime());
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
                assert(storeTxtStub.notCalled);
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


        describe('creating text service models', () => {

            it('should send the training data to the text service', async () => {
                const project = keylessLocalProject('keylesslocal');

                await textmodels.trainClassifierForProject(project, TRAINING);

                assert(trainStub.calledOnceWithExactly(TRAINING));
            });

            it('should store the model, its head and a Scratch key', async () => {
                const project = keylessProject('keylessproject');

                const classifier = await textmodels.trainClassifier(project);

                assert(storeTxtStub.calledOnce);
                const [ storedProject, storedModel, storedHead, storedUpdated ] = storeTxtStub.firstCall.args;
                assert.strictEqual(storedProject, project);
                assert.strictEqual(storedModel.id, classifier.id);
                assert.strictEqual(storedModel.workspace_id, MODELID);
                assert.strictEqual(storedModel.servicetype, 'txt');
                assert.strictEqual(storedModel.credentialsid, '');
                assert.strictEqual(storedModel.url, '');
                assert.deepStrictEqual(storedModel.expiry, classifier.expiry);
                assert.strictEqual(storedHead, HEAD);
                assert.deepStrictEqual(storedUpdated, classifier.updated);

                assert(storeScratchKeyStub.calledOnceWith(project, TXT_KEY_CREDENTIALS, MODELID, classifier.updated));
                assert(storeStoreStub.notCalled);
            });

            it('should not store a Scratch key if the model cannot be stored', async () => {
                const project = keylessProject('keylessproject');
                storeTxtStub.rejects(new Error('Failed to store text model'));
                const notifyStub = sinon.stub(notifications, 'notify');

                try {
                    await assert.rejects(
                        () => textmodels.trainClassifier(project),
                        { message : 'Failed to store text model' });

                    assert(storeScratchKeyStub.notCalled);
                    assert(notifyStub.calledOnce);
                }
                finally {
                    notifyStub.restore();
                }
            });

            it('should not store anything if training fails', async () => {
                const project = keylessProject('keylessproject');
                trainStub.rejects(new Error(textmodels.ERROR_MESSAGES.SERVICE_BUSY));

                await assert.rejects(
                    () => textmodels.trainClassifier(project),
                    { message : textmodels.ERROR_MESSAGES.SERVICE_BUSY });

                assert(storeTxtStub.notCalled);
                assert(storeScratchKeyStub.notCalled);
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
                assert(storeTxtStub.notCalled);
            });

            it('should train a new model for a student below the limit', async () => {
                const project = keylessProject('keylessproject');
                countTxtStub.withArgs('bob').resolves(2);

                await textmodels.trainClassifier(project);

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

            it('should not limit Watson Assistant models', async () => {
                const project = createProject('projectbob', 'Bob\'s text project', 'fr', [ 'temperature', 'conditions' ]);
                countTxtStub.resolves(100);

                const classifier = await textmodels.trainClassifier(project);

                assert.strictEqual(classifier.servicetype, 'conv');
            });
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


        describe('retraining text service models', () => {

            for (const tenant of [ KEYLESS, POOL, MANAGED ]) {
                it('should retrain using the text service for a ' + DbTypes.ClassTenantType[tenant.tenantType] + ' class', async () => {
                    const project = { ...keylessProject('retrainproject'), classid : tenant.id };
                    const existing = existingTxtModel(project.id);
                    getTextClassifiersStub.withArgs(project.id).resolves([ existing ]);
                    const recordFailureStub = sinon.stub(store, 'recordBluemixCredentialsPoolFailure');

                    try {
                        const before = new Date();
                        const classifier = await textmodels.trainClassifier(project);

                        assert(trainStub.calledOnce);
                        assert.strictEqual(createStub.called, false);
                        assert(poolStub.notCalled);
                        assert(recordFailureStub.notCalled);

                        assert.strictEqual(classifier.id, existing.id);
                        assert.strictEqual(classifier.workspace_id, MODELID);
                        assert.strictEqual(classifier.status, 'Available');
                        assert(classifier.updated && classifier.updated.getTime() >= before.getTime());
                        assert.deepStrictEqual(classifier.expiry,
                            new Date((classifier.updated as Date).getTime() + (2 * 60 * 60 * 1000)));

                        assert(updateTxtStub.calledOnceWith(project, classifier, HEAD, classifier.updated));
                        assert(storeScratchKeyStub.calledOnceWith(project, TXT_KEY_CREDENTIALS, MODELID, classifier.updated));
                        assert(storeTxtStub.notCalled);
                        assert(updateConversationStub.notCalled);
                    }
                    finally {
                        recordFailureStub.restore();
                        getTextClassifiersStub.withArgs(project.id).callsFake(mockstore.getTextClassifiers);
                    }
                });
            }

            it('should retrain a student\'s model when they are at the limit', async () => {
                const project = keylessProject('retrainproject');
                getTextClassifiersStub.withArgs(project.id).resolves([ existingTxtModel(project.id) ]);
                countTxtStub.resolves(3);

                try {
                    const classifier = await textmodels.trainClassifier(project);
                    assert.strictEqual(classifier.workspace_id, MODELID);
                }
                finally {
                    getTextClassifiersStub.withArgs(project.id).callsFake(mockstore.getTextClassifiers);
                }
            });

            it('should retrain using the text service even if it is no longer configured', async () => {
                isConfiguredStub.returns(false);
                const project = keylessProject('retrainproject');
                getTextClassifiersStub.withArgs(project.id).resolves([ existingTxtModel(project.id) ]);

                try {
                    await textmodels.trainClassifier(project);
                    assert(trainStub.calledOnce);
                }
                finally {
                    getTextClassifiersStub.withArgs(project.id).callsFake(mockstore.getTextClassifiers);
                }
            });

            it('should report failures to store a retrained model', async () => {
                const project = keylessProject('retrainproject');
                getTextClassifiersStub.withArgs(project.id).resolves([ existingTxtModel(project.id) ]);
                const dbError = new Error('Scratch key not updated');
                storeScratchKeyStub.onFirstCall().rejects(dbError);
                const notifyStub = sinon.stub(notifications, 'notify');

                try {
                    await assert.rejects(
                        () => textmodels.trainClassifier(project),
                        dbError);

                    assert(updateTxtStub.calledOnce);
                    assert(notifyStub.calledOnce);
                    assert(notifyStub.firstCall.args[0].includes('retrainproject'));
                    assert(notifyStub.firstCall.args[0].includes('Scratch key not updated'));
                    assert.strictEqual(notifyStub.firstCall.args[1], notifications.SLACK_CHANNELS.TRAINING_ERRORS);
                }
                finally {
                    notifyStub.restore();
                    storeScratchKeyStub.reset();
                    storeScratchKeyStub.callsFake(mockstore.storeOrUpdateScratchKey);
                    getTextClassifiersStub.withArgs(project.id).callsFake(mockstore.getTextClassifiers);
                }
            });

            it('should keep the existing records if retraining fails', async () => {
                const project = keylessProject('retrainproject');
                getTextClassifiersStub.withArgs(project.id).resolves([ existingTxtModel(project.id) ]);
                trainStub.rejects(new Error(textmodels.ERROR_MESSAGES.TRAINING_TOO_LARGE));

                try {
                    await assert.rejects(
                        () => textmodels.trainClassifier(project),
                        { message : textmodels.ERROR_MESSAGES.TRAINING_TOO_LARGE });

                    assert(updateTxtStub.notCalled);
                    assert(storeScratchKeyStub.notCalled);
                    assert(deleteStoreStub.notCalled);
                }
                finally {
                    getTextClassifiersStub.withArgs(project.id).callsFake(mockstore.getTextClassifiers);
                }
            });
        });


        describe('text service model statuses', () => {

            for (const tenant of [ KEYLESS, POOL, MANAGED ]) {
                it('should report a model with a head as available for a ' + DbTypes.ClassTenantType[tenant.tenantType] + ' class', async () => {
                    const model = existingTxtModel('statusproject');
                    getHeadUpdatedStub.withArgs(model.id).resolves(new Date('2026-10-31T09:00:00Z'));
                    authByIdStoreStub.resetHistory();
                    getStub.resetHistory();

                    const statuses = await textmodels.getModelStatuses(tenant, [ model ]);

                    assert.deepStrictEqual(statuses, [ {
                        ...existingTxtModel('statusproject'),
                        status : 'Available',
                        updated : new Date('2026-10-31T09:00:00Z'),
                    } ]);
                    assert(authByIdStoreStub.notCalled);
                    assert(getStub.neverCalledWith(sinon.match(/workspaces/)));
                });
            }

            it('should report a model without a head as non existent', async () => {
                const model = existingTxtModel('statusproject');
                getHeadUpdatedStub.withArgs(model.id).resolves(undefined);

                const statuses = await textmodels.getModelStatuses(KEYLESS, [ model ]);

                assert.strictEqual(statuses[0].status, 'Non Existent');
            });

            it('should get statuses for a mix of models', async () => {
                const model = existingTxtModel('statusproject');
                getHeadUpdatedStub.withArgs(model.id).resolves(new Date('2026-10-31T09:00:00Z'));

                const statuses = await textmodels.getModelStatuses(CLASS, [ clone(goodClassifier), model ]);

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
                const model = { ...existingTxtModel('classifyproject'), workspace_id : MODELID };
                getTextClassifierStub.withArgs('classifyproject', MODELID).resolves(model);
                classifyStub.resolves(CLASSES);

                const timestamp = new Date('2026-11-01T10:00:00Z');
                const classes = await textmodels.classifyModel(POOL, 'classifyproject', MODELID, timestamp, 'Hello');

                assert.deepStrictEqual(classes, CLASSES);
                assert(classifyStub.calledOnceWith(MODELID, timestamp, 'Hello'));
                assert.strictEqual(createStub.called, false);
            });

            it('should only read the head if the service asks for it', async () => {
                const model = { ...existingTxtModel('classifyproject'), workspace_id : MODELID };
                getTextClassifierStub.withArgs('classifyproject', MODELID).resolves(model);
                getHeadStub.withArgs(model.id).resolves({ id : model.id, projectid : 'classifyproject', userid : 'bob', head : HEAD, updated : new Date() });
                classifyStub.resolves(CLASSES);

                await textmodels.classifyModel(KEYLESS, 'classifyproject', MODELID, new Date(), 'Hello');
                assert(getHeadStub.notCalled);

                const getHead = classifyStub.firstCall.args[3];
                assert.strictEqual(await getHead(), HEAD);
                assert(getHeadStub.calledOnceWith(model.id));
            });

            it('should report a missing head as a missing model', async () => {
                const model = { ...existingTxtModel('classifyproject'), workspace_id : MODELID };
                getTextClassifierStub.withArgs('classifyproject', MODELID).resolves(model);
                getHeadStub.withArgs(model.id).resolves(undefined);
                classifyStub.resolves(CLASSES);

                await textmodels.classifyModel(KEYLESS, 'classifyproject', MODELID, new Date(), 'Hello');

                const getHead = classifyStub.firstCall.args[3];
                await assert.rejects(getHead, { message : textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND });
            });

            it('should check the text before calling the text service', async () => {
                const model = { ...existingTxtModel('classifyproject'), workspace_id : MODELID };
                getTextClassifierStub.withArgs('classifyproject', MODELID).resolves(model);

                await assert.rejects(
                    () => textmodels.classifyModel(KEYLESS, 'classifyproject', MODELID, new Date(), 'x'.repeat(2049)),
                    { message : textmodels.ERROR_MESSAGES.TEXT_TOO_LONG });
                assert(classifyStub.notCalled);
            });

            it('should classify with a Scratch key', async () => {
                const model = { ...existingTxtModel('classifyproject'), workspace_id : MODELID };
                getTextClassifierStub.withArgs('classifyproject', MODELID).resolves(model);
                classifyStub.resolves(CLASSES);
                const key = txtScratchKey('classifyproject', MODELID);

                const classes = await textmodels.classifyWithScratchKey(key, 'Hello');

                assert.deepStrictEqual(classes, CLASSES);
                assert(classifyStub.calledOnceWith(MODELID, key.updated, 'Hello'));
                assert.strictEqual(createStub.called, false);
            });

            it('should report a Scratch key for a deleted model as not found', async () => {
                getTextClassifierStub.withArgs('classifyproject', 'deleted')
                    .rejects(new Error('Unexpected response when retrieving text classifier details'));

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
                const model = existingTxtModel(project.id);
                getTextClassifiersStub.withArgs(project.id).resolves([ model ]);
                storeScratchKeyStub.resolves('newkeyid');
                authByIdStoreStub.resetHistory();

                try {
                    const key = await textmodels.createTextScratchKey(project);

                    assert.deepStrictEqual(key, { id : 'newkeyid', model : model.workspace_id });
                    assert(storeScratchKeyStub.calledOnceWith(project, TXT_KEY_CREDENTIALS, model.workspace_id, model.created));
                    assert(authByIdStoreStub.notCalled);
                }
                finally {
                    getTextClassifiersStub.withArgs(project.id).callsFake(mockstore.getTextClassifiers);
                    storeScratchKeyStub.reset();
                    storeScratchKeyStub.callsFake(mockstore.storeOrUpdateScratchKey);
                }
            });

            it('should report a model with a head as ready', async () => {
                const model = { ...existingTxtModel('scratchproject'), workspace_id : MODELID };
                getTextClassifierStub.withArgs('scratchproject', MODELID).resolves(model);
                getHeadUpdatedStub.withArgs(model.id).resolves(new Date());

                const status = await textmodels.getScratchKeyStatus(txtScratchKey('scratchproject', MODELID));

                assert.deepStrictEqual(status, { status : 2, msg : 'Ready', type : 'text' });
            });

            it('should report a model without a head as unavailable', async () => {
                const model = { ...existingTxtModel('scratchproject'), workspace_id : MODELID };
                getTextClassifierStub.withArgs('scratchproject', MODELID).resolves(model);
                getHeadUpdatedStub.withArgs(model.id).resolves(undefined);

                const status = await textmodels.getScratchKeyStatus(txtScratchKey('scratchproject', MODELID));

                assert.deepStrictEqual(status, { status : 0, msg : 'Model Non Existent', type : 'text' });
            });

            it('should report a deleted model as unavailable', async () => {
                getTextClassifierStub.withArgs('scratchproject', 'deleted')
                    .rejects(new Error('Unexpected response when retrieving text classifier details'));

                const status = await textmodels.getScratchKeyStatus(txtScratchKey('scratchproject', 'deleted'));

                assert.deepStrictEqual(status, { status : 0, msg : 'Model Non Existent', type : 'text' });
            });

            it('should report a new cloud model as ready', async () => {
                const status = await textmodels.trainWithScratchKey(keylessProject('scratchproject'));
                assert.deepStrictEqual(status, { status : 2, msg : 'Ready', type : 'text' });
            });

            it('should report a new local model as ready', async () => {
                const status = await textmodels.trainLocalWithScratchKey(keylessLocalProject('scratchlocal'), TRAINING);
                assert.deepStrictEqual(status, { status : 2, msg : 'Ready', type : 'text' });
            });
        });
    });
});
