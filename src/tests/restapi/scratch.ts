/*eslint-env mocha */
import * as uuid from 'uuid/v1';
import * as assert from 'assert';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as randomstring from 'randomstring';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as util from 'util';
import * as requestPromise from 'request-promise';

import * as Types from '../../lib/training/training-types';

import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import testapiserver from './testserver';



let testServer;


const TESTCLASS = 'UNIQUECLASSID';



describe('REST API - scratch keys', () => {

    let authStub;
    let checkUserStub;
    let requireSupervisorStub;

    function authNoOp(req, res, next) { next(); }


    before(async () => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
        checkUserStub = sinon.stub(auth, 'checkValidUser').callsFake(authNoOp);
        requireSupervisorStub = sinon.stub(auth, 'requireSupervisor').callsFake(authNoOp);
        proxyquire('../../lib/restapi/users', {
            './auth' : {
                authenticate : authStub,
                checkValidUser : checkUserStub,
                requireSupervisor : requireSupervisorStub,
            },
        });

        await store.init();

        testServer = testapiserver();
    });


    after(() => {
        authStub.restore();
        checkUserStub.restore();
        requireSupervisorStub.restore();

        return store.disconnect();
    });


    describe('get keys', () => {

        it('should create a key on demand', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, []);

            return request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/' + userid + '/projects/' + project.id + '/scratchkeys')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body = res.body;
                    assert(util.isArray(body));
                    assert.equal(body.length, 1);
                    assert(body[0].id);
                    assert.equal(body[0].id.length, 72);
                    assert(!body[0].model);

                    await store.deleteProject(project.id);
                    await store.deleteScratchKey(body[0].id);
                });
        });


        it('should create a trained key on demand', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const credentials = {
                id : uuid(),
                username : randomstring.generate({ length : 12 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv' as Types.BluemixServiceType,
                url : uuid(),
            };

            const workspace: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : randomstring.generate({ length : 12 }),
                credentialsid : credentials.id,
                url : uuid(),
                name,
                language : 'en',
                created : new Date(),
                expiry : new Date(),
            };

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, []);
            await store.storeBluemixCredentials(TESTCLASS, credentials);
            await store.storeConversationWorkspace(credentials, userid, TESTCLASS, project.id, workspace);

            return request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/' + userid + '/projects/' + project.id + '/scratchkeys')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body = res.body;
                    assert(util.isArray(body));
                    assert.equal(body.length, 1);
                    assert(body[0].id);
                    assert.equal(body[0].id.length, 72);
                    assert.equal(body[0].model, workspace.workspace_id);

                    await store.deleteProject(project.id);
                    await store.deleteScratchKey(body[0].id);
                    await store.deleteBluemixCredentials(credentials.id);
                    await store.deleteConversationWorkspace(workspace.id);
                });

        });


        it('should return an existing scratch key', async () => {
            const projectid = uuid();
            const userid = uuid();

            const keyId = await store.storeUntrainedScratchKey(projectid, 'dummyproject', 'text', userid, TESTCLASS);

            return request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/' + userid + '/projects/' + projectid + '/scratchkeys')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body = res.body;

                    assert(util.isArray(body));
                    assert.equal(body.length, 1);
                    assert(body[0].id);
                    assert.equal(body[0].id, keyId);
                    assert(!body[0].model);

                    await store.deleteScratchKey(keyId);
                });
        });

        it('should return an existing trained scratch key', async () => {
            const projectid = uuid();
            const userid = uuid();

            const classifierid = randomstring.generate({ length : 12 });

            const credentials = {
                id : uuid(),
                username : randomstring.generate({ length : 12 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv' as Types.BluemixServiceType,
                url : uuid(),
            };

            const keyId = await store.storeScratchKey(projectid, 'A Fake Project', 'text',
                                                      userid, TESTCLASS, credentials,
                                                      classifierid);

            return request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/' + userid + '/projects/' + projectid + '/scratchkeys')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body = res.body;

                    assert(util.isArray(body));
                    assert.equal(body.length, 1);
                    assert(body[0].id);
                    assert.equal(body[0].id, keyId);
                    assert.equal(body[0].model, classifierid);

                    await store.deleteScratchKey(keyId);
                });
        });
    });


    describe('use keys', () => {

        it('should require text to classify', async () => {
            const projectid = uuid();
            const key = await store.storeUntrainedScratchKey(projectid, 'test', 'text', 'userid', TESTCLASS);

            const callbackFunctionName = 'mycb';
            return request(testServer)
                .get('/api/scratch/' + key + '/classify?callback=' + callbackFunctionName)
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {
                    await store.deleteScratchKey(key);

                    assert.equal(res.error.text,
                        '/**/ typeof ' + callbackFunctionName +
                        ' === \'function\' && mycb({"error":"Missing data"});');
                });
        });

        it('should require numbers to classify', async () => {
            const projectid = uuid();
            const key = await store.storeUntrainedScratchKey(projectid, 'test', 'numbers', 'userid', TESTCLASS);

            const callbackFunctionName = 'mycb';
            return request(testServer)
                .get('/api/scratch/' + key + '/classify?callback=' + callbackFunctionName)
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {
                    await store.deleteScratchKey(key);

                    assert.equal(res.error.text,
                        '/**/ typeof ' + callbackFunctionName +
                        ' === \'function\' && mycb({"error":"Missing data"});');
                });
        });


        it('should return random labels for text without a classifier', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, []);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'vegetable');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'mineral');

            const keyId = await store.storeUntrainedScratchKey(project.id, name, typelabel, userid, TESTCLASS);

            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + keyId + '/classify')
                .query({ callback : callbackFunctionName, data : 'haddock' })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    await store.deleteProject(project.id);
                    await store.deleteScratchKey(keyId);

                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                          callbackFunctionName +
                                          ' === \'function\' && ' +
                                          callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));
                    const payload = JSON.parse(text.substring(expectedStart.length, text.length - 2));

                    assert.equal(payload.length, 3);
                    payload.forEach((item) => {
                        assert.equal(item.confidence, 33);
                        assert(item.random);
                        assert(['animal', 'vegetable', 'mineral'].indexOf(item.class_name) >= 0);
                    });
                });
        });



        it('should return random labels for numbers without a classifier', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'numbers';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, ['first', 'second', 'third']);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'vegetable');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'mineral');

            const keyId = await store.storeUntrainedScratchKey(project.id, name, typelabel, userid, TESTCLASS);

            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + keyId + '/classify')
                .query({ callback : callbackFunctionName, data : [1, 2, 3 ]})
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    await store.deleteProject(project.id);
                    await store.deleteScratchKey(keyId);

                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                          callbackFunctionName +
                                          ' === \'function\' && ' +
                                          callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));
                    const payload = JSON.parse(text.substring(expectedStart.length, text.length - 2));

                    assert.equal(payload.length, 3);
                    payload.forEach((item) => {
                        assert.equal(item.confidence, 33);
                        assert(item.random);
                        assert(['animal', 'vegetable', 'mineral'].indexOf(item.class_name) >= 0);
                    });
                });
        });


        it('should require the right number of numeric values to classify', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'numbers';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, ['first', 'second', 'third']);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'fruit');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'vegetable');

            const keyId = await store.storeUntrainedScratchKey(project.id, name, typelabel, userid, TESTCLASS);

            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + keyId + '/classify')
                .query({ callback : callbackFunctionName, data : [10, 20, 30, 40]})
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {
                    await store.deleteProject(project.id);
                    await store.deleteScratchKey(keyId);

                    assert.equal(res.error.text,
                        '/**/ typeof ' + callbackFunctionName + ' === \'function\' && ' +
                        callbackFunctionName + '({"error":"Missing data"});');
                });
        });


        it('should return status for the ScratchX extension', async () => {
            const projectid = uuid();
            const userid = uuid();

            const keyId = await store.storeUntrainedScratchKey(projectid, 'dummyproject', 'text', userid, TESTCLASS);

            return request(testServer)
                .get('/api/scratch/' + keyId + '/status')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    assert.deepEqual(res.body, {
                        msg : 'No models trained yet - only random answers can be chosen',
                        status : 0,
                    });

                    return store.deleteScratchKey(keyId);
                });
        });



        it('should build a working Scratchx extension', async () => {
            const userid = uuid();

            const project = await store.storeProject(userid, TESTCLASS, 'text', 'dummyproject', []);
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'LABEL NUMBER ONE');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'SECOND LABEL');

            const keyId = await store.storeUntrainedScratchKey(project.id, project.name, 'text', userid, TESTCLASS);

            return request(testServer)
                .get('/api/scratch/' + keyId + '/extension.js')
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body: string = res.text;

                    assert(body.startsWith('(function(ext) {'));
                    assert(body.indexOf('/api/scratch/' + keyId + '/status') > 0);
                    assert(body.indexOf('/api/scratch/' + keyId + '/classify') > 0);
                    assert(body.indexOf('ext.return_label_0 = function () {') > 0);
                    assert(body.indexOf('ext.return_label_1 = function () {') > 0);
                    assert(body.indexOf('ext.return_label_2 = function () {') === -1);
                    assert(body.indexOf('[ \'r\', \'LABEL NUMBER ONE\', \'return_label_0\'],') > 0);
                    assert(body.indexOf('[ \'r\', \'SECOND LABEL\', \'return_label_1\'],') > 0);

                    await store.deleteEntireProject(userid, TESTCLASS, project);
                });
        });







        function mockClassifier(url, opts) {
            return new Promise((resolve) => {
                resolve({
                    intents : [
                        {
                            intent : 'temperature',
                            confidence : 0.638,
                        },
                        {
                            intent : 'conditions',
                            confidence : 0.362,
                        },
                    ],
                    entities : [],
                    input : { text : opts.body.text },
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
                                msg : 'No dialog node condition matched to true in the last dialog round - ' +
                                        'context.nodes_visited is empty. ' +
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
            });
        }

        function brokenClassifier() {
            return new Promise((resolve, reject) => {
                reject({ error : {
                    code : 500,
                    error : 'Something bad happened',
                    description : 'It really was very bad',
                }});
            });
        }


        it('should return classes from a classifier', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const credentials = {
                id : uuid(),
                username : randomstring.generate({ length : 12 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv' as Types.BluemixServiceType,
                url : uuid(),
            };

            const workspaceId = randomstring.generate({ length : 32 });

            const conversationWorkspace: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : workspaceId,
                credentialsid : credentials.id,
                url : uuid(),
                name,
                language : 'en',
                created : new Date(),
                expiry : new Date(),
            };

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, []);
            await store.storeBluemixCredentials(TESTCLASS, credentials);
            await store.storeConversationWorkspace(credentials, userid, TESTCLASS, project.id, conversationWorkspace);

            const scratchKey = await store.storeOrUpdateScratchKey(
                project.id, 'text',
                userid, TESTCLASS,
                credentials, conversationWorkspace.workspace_id);

            const conversationStub = sinon.stub(requestPromise, 'post').callsFake(mockClassifier);

            const callbackFunctionName = 'cb';

            return request(testServer)
                .get('/api/scratch/' + scratchKey + '/classify')
                .query({ callback : callbackFunctionName, data : 'haddock' })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                          callbackFunctionName +
                                          ' === \'function\' && ' +
                                          callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));
                    const payload = JSON.parse(text.substring(expectedStart.length, text.length - 2));

                    assert.deepEqual(payload, [
                        { class_name: 'temperature', confidence: 64 },
                        { class_name: 'conditions', confidence: 36 },
                    ]);

                    await store.deleteProject(project.id);
                    await store.deleteScratchKey(scratchKey);
                    await store.deleteBluemixCredentials(credentials.id);
                    await store.deleteConversationWorkspace(conversationWorkspace.id);

                    conversationStub.restore();
                });
        });



        it('should return errors from a classifier', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const credentials = {
                id : uuid(),
                username : randomstring.generate({ length : 12 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv' as Types.BluemixServiceType,
                url : uuid(),
            };

            const workspace: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : randomstring.generate({ length : 12 }),
                credentialsid : credentials.id,
                url : uuid(),
                name,
                language : 'en',
                created : new Date(),
                expiry : new Date(),
            };

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, []);
            await store.storeBluemixCredentials(TESTCLASS, credentials);
            await store.storeConversationWorkspace(credentials, userid, TESTCLASS, project.id, workspace);

            const scratchKey = await store.storeOrUpdateScratchKey(
                project.id, 'text',
                userid, TESTCLASS,
                credentials, workspace.workspace_id);

            const conversationStub = sinon.stub(requestPromise, 'post').callsFake(brokenClassifier);

            const callbackFunctionName = 'cb';

            return request(testServer)
                .get('/api/scratch/' + scratchKey + '/classify')
                .query({ callback : callbackFunctionName, data : 'haddock' })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.INTERNAL_SERVER_ERROR)
                .then(async (res) => {
                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                          callbackFunctionName +
                                          ' === \'function\' && ' +
                                          callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));

                    const payload = JSON.parse(text.substring(expectedStart.length, text.length - 2));

                    assert.deepEqual(payload, {
                        error : {
                            code : 500,
                            error : 'Something bad happened',
                            description: 'It really was very bad',
                        },
                    });

                    await store.deleteProject(project.id);
                    await store.deleteScratchKey(scratchKey);
                    await store.deleteBluemixCredentials(credentials.id);
                    await store.deleteConversationWorkspace(workspace.id);

                    conversationStub.restore();
                });
        });


    });
});
