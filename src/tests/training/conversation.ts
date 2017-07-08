/*eslint-env mocha */

// tslint:disable:max-line-length

import * as uuid from 'uuid/v1';
import * as assert from 'assert';
import * as httpstatus from 'http-status';
import * as sinon from 'sinon';
import * as request from 'request-promise';
import * as clone from 'clone';
import * as randomstring from 'randomstring';

import * as store from '../../lib/db/store';
import * as conversation from '../../lib/training/conversation';
import * as DbTypes from '../../lib/db/db-types';
import * as TrainingTypes from '../../lib/training/training-types';

import * as mockstore from './mockstore';



describe('Training - Conversation', () => {

    let getStub;
    let createStub;
    let deleteStub;
    let getProjectStub;
    let authStoreStub;
    let authByIdStoreStub;
    let countStoreStub;
    let getConversationWorkspacesStub;
    let getStoreStub;
    let storeStoreStub;
    let updateConversationStub;
    let deleteStoreStub;
    let storeScratchKeyStub;
    let resetExpiredScratchKeyStub;
    let getClassStub;


    before(() => {
        getStub = sinon.stub(request, 'get').callsFake(mockConversation.getClassifier);
        createStub = sinon.stub(request, 'post');
        createStub.withArgs(sinon.match(/.*workspaces/), sinon.match.any).callsFake(mockConversation.createClassifier);
        createStub.withArgs(sinon.match(/.*message/), sinon.match.any).callsFake(mockConversation.testClassifier);
        deleteStub = sinon.stub(request, 'delete').callsFake(mockConversation.deleteClassifier);

        getProjectStub = sinon.stub(store, 'getProject').callsFake(mockstore.getProject);
        authStoreStub = sinon.stub(store, 'getBluemixCredentials').callsFake(mockstore.getBluemixCredentials);
        authByIdStoreStub = sinon.stub(store, 'getBluemixCredentialsById').callsFake(mockstore.getBluemixCredentialsById);
        getConversationWorkspacesStub = sinon.stub(store, 'getConversationWorkspaces').callsFake(mockstore.getConversationWorkspaces);
        countStoreStub = sinon.stub(store, 'countTextTrainingByLabel').callsFake(mockstore.countTextTrainingByLabel);
        getStoreStub = sinon.stub(store, 'getTextTrainingByLabel').callsFake(mockstore.getTextTrainingByLabel);
        storeStoreStub = sinon.stub(store, 'storeConversationWorkspace').callsFake(mockstore.storeConversationWorkspace);
        updateConversationStub = sinon.stub(store, 'updateConversationWorkspaceExpiry').callsFake(mockstore.updateConversationWorkspaceExpiry);
        deleteStoreStub = sinon.stub(store, 'deleteConversationWorkspace').callsFake(mockstore.deleteConversationWorkspace);
        storeScratchKeyStub = sinon.stub(store, 'storeOrUpdateScratchKey').callsFake(mockstore.storeOrUpdateScratchKey);
        resetExpiredScratchKeyStub = sinon.stub(store, 'resetExpiredScratchKey').callsFake(mockstore.resetExpiredScratchKey);
        getClassStub = sinon.stub(store, 'getClassTenant').callsFake(mockstore.getClassTenant);
    });
    after(() => {
        getStub.restore();
        createStub.restore();
        deleteStub.restore();
        getProjectStub.restore();
        authStoreStub.restore();
        authByIdStoreStub.restore();
        getConversationWorkspacesStub.restore();
        countStoreStub.restore();
        getStoreStub.restore();
        storeStoreStub.restore();
        updateConversationStub.restore();
        deleteStoreStub.restore();
        storeScratchKeyStub.restore();
        resetExpiredScratchKeyStub.restore();
        getClassStub.restore();
    });





    describe('create classifier', () => {

        it('should create a classifier', async () => {
            storeScratchKeyStub.reset();

            const classid = 'TESTTENANT';
            const userid = 'bob';
            const projectid = 'projectbob';
            const projectname = 'Bob\'s text project';

            const project: DbTypes.Project = {
                id : projectid,
                name : projectname,
                userid, classid,
                type : 'text',
                fields : [],
                labels : ['temperature', 'conditions'],
            };

            const classifier = await conversation.trainClassifier(project);
            assert(classifier.id);

            assert.deepEqual(classifier, {
                id : classifier.id,
                name : projectname,
                language : 'en',
                created : newClassifierDate,
                updated : newClassifierDate,
                expiry : newExpiryDate,
                workspace_id : '04f2d303-16fd-4f2e-80f4-2c66784cc0fe',
                credentialsid : '123',
                status : 'Training',
                url : 'http://conversation.service/v1/workspaces/04f2d303-16fd-4f2e-80f4-2c66784cc0fe',
            });

            assert(
                storeScratchKeyStub.calledWith(project, mockstore.creds,
                    '04f2d303-16fd-4f2e-80f4-2c66784cc0fe'));
        });


        it('should handle failures to create a classifier', async () => {
            storeScratchKeyStub.reset();

            const classid = 'TESTTENANT';
            const userid = 'unluckybob';
            const projectid = 'projectbob';
            const projectname = 'Bob\'s broken project';

            const project: DbTypes.Project = {
                id : projectid,
                name : projectname,
                userid, classid,
                type : 'text',
                fields : [],
                labels : ['this', 'that'],
            };

            try {
                await conversation.trainClassifier(project);
                assert.fail(0, 1, 'should not have allowed this', '');
            }
            catch (err) {
                assert.equal(err.message, 'Failed to train workspace');
            }
        });
    });



    describe('test classifier', () => {

        it('should return classes from NLC', async () => {
            const creds: TrainingTypes.BluemixCredentials = {
                id : '123',
                username : 'user',
                password : 'pass',
                servicetype : 'conv',
                url : 'http://conversation.service',
            };
            const classes = await conversation.testClassifier(creds, 'good', 'projectid', 'Hello');
            assert.deepEqual(classes, [
                {
                    class_name : 'temperature',
                    confidence : 100,
                },
                {
                    class_name : 'conditions',
                    confidence : 0,
                },
            ]);
        });


        it('should fail to return classes from broken NLC', async () => {
            const creds: TrainingTypes.BluemixCredentials = {
                id : '123',
                username : 'user',
                password : 'pass',
                servicetype : 'conv',
                url : 'http://conversation.service',
            };
            const classes = await conversation.testClassifier(creds, 'bad', 'projectid', 'Hello');
            assert.equal(classes.length, 1);
            assert.equal(classes[0].confidence, 0);
            assert.equal(classes[0].random, true);
        });
    });



    describe('delete classifier', () => {

        it('should delete a classifier', async () => {
            deleteStub.reset();
            deleteStoreStub.reset();
            resetExpiredScratchKeyStub.reset();

            assert.equal(deleteStub.called, false);
            assert.equal(deleteStoreStub.called, false);

            await conversation.deleteClassifier(goodClassifier);

            assert(deleteStub.calledOnce);
            assert(deleteStoreStub.calledOnce);

            assert(deleteStub.calledWith('http://conversation.service/v1/workspaces/good', {
                auth : { user : 'user', pass : 'pass' },
                qs : { version : '2017-05-26' },
            }));
            assert(deleteStoreStub.calledWith(goodClassifier.id));
            assert(resetExpiredScratchKeyStub.called);
        });


        it('should cope with deleting a classifier missing from Bluemix', async () => {
            deleteStub.reset();
            deleteStoreStub.reset();
            resetExpiredScratchKeyStub.reset();

            const missingErr: any = new Error();
            missingErr.statusCode = 404;

            deleteStub
                .withArgs('http://conversation.service/v1/workspaces/doesnotactuallyexist', sinon.match.any)
                .throws(missingErr);

            assert.equal(deleteStub.called, false);
            assert.equal(deleteStoreStub.called, false);

            const workspaceid = uuid();

            await conversation.deleteClassifier({
                id : workspaceid,
                workspace_id : 'doesnotactuallyexist',
                credentialsid : '123',
                url : 'http://conversation.service/v1/workspaces/doesnotactuallyexist',
                name : 'This does not exist',
                language : 'en',
                created : new Date(),
                expiry : new Date(),
            });

            assert(deleteStub.calledOnce);
            assert(deleteStoreStub.calledOnce);

            assert(deleteStub.calledWith('http://conversation.service/v1/workspaces/doesnotactuallyexist', {
                auth : { user : 'user', pass : 'pass' },
                qs : { version : '2017-05-26' },
            }));
            assert(deleteStoreStub.calledWith(workspaceid));
            assert(resetExpiredScratchKeyStub.called);
        });
    });


    describe('get classifier info', () => {

        it('should get info for a ready classifier', async () => {
            const reqClone = clone([ goodClassifier ]);
            const one = await conversation.getClassifierStatuses('CLASSID', reqClone);

            assert.deepEqual(one, [ goodClassifierWithStatus ]);
        });


        it('should get info for a broken classifier', async () => {
            const reqClone = clone([ brokenClassifier ]);
            const one = await conversation.getClassifierStatuses('CLASSID', reqClone);

            assert.deepEqual(one, [ brokenClassifierWithStatus ]);
        });

        it('should get info for multiple classifiers', async () => {
            const reqClone = clone([
                goodClassifier,
                brokenClassifier,
                trainingClassifier,
            ]);
            const three = await conversation.getClassifierStatuses('CLASSID', reqClone);

            assert.deepEqual(three, [
                goodClassifierWithStatus,
                brokenClassifierWithStatus,
                trainingClassifierWithStatus,
            ]);
        });

        it('should get info for no classifiers', async () => {
            const reqClone = [ ];
            const none = await conversation.getClassifierStatuses('CLASSID', reqClone);

            assert.deepEqual(none, []);
        });


        it('should get info for unknown classifiers', async () => {
            const reqClone = clone([
                brokenClassifier,
                unknownClassifier,
                trainingClassifier,
                goodClassifier,
            ]);
            const three = await conversation.getClassifierStatuses('CLASSID', reqClone);

            assert.deepEqual(three, [
                brokenClassifierWithStatus,
                unknownClassifierWithStatus,
                trainingClassifierWithStatus,
                goodClassifierWithStatus,
            ]);
        });
    });




    const newClassifierDate = new Date();
    newClassifierDate.setMilliseconds(0);
    const newExpiryDate = new Date();
    newExpiryDate.setMilliseconds(0);
    newExpiryDate.setHours(newClassifierDate.getHours() + 2);

    const mockConversation = {
        getClassifier : (url) => {
            return new Promise((resolve, reject) => {
                switch (url) {
                case 'http://conversation.service/v1/workspaces/good':
                    return resolve(goodClassifierStatus);
                case 'http://conversation.service/v1/workspaces/bad':
                    return resolve(brokenClassifierStatus);
                case 'http://conversation.service/v1/workspaces/stillgoing':
                    return resolve(trainingClassifierStatus);
                default:
                    return reject({
                        error : 'Resource not found',
                    });
                }
            });
        },
        deleteClassifier : (url) => {
            return new Promise((resolve, reject) => {
                switch (url) {
                case 'http://conversation.service/v1/workspaces/good':
                    return resolve();
                case 'http://conversation.service/v1/workspaces/bad':
                    return resolve();
                case 'http://conversation.service/v1/workspaces/stillgoing':
                    return resolve();
                default:
                    return reject({ error : 'Resource not found' });
                }
            });
        },
        createClassifier : (url, options) => {
            return new Promise((resolve, reject) => {
                if (options.body.name === 'Bob\'s text project') {

                    assert.equal(options.body.language, 'en');
                    assert.equal(options.body.intents[0].intent, 'temperature');
                    assert.equal(options.body.intents[1].intent, 'conditions');
                    assert.equal(options.body.intents[0].examples.length, 18);
                    assert.equal(options.body.intents[1].examples.length, 16);

                    resolve({
                        name : options.body.name,
                        created : newClassifierDate.toISOString(),
                        updated : newClassifierDate.toISOString(),
                        language : options.body.language,
                        metadata : null,
                        description : null,
                        workspace_id : '04f2d303-16fd-4f2e-80f4-2c66784cc0fe',
                    });
                }
                else {
                    reject({
                        error : 'Invalid Request Body',
                        errors : [
                            {
                                message : 'text cannot be longer than 1024 characters',
                                path : '.intents[0].examples[0].text',
                            },
                        ],
                    });
                }
            });
        },
        testClassifier : (url, opts) => {
            return new Promise((resolve) => {
                switch (url) {
                case 'http://conversation.service/v1/workspaces/good/message':
                    return resolve({
                        intents : [
                            {
                                intent : 'temperature',
                                confidence : 0.9998201258549781,
                            },
                            {
                                intent : 'conditions',
                                confidence : 0.00017987414502176904,
                            },
                        ],
                        entities : [],
                        input : { text : opts.body.input.text },
                        output : {
                            text : [],
                            nodes_visited : [],
                            warning : 'No dialog node matched for the input at a root level. ' +
                                        '(and there is 1 more warning in the log)',
                            log_messages : [
                                {
                                    level : 'warn',
                                    msg : 'No dialog node matched for the input at a root level.',
                                },
                                {
                                    level : 'warn',
                                    msg : 'No dialog node condition matched to true in the last dialog round ' +
                                            '- context.nodes_visited is empty. ' +
                                            'Falling back to the root node in the next round.',
                                },
                            ],
                        },
                        context : {
                            conversation_id : uuid(),
                            system : {
                                dialog_stack : [
                                    {
                                        dialog_node : 'root',
                                    },
                                ],
                                dialog_turn_counter : 1,
                                dialog_request_counter : 1,
                            },
                        },
                    });
                case 'http://conversation.service/v1/workspaces/bad/message':
                    return resolve({
                        intents : [],
                        entities : [],
                        input : { text : opts.body.input.text },
                        output : {
                            text : [],
                            nodes_visited : [],
                            warning : 'No dialog node matched for the input at a root level. ' +
                                        '(and there is 1 more warning in the log)',
                            log_messages : [
                                {
                                    level : 'warn',
                                    msg : 'No dialog node matched for the input at a root level.',
                                },
                                {
                                    level : 'warn',
                                    msg : 'No dialog node condition matched to true in the last dialog round ' +
                                            '- context.nodes_visited is empty. ' +
                                            'Falling back to the root node in the next round.',
                                },
                            ],
                        },
                        context : {
                            conversation_id : uuid(),
                            system : {
                                dialog_stack : [
                                    {
                                        dialog_node : 'root',
                                    },
                                ],
                                dialog_turn_counter : 1,
                                dialog_request_counter : 1,
                            },
                        },
                    });
                case 'http://conversation.service/v1/workspaces/stillgoing/message':
                    return resolve({
                        intents : [],
                        entities : [],
                        input : { text : opts.body.input.text },
                        output : {
                            text : [],
                            nodes_visited : [],
                            warning : 'No dialog node matched for the input at a root level. ' +
                                        '(and there is 1 more warning in the log)',
                            log_messages : [
                                {
                                    level : 'warn',
                                    msg : 'No dialog node matched for the input at a root level.',
                                },
                                {
                                    level : 'warn',
                                    msg : 'No dialog node condition matched to true in the last dialog round ' +
                                            '- context.nodes_visited is empty. ' +
                                            'Falling back to the root node in the next round.',
                                },
                            ],
                        },
                        context : {
                            conversation_id : uuid(),
                            system : {
                                dialog_stack : [
                                    {
                                        dialog_node : 'root',
                                    },
                                ],
                                dialog_turn_counter : 1,
                                dialog_request_counter : 1,
                            },
                        },
                    });
                }
            });
        },
    };


    const goodClassifier: TrainingTypes.ConversationWorkspace = {
        id : uuid(),
        credentialsid : '123',
        name : 'good classifier',
        language : 'en',
        created : new Date(),
        expiry : new Date(),
        url : 'http://conversation.service/v1/workspaces/good',
        workspace_id : 'good',
    };
    const goodClassifierWithStatus = Object.assign({}, goodClassifier, {
        status : 'Available',
        updated : goodClassifier.created,
    });

    const goodClassifierStatus = {
        name : goodClassifier.name,
        language : goodClassifier.language,
        metadata : null,
        description : null,
        workspace_id : 'good',
        status : 'Available',
        created : goodClassifier.created.toISOString(),
        updated : goodClassifier.created.toISOString(),
    };



    const trainingClassifier: TrainingTypes.ConversationWorkspace = {
        id : uuid(),
        credentialsid : '123',
        name : 'try again later',
        language : 'en',
        created : new Date(),
        expiry : new Date(),
        url : 'http://conversation.service/v1/workspaces/stillgoing',
        workspace_id : 'stillgoing',
    };
    const trainingClassifierWithStatus = Object.assign({}, trainingClassifier, {
        status : 'Training',
        updated : trainingClassifier.created,
    });

    const trainingClassifierStatus = {
        name : trainingClassifier.name,
        language : trainingClassifier.language,
        metadata : null,
        description : null,
        workspace_id : 'stillgoing',
        status : 'Training',
        created : trainingClassifier.created.toISOString(),
        updated : trainingClassifier.created.toISOString(),
    };



    const brokenClassifier: TrainingTypes.ConversationWorkspace = {
        id : uuid(),
        credentialsid : '123',
        name : 'bad bad bad',
        language : 'en',
        created : new Date(),
        expiry : new Date(),
        url : 'http://conversation.service/v1/workspaces/bad',
        workspace_id : 'bad',
    };
    const brokenClassifierWithStatus = Object.assign({}, brokenClassifier, {
        status : 'Failed',
        updated : brokenClassifier.created,
    });

    const brokenClassifierStatus = {
        name : brokenClassifier.name,
        language : brokenClassifier.language,
        metadata : null,
        description : null,
        workspace_id : 'bad',
        status : 'Failed',
        created : brokenClassifier.created.toISOString(),
        updated : brokenClassifier.created.toISOString(),
    };


    const unknownClassifier: TrainingTypes.ConversationWorkspace = {
        id : uuid(),
        credentialsid : '123',
        name : 'not here any more',
        language : 'en',
        created : new Date(),
        expiry : new Date(),
        url : 'http://conversation.service/v1/workspaces/deleted',
        workspace_id : 'deleted',
    };
    const unknownClassifierWithStatus = Object.assign({}, unknownClassifier, {
        status : 'Non Existent',
    });

});
