/*eslint-env mocha */
import * as uuid from 'uuid/v1';
import * as assert from 'assert';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as randomstring from 'randomstring';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as requestPromise from 'request-promise';
import * as Express from 'express';

import * as DbTypes from '../../lib/db/db-types';
import * as Types from '../../lib/training/training-types';

import * as store from '../../lib/db/store';
import * as limits from '../../lib/db/limits';
import * as auth from '../../lib/restapi/auth';
import * as conversation from '../../lib/training/conversation';
import testapiserver from './testserver';



let testServer: Express.Express;


const TESTCLASS = 'UNIQUECLASSID';



describe('REST API - scratch keys', () => {

    let authStub: sinon.SinonStub;
    let checkUserStub: sinon.SinonStub;
    let requireSupervisorStub: sinon.SinonStub;

    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        next();
    }

    let deleteStub: sinon.SinonStub;


    before(async () => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
        checkUserStub = sinon.stub(auth, 'checkValidUser').callsFake(authNoOp);
        requireSupervisorStub = sinon.stub(auth, 'requireSupervisor').callsFake(authNoOp);

        await store.init();

        testServer = testapiserver();

        deleteStub = sinon.stub(requestPromise, 'delete').resolves();
        proxyquire('../../lib/training/conversation', {
            'request-promise' : deleteStub,
        });
    });


    after(() => {
        authStub.restore();
        checkUserStub.restore();
        requireSupervisorStub.restore();

        deleteStub.restore();

        return store.disconnect();
    });


    describe('get keys', () => {

        it('should create a key on demand', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', []);

            return request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/' + userid + '/projects/' + project.id + '/scratchkeys')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body = res.body;
                    assert(Array.isArray(body));
                    assert.equal(body.length, 1);
                    assert(body[0].id);
                    assert.equal(body[0].id.length, 72);
                    assert(!body[0].model);

                    await store.deleteEntireUser(userid, TESTCLASS);
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
                classid : TESTCLASS,
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

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', []);
            await store.storeBluemixCredentials(TESTCLASS, credentials);
            await store.storeConversationWorkspace(credentials, project, workspace);

            return request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/' + userid + '/projects/' + project.id + '/scratchkeys')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body = res.body;
                    assert(Array.isArray(body));
                    assert.equal(body.length, 1);
                    assert(body[0].id);
                    assert.equal(body[0].id.length, 72);
                    assert.equal(body[0].model, workspace.workspace_id);

                    await store.deleteEntireProject(userid, TESTCLASS, project);
                    await store.deleteBluemixCredentials(credentials.id);
                });

        });


        it('should return an existing scratch key', async () => {
            const projectid = uuid();
            const userid = uuid();

            const project: DbTypes.Project = {
                id : projectid,
                name : 'dummyproject',
                userid,
                classid : TESTCLASS,
                type : 'text',
                language : 'en',
                labels : [],
                numfields : 0,
            };

            const keyId = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/' + userid + '/projects/' + projectid + '/scratchkeys')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body = res.body;

                    assert(Array.isArray(body));
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

            const project: DbTypes.Project = {
                id : projectid,
                name : 'A Fake Project',
                userid,
                classid : TESTCLASS,
                type : 'text',
                language : 'en',
                labels : [],
                numfields : 0,
            };

            const classifierid = randomstring.generate({ length : 12 });

            const credentials = {
                id : uuid(),
                username : randomstring.generate({ length : 12 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv' as Types.BluemixServiceType,
                url : uuid(),
                classid : TESTCLASS,
            };

            const keyId = await store.storeScratchKey(project, credentials, classifierid);

            return request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/' + userid + '/projects/' + projectid + '/scratchkeys')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body = res.body;

                    assert(Array.isArray(body));
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

            const project: DbTypes.Project = {
                id : projectid,
                name : 'Test Project',
                userid : 'userid',
                classid : TESTCLASS,
                type : 'text',
                language : 'en',
                labels : [],
                numfields : 0,
            };

            const key = await store.storeUntrainedScratchKey(project);

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

            const project: DbTypes.Project = {
                id : projectid,
                name : 'Test Project',
                userid : 'userid',
                classid : TESTCLASS,
                type : 'numbers',
                language : 'en',
                labels : [],
                numfields : 3,
            };

            const key = await store.storeUntrainedScratchKey(project);

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


        it('should treat image projects as not implemented yet for training', async () => {
            const projectid = uuid();

            const project: DbTypes.Project = {
                id : projectid,
                name : 'Test Project',
                userid : 'userid',
                classid : TESTCLASS,
                type : 'images',
                language : 'en',
                labels : [],
                numfields : 0,
            };

            const key = await store.storeUntrainedScratchKey(project);

            const callbackFunctionName = 'mycb';
            return request(testServer)
                .get('/api/scratch/' + key + '/train')
                .query({ callback : callbackFunctionName, data : 'inserted', label : 'animal' })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.NOT_IMPLEMENTED)
                .then(async (res) => {
                    await store.deleteScratchKey(key);

                    assert.equal(res.error.text,
                        '/**/ typeof ' + callbackFunctionName +
                        ' === \'function\' && mycb({"error":"Not implemented yet"});');
                });
        });


        it('should return random labels for text without a classifier', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', []);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'vegetable');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'mineral');

            const keyId = await store.storeUntrainedScratchKey(project);

            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + keyId + '/classify')
                .query({ callback : callbackFunctionName, data : 'haddock' })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                          callbackFunctionName +
                                          ' === \'function\' && ' +
                                          callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));

                    const classificationRespStr: string = text.substring(expectedStart.length, text.length - 2);
                    const payload: ClassificationResponse[] = JSON.parse(classificationRespStr);

                    assert.equal(payload.length, 3);
                    payload.forEach((item) => {
                        assert.equal(item.confidence, 33);
                        assert(item.random);
                        assert(['animal', 'vegetable', 'mineral'].indexOf(item.class_name) >= 0);
                    });
                });
        });

        interface ClassificationResponse {
            readonly confidence: number;
            readonly random: boolean;
            readonly class_name: string;
        }

        it('should return random labels for numbers without a classifier', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'numbers';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [
                { name : 'first', type : 'number' }, { name : 'second', type : 'number' },
                { name : 'third', type : 'number' },
            ]);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'vegetable');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'mineral');

            const keyId = await store.storeUntrainedScratchKey(project);

            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + keyId + '/classify')
                .query({ callback : callbackFunctionName, data : [1, 2, 3 ]})
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                          callbackFunctionName +
                                          ' === \'function\' && ' +
                                          callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));

                    const classificationRespStr: string = text.substring(expectedStart.length, text.length - 2);
                    const payload: ClassificationResponse[] = JSON.parse(classificationRespStr);

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

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [
                { name : 'first', type : 'number' }, { name : 'second', type : 'number' },
                { name : 'third', type : 'number' },
            ]);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'fruit');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'vegetable');

            const keyId = await store.storeUntrainedScratchKey(project);

            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + keyId + '/classify')
                .query({ callback : callbackFunctionName, data : [10, 20, 30, 40]})
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {
                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    assert.equal(res.error.text,
                        '/**/ typeof ' + callbackFunctionName + ' === \'function\' && ' +
                        callbackFunctionName + '({"error":"Missing data"});');
                });
        });


        it('should return status for the ScratchX extension', async () => {
            const projectid = uuid();
            const userid = uuid();

            const project: DbTypes.Project = {
                id : projectid,
                name : 'Another Test Project',
                userid,
                classid : TESTCLASS,
                type : 'text',
                language : 'en',
                labels : [],
                numfields : 0,
            };
            const keyId = await store.storeUntrainedScratchKey(project);

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

            const project = await store.storeProject(userid, TESTCLASS, 'text', 'dummyproject', 'en', []);
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'LABEL NUMBER ONE');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'SECOND LABEL');

            const keyId = await store.storeUntrainedScratchKey(project);

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
                    assert(body.indexOf('[ \'r\', \'LABEL_NUMBER_ONE\', \'return_label_0\'],') > 0);
                    assert(body.indexOf('[ \'r\', \'SECOND_LABEL\', \'return_label_1\'],') > 0);

                    await store.deleteEntireProject(userid, TESTCLASS, project);
                });
        });



        it('should require data to store text using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', []);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + keyId + '/train')
                .query({ callback : callbackFunctionName, data : '', label : 'animal' })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {

                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                          callbackFunctionName +
                                          ' === \'function\' && ' +
                                          callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));
                    const payload = JSON.parse(text.substring(expectedStart.length, text.length - 2));

                    assert.deepEqual(payload, { error : 'Missing data' });
                });
        });


        it('should require a valid label to store text using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', []);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + keyId + '/train')
                .query({ callback : callbackFunctionName, data : 'Data To Store', label : 'not_an_animal' })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {

                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                          callbackFunctionName +
                                          ' === \'function\' && ' +
                                          callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));
                    const payload = JSON.parse(text.substring(expectedStart.length, text.length - 2));

                    assert.deepEqual(payload, { error : 'Invalid label' });
                });
        });


        it('should enforce limits when storing training data using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', []);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            await store.storeTextTraining(project.id, uuid(), 'label');
            await store.storeTextTraining(project.id, uuid(), 'label');

            const limitsStub = sinon.stub(limits, 'getStoreLimits');
            limitsStub.returns({
                textTrainingItemsPerProject : 2,
                numberTrainingItemsPerProject : 2,
            });

            const keyId = await store.storeUntrainedScratchKey(project);

            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + keyId + '/train')
                .query({ callback : callbackFunctionName, data : 'inserted', label : 'animal' })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.CONFLICT)
                .then(async (res) => {

                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                          callbackFunctionName +
                                          ' === \'function\' && ' +
                                          callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));
                    const payload = JSON.parse(text.substring(expectedStart.length, text.length - 2));

                    assert.deepEqual(payload, {
                        error: 'Project already has maximum allowed amount of training data',
                    });

                    limitsStub.restore();
                });
        });


        it('should store text training data using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', []);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + keyId + '/train')
                .query({ callback : callbackFunctionName, data : 'inserted', label : 'animal' })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.OK)
                .then(async (res) => {

                    const count = await store.countTraining('text', project.id);
                    assert.equal(count, 1);

                    const retrieved = await store.getTextTraining(project.id, { start : 0, limit : 10 });
                    assert.equal(retrieved[0].textdata, 'inserted');
                    assert.equal(retrieved[0].label, 'animal');

                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                          callbackFunctionName +
                                          ' === \'function\' && ' +
                                          callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));
                    const payload = JSON.parse(text.substring(expectedStart.length, text.length - 2));

                    assert(payload.id);
                    assert.equal(payload.textdata, 'inserted');
                    assert.equal(payload.label, 'animal');
                    assert.equal(payload.projectid, project.id);
                });
        });



        it('should store numeric training data using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'numbers';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [
                { name : 'left', type : 'number' }, { name : 'right', type : 'number' },
                { name : 'another', type : 'multichoice', choices : [ 'bing', 'bong', 'bang' ] },
            ]);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'TOP');

            const keyId = await store.storeUntrainedScratchKey(project);

            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + keyId + '/train')
                .query({ callback : callbackFunctionName, data : ['1', '2.2', 'bong' ], label : 'TOP' })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.OK)
                .then(async (res) => {

                    const count = await store.countTraining('numbers', project.id);
                    assert.equal(count, 1);

                    const retrieved = await store.getNumberTraining(project.id, { start : 0, limit : 10 });
                    assert.deepEqual(retrieved[0].numberdata, [1, 2.2, 1]);
                    assert.equal(retrieved[0].label, 'TOP');

                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                          callbackFunctionName +
                                          ' === \'function\' && ' +
                                          callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));
                    const payload = JSON.parse(text.substring(expectedStart.length, text.length - 2));

                    assert(payload.id);
                    assert.deepEqual(payload.numberdata, [1, 2.2, 1]);
                    assert.equal(payload.label, 'TOP');
                    assert.equal(payload.projectid, project.id);
                });
        });


        it('should require data to store numbers using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'numbers';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [
                { name : 'a', type : 'number' },
            ]);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + keyId + '/train')
                .query({ callback : callbackFunctionName, data : [], label : 'animal' })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {

                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                          callbackFunctionName +
                                          ' === \'function\' && ' +
                                          callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));
                    const payload = JSON.parse(text.substring(expectedStart.length, text.length - 2));

                    assert.deepEqual(payload, { error : 'Missing data' });
                });
        });


        it('should require numeric data to store numbers using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'numbers';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [
                { name : 'a', type : 'number' },
            ]);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + keyId + '/train')
                .query({ callback : callbackFunctionName, data : ['This is not a number'], label : 'animal' })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {

                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                          callbackFunctionName +
                                          ' === \'function\' && ' +
                                          callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));
                    const payload = JSON.parse(text.substring(expectedStart.length, text.length - 2));

                    assert.deepEqual(payload, { error : 'Invalid data' });
                });
        });



        it('should require a valid choice when storing multi-choice fields using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'numbers';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [
                { name : 'a', type : 'number' },
                { name : 'b', type : 'multichoice', choices : [ 'valid', 'good', 'okay' ] },
            ]);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + keyId + '/train')
                .query({ callback : callbackFunctionName, data : [123, 'invalid'], label : 'animal' })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {

                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                          callbackFunctionName +
                                          ' === \'function\' && ' +
                                          callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));
                    const payload = JSON.parse(text.substring(expectedStart.length, text.length - 2));

                    assert.deepEqual(payload, { error : 'Invalid data' });
                });
        });



        it('should require some numeric data to store numbers using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'numbers';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [
                { name : 'a', type : 'number' },
            ]);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + keyId + '/train')
                .query({ callback : callbackFunctionName, data : [], label : 'animal' })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {

                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                          callbackFunctionName +
                                          ' === \'function\' && ' +
                                          callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));
                    const payload = JSON.parse(text.substring(expectedStart.length, text.length - 2));

                    assert.deepEqual(payload, { error : 'Missing data' });
                });
        });



        it('should require the right amount of data to store numbers using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'numbers';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [
                { name : 'a', type : 'number' }, { name : 'b', type : 'number' },
                { name : 'c', type : 'number' },
            ]);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + keyId + '/train')
                .query({
                    callback : callbackFunctionName,
                    data : ['123', '45'],
                    label : 'animal',
                })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {

                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                          callbackFunctionName +
                                          ' === \'function\' && ' +
                                          callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));
                    const payload = JSON.parse(text.substring(expectedStart.length, text.length - 2));

                    assert.deepEqual(payload, { error : 'Missing data' });
                });
        });



        it('should require a valid label to store numbers using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'numbers';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [
                { name : 'a', type : 'number' }, { name : 'b', type : 'number' },
            ]);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + keyId + '/train')
                .query({
                    callback : callbackFunctionName,
                    data : ['123', '45'],
                    label : 'NOT_VALID',
                })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {

                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                          callbackFunctionName +
                                          ' === \'function\' && ' +
                                          callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));
                    const payload = JSON.parse(text.substring(expectedStart.length, text.length - 2));

                    assert.deepEqual(payload, { error : 'Invalid label' });
                });
        });


        function mockClassifier(url: string, opts: conversation.ConversationApiRequestPayloadTestItem) {
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
                classid : TESTCLASS,
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

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', []);
            await store.storeBluemixCredentials(TESTCLASS, credentials);
            await store.storeConversationWorkspace(credentials, project, conversationWorkspace);

            const scratchKey = await store.storeOrUpdateScratchKey(
                project,
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

                    await store.deleteEntireProject(userid, TESTCLASS, project);
                    await store.deleteBluemixCredentials(credentials.id);

                    conversationStub.restore();
                });
        });


        it('should require data from POST for returning classes from a classifier', () => {
            const scratchKey = randomstring.generate({ length : 60 });

            return request(testServer)
                .post('/api/scratch/' + scratchKey + '/classify')
                .send()
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    const payload = res.body;
                    assert.deepEqual(payload, { error : 'Missing data' });
                });
        });


        it('should support POST for returning classes from a classifier', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const credentials = {
                id : uuid(),
                username : randomstring.generate({ length : 12 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv' as Types.BluemixServiceType,
                url : uuid(),
                classid : TESTCLASS,
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

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', []);
            await store.storeBluemixCredentials(TESTCLASS, credentials);
            await store.storeConversationWorkspace(credentials, project, conversationWorkspace);

            const scratchKey = await store.storeOrUpdateScratchKey(
                project,
                credentials, conversationWorkspace.workspace_id);

            const conversationStub = sinon.stub(requestPromise, 'post').callsFake(mockClassifier);

            return request(testServer)
                .post('/api/scratch/' + scratchKey + '/classify')
                .send({ data : 'haddock' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const payload = res.body;

                    assert.deepEqual(payload, [
                        { class_name: 'temperature', confidence: 64 },
                        { class_name: 'conditions', confidence: 36 },
                    ]);

                    await store.deleteEntireProject(userid, TESTCLASS, project);
                    await store.deleteBluemixCredentials(credentials.id);

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
                classid : TESTCLASS,
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

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', []);
            await store.storeBluemixCredentials(TESTCLASS, credentials);
            await store.storeConversationWorkspace(credentials, project, workspace);

            const scratchKey = await store.storeOrUpdateScratchKey(
                project,
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

                    await store.deleteEntireProject(userid, TESTCLASS, project);
                    await store.deleteBluemixCredentials(credentials.id);

                    conversationStub.restore();
                });
        });


    });
});
