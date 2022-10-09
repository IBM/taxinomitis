/*eslint-env mocha */
import { v1 as uuid } from 'uuid';
import * as assert from 'assert';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as randomstring from 'randomstring';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as coreReq from 'request';
import * as requestPromise from 'request-promise';
import * as Express from 'express';
import { readFile } from 'fs/promises';
import { Buffer } from 'buffer';

import * as DbTypes from '../../lib/db/db-types';
import * as Types from '../../lib/training/training-types';

import * as store from '../../lib/db/store';
import * as objectstore from '../../lib/objectstore';
import * as limits from '../../lib/db/limits';
import * as auth from '../../lib/restapi/auth';
import * as conversation from '../../lib/training/conversation';
import testapiserver from './testserver';



let testServer: Express.Express;


const TESTCLASS = 'UNIQUECLASSID';



describe('REST API - scratch keys', () => {

    let authStub: sinon.SinonStub<any, any>;
    let checkUserStub: sinon.SinonStub<any, any>;
    let requireSupervisorStub: sinon.SinonStub<any, any>;

    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        next();
    }

    let deleteStub: sinon.SinonStub<any, any>;


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

        objectstore.init();
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

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [], false);

            return request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/' + userid + '/projects/' + project.id + '/scratchkeys')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body = res.body;
                    assert(Array.isArray(body));
                    assert.strictEqual(body.length, 1);
                    assert(body[0].id);
                    assert.strictEqual(body[0].id.length, 72);
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
                credstypeid : 0,
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

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [], false);
            const storedCredentials = await store.storeBluemixCredentials(TESTCLASS, credentials);
            await store.storeConversationWorkspace(storedCredentials, project, workspace);

            return request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/' + userid + '/projects/' + project.id + '/scratchkeys')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body = res.body;
                    assert(Array.isArray(body));
                    assert.strictEqual(body.length, 1);
                    assert(body[0].id);
                    assert.strictEqual(body[0].id.length, 72);
                    assert.strictEqual(body[0].model, workspace.workspace_id);

                    await store.deleteEntireProject(userid, TESTCLASS, project);
                    await store.deleteBluemixCredentials(credentials.id);
                });

        });


        it('should return an existing scratch key', async () => {
            const userid = uuid();

            const project: DbTypes.Project = await store.storeProject(
                userid, TESTCLASS, 'text',
                'dummyproject', 'en', [], false);

            const projectid = project.id;
            const keyId = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/' + userid + '/projects/' + projectid + '/scratchkeys')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body = res.body;

                    assert(Array.isArray(body));
                    assert.strictEqual(body.length, 1);
                    assert(body[0].id);
                    assert.strictEqual(body[0].id, keyId);
                    assert(!body[0].model);

                    await store.deleteScratchKey(keyId);
                    await store.deleteEntireProject(userid, TESTCLASS, project);
                });
        });

        it('should return an existing trained scratch key', async () => {
            const userid = uuid();

            const project: DbTypes.Project = await store.storeProject(
                userid, TESTCLASS, 'text', 'A Fake Project', 'en', [], false);

            const projectid = project.id;
            const classifierid = randomstring.generate({ length : 12 });
            const credstype: Types.BluemixCredentialsTypeLabel = 'unknown';

            const credentials = {
                id : uuid(),
                username : randomstring.generate({ length : 12 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv' as Types.BluemixServiceType,
                url : uuid(),
                classid : TESTCLASS,
                credstype,
            };

            const ts = new Date(2018, 6, 2, 1, 15, 0);

            const keyId = await store.storeScratchKey(project, credentials, classifierid, ts);

            return request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/' + userid + '/projects/' + projectid + '/scratchkeys')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body = res.body;

                    assert(Array.isArray(body));
                    assert.strictEqual(body.length, 1);
                    assert(body[0].id);
                    assert.strictEqual(body[0].id, keyId);
                    assert.strictEqual(body[0].model, classifierid);

                    await store.deleteScratchKey(keyId);
                    await store.deleteEntireProject(userid, TESTCLASS, project);
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
                isCrowdSourced : false,
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

                    const errorPayload = res.error as any;
                    assert.strictEqual(errorPayload.text,
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
                isCrowdSourced : false,
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

                    const errorPayload = res.error as any;
                    assert.strictEqual(errorPayload.text,
                        '/**/ typeof ' + callbackFunctionName +
                        ' === \'function\' && mycb({"error":"Missing data"});');
                });
        });

        it('should check the data type when classifying', async () => {
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
                isCrowdSourced : false,
            };

            const key = await store.storeUntrainedScratchKey(project);

            const callbackFunctionName = 'mycb';
            return request(testServer)
                .get('/api/scratch/' + key + '/classify')
                .query({ callback : callbackFunctionName, data : 'I am not an array of numbers' })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {
                    await store.deleteEntireProject('userid', TESTCLASS, project);

                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                        callbackFunctionName +
                                        ' === \'function\' && ' +
                                        callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));

                    const classificationRespStr: string = text.substring(expectedStart.length, text.length - 2);
                    const payload = JSON.parse(classificationRespStr);
                    assert.deepStrictEqual(payload, { error : 'Missing data' });
                });
        });


        it('should check for existence of projects when creating ML models', async () => {
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
                isCrowdSourced : false,
            };

            const key = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .post('/api/scratch/' + key + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.INTERNAL_SERVER_ERROR)
                .then((res) => {
                    assert.deepStrictEqual(res.body, {
                        error : 'Project not found',
                    });

                    return store.deleteScratchKey(key);
                });
        });

        it('should treat image projects as not implemented yet for creating ML models', async () => {
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
                isCrowdSourced : false,
            };

            const key = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .post('/api/scratch/' + key + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_IMPLEMENTED)
                .then((res) => {
                    assert.deepStrictEqual(res.body, {
                        error : 'Only text or numbers models can be trained using a Scratch key',
                    });

                    return store.deleteScratchKey(key);
                });
        });

        it('should not allow scratch keys to make classify calls for imgtfjs models', async () => {
            const projectid = uuid();

            const project: DbTypes.Project = {
                id : projectid,
                name : 'Test Project',
                userid : 'userid',
                classid : TESTCLASS,
                type : 'imgtfjs',
                language : 'en',
                labels : [],
                numfields : 0,
                isCrowdSourced : false,
            };

            const key = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .post('/api/scratch/' + key + '/classify')
                .send({ data : 'haddock' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, {
                        error : 'Classification for this project is only available in the browser',
                    });

                    return store.deleteScratchKey(key);
                });
        });

        it('should not allow scratch keys to make classify calls for sound models', async () => {
            const projectid = uuid();

            const project: DbTypes.Project = {
                id : projectid,
                name : 'Test Project',
                userid : 'userid',
                classid : TESTCLASS,
                type : 'sounds',
                language : 'en',
                labels : [],
                numfields : 0,
                isCrowdSourced : false,
            };

            const key = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .post('/api/scratch/' + key + '/classify')
                .send({ data : 'haddock' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, {
                        error : 'Sound classification is only available in the browser',
                    });

                    return store.deleteScratchKey(key);
                });
        });

        it('should handle unknown scratch keys by jsonp', async () => {
            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + 'THIS-DOES-NOT-REALLY-EXIST' + '/classify')
                .query({ callback : callbackFunctionName, data : 'haddock' })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.NOT_FOUND)
                .then(async (res) => {
                    const text = res.text;

                    const expectedStart = '/**/ typeof ' +
                                          callbackFunctionName +
                                          ' === \'function\' && ' +
                                          callbackFunctionName + '(';

                    assert(text.startsWith(expectedStart));

                    const classificationRespStr: string = text.substring(expectedStart.length, text.length - 2);
                    const payload: ClassificationResponse[] = JSON.parse(classificationRespStr);

                    assert.deepStrictEqual(payload, { error : 'Scratch key not found' });
                });
        });

        it('should handle unknown scratch keys', async () => {
            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .post('/api/scratch/' + 'THIS-DOES-NOT-REALLY-EXIST' + '/classify')
                .send({ callback : callbackFunctionName, data : 'haddock' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then(async (res) => {
                    assert.deepStrictEqual(res.body, { error : 'Scratch key not found' });
                });
        });



        it('should return random labels for text without a classifier', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [], false);

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

                    assert.strictEqual(payload.length, 3);
                    payload.forEach((item) => {
                        assert.strictEqual(item.confidence, 33);
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
            ], false);

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

                    assert.strictEqual(payload.length, 3);
                    payload.forEach((item) => {
                        assert.strictEqual(item.confidence, 33);
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
            ], false);

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

                    const errorPayload = res.error as any;
                    assert.strictEqual(errorPayload.text,
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
                isCrowdSourced : false,
            };
            const keyId = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .get('/api/scratch/' + keyId + '/status')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    assert.deepStrictEqual(res.body, {
                        msg : 'No models trained yet - only random answers can be chosen',
                        status : 0,
                        type : 'text',
                    });

                    return store.deleteScratchKey(keyId);
                });
        });


        it('should handle Scratchx extension requests for unknown Scratch keys', async () => {
            return request(testServer)
                .get('/api/scratch/' + 'THIS-DOES-NOT-EXIST' + '/extension.js')
                .expect(httpstatus.NOT_FOUND)
                .then(async (res) => {
                    const body: string = res.body;
                    assert.deepStrictEqual(body, { error : 'Scratch key not found' });
                });
        });


        it('should handle Scratch 3 extension requests for unknown Scratch keys', async () => {
            return request(testServer)
                .get('/api/scratch/' + 'THIS-DOES-NOT-EXIST' + '/extension3.js')
                .expect(httpstatus.NOT_FOUND)
                .then(async (res) => {
                    const body: string = res.body;
                    assert.deepStrictEqual(body, { error : 'Scratch key not found' });
                });
        });


        it('should build a working Scratchx extension', async () => {
            const userid = uuid();

            const project = await store.storeProject(userid, TESTCLASS, 'text', 'dummyproject', 'en', [], false);
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


        it('should build a working Scratch 3 extension', async () => {
            const userid = uuid();

            const project = await store.storeProject(userid, TESTCLASS, 'text', 'dummyproject', 'en', [], false);
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'LABEL NUMBER ONE');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'SECOND LABEL');

            const keyId = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .get('/api/scratch/' + keyId + '/extension3.js')
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body: string = res.text;

                    assert(body.startsWith('class MachineLearningText {'));
                    assert(body.indexOf('text: \' LABEL_NUMBER_ONE\'') > 0);
                    assert(body.indexOf('text: \' SECOND_LABEL\'') > 0);
                    assert(body.indexOf('// the name of the student project') < body.indexOf('name: \'dummyproject\''));
                    assert(body.indexOf('name: \'dummyproject\'') < body.indexOf('colour for the blocks'));
                    assert(body.endsWith('Scratch.extensions.register(new MachineLearningText());\n'));

                    await store.deleteEntireProject(userid, TESTCLASS, project);
                });
        });



        it('should require data to store text using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [], false);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .post('/api/scratch/' + keyId + '/train')
                .send({ data : '', label : 'animal' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {
                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    assert.deepStrictEqual(res.body, { error : 'Missing data' });
                });
        });


        it('should handle unknown Scratch keys when storing text using a Scratch key', async () => {
            return request(testServer)
                .post('/api/scratch/' + 'THIS-ALSO-DOES-NOT-EXIST' + '/train')
                .send({ data : 'Data To Store', label : 'label' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then(async (res) => {
                    assert.deepStrictEqual(res.body, { error : 'Scratch key not found' });
                });
        });


        it('should require a valid label to store text using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [], false);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .post('/api/scratch/' + keyId + '/train')
                .send({ data : 'Data To Store', label : 'not_an_animal' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {

                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    assert.deepStrictEqual(res.body, { error : 'Invalid label' });
                });
        });


        it('should enforce limits when storing training data using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [], false);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            await store.storeTextTraining(project.id, uuid(), 'label');
            await store.storeTextTraining(project.id, uuid(), 'label');

            const limitsStub = sinon.stub(limits, 'getStoreLimits');
            limitsStub.returns({
                textTrainingItemsPerProject : 2,
                numberTrainingItemsPerProject : 2,
                numberTrainingItemsPerClassProject : 2,
                imageTrainingItemsPerProject : 100,
                soundTrainingItemsPerProject : 100,
            });

            const keyId = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .post('/api/scratch/' + keyId + '/train')
                .send({ data : 'inserted', label : 'animal' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CONFLICT)
                .then(async (res) => {

                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    assert.deepStrictEqual(res.body, {
                        error: 'Project already has maximum allowed amount of training data',
                    });

                    limitsStub.restore();
                });
        });


        it('should store text training data using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [], false);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .post('/api/scratch/' + keyId + '/train')
                .send({ data : 'inserted', label : 'animal' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {

                    const count = await store.countTraining('text', project.id);
                    assert.strictEqual(count, 1);

                    const retrieved = await store.getTextTraining(project.id, { start : 0, limit : 10 });
                    assert.strictEqual(retrieved[0].textdata, 'inserted');
                    assert.strictEqual(retrieved[0].label, 'animal');

                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    const payload = res.body;
                    assert(payload.id);
                    assert.strictEqual(payload.textdata, 'inserted');
                    assert.strictEqual(payload.label, 'animal');
                    assert.strictEqual(payload.projectid, project.id);
                });
        });



        it('should store numeric training data using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'numbers';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [
                { name : 'left', type : 'number' }, { name : 'right', type : 'number' },
                { name : 'another', type : 'multichoice', choices : [ 'bing', 'bong', 'bang' ] },
            ], false);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'TOP');

            const keyId = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .post('/api/scratch/' + keyId + '/train')
                .send({ data : ['1', '2.2', 'bong' ], label : 'TOP' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {

                    const count = await store.countTraining('numbers', project.id);
                    assert.strictEqual(count, 1);

                    const retrieved = await store.getNumberTraining(project.id, { start : 0, limit : 10 });
                    assert.deepStrictEqual(retrieved[0].numberdata, [1, 2.2, 1]);
                    assert.strictEqual(retrieved[0].label, 'TOP');

                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    const payload = res.body;

                    assert(payload.id);
                    assert.deepStrictEqual(payload.numberdata, [1, 2.2, 1]);
                    assert.strictEqual(payload.label, 'TOP');
                    assert.strictEqual(payload.projectid, project.id);
                });
        });


        it('should require data to store numbers using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'numbers';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [
                { name : 'a', type : 'number' },
            ], false);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .post('/api/scratch/' + keyId + '/train')
                .send({ data : [], label : 'animal' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {

                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    assert.deepStrictEqual(res.body, { error : 'Missing data' });
                });
        });


        it('should require numeric data to store numbers using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'numbers';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [
                { name : 'a', type : 'number' },
            ], false);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .post('/api/scratch/' + keyId + '/train')
                .send({ data : ['This is not a number'], label : 'animal' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {
                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    assert.deepStrictEqual(res.body, { error : 'Invalid data' });
                });
        });



        it('should require a valid choice when storing multi-choice fields using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'numbers';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [
                { name : 'a', type : 'number' },
                { name : 'b', type : 'multichoice', choices : [ 'valid', 'good', 'okay' ] },
            ], false);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .post('/api/scratch/' + keyId + '/train')
                .send({ data : [123, 'invalid'], label : 'animal' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {
                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    assert.deepStrictEqual(res.body, { error : 'Invalid data' });
                });
        });



        it('should require some numeric data to store numbers using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'numbers';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [
                { name : 'a', type : 'number' },
            ], false);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .post('/api/scratch/' + keyId + '/train')
                .send({ data : [], label : 'animal' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {

                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    assert.deepStrictEqual(res.body, { error : 'Missing data' });
                });
        });



        it('should require the right amount of data to store numbers using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'numbers';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [
                { name : 'a', type : 'number' }, { name : 'b', type : 'number' },
                { name : 'c', type : 'number' },
            ], false);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .post('/api/scratch/' + keyId + '/train')
                .send({
                    data : ['123', '45'],
                    label : 'animal',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {
                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    assert.deepStrictEqual(res.body, { error : 'Missing data' });
                });
        });



        it('should reject missing numbers when storing numbers using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'numbers';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [
                { name : 'a', type : 'number' }, { name : 'b', type : 'number' },
                { name : 'c', type : 'number' },
            ], false);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .post('/api/scratch/' + keyId + '/train')
                .send({
                    data : ['123', '45', 'x'],
                    label : 'animal',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {
                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    assert.deepStrictEqual(res.body, { error : 'Invalid data' });
                });
        });



        it('should require a valid label to store numbers using a Scratch key', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'numbers';

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [
                { name : 'a', type : 'number' }, { name : 'b', type : 'number' },
            ], false);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');

            const keyId = await store.storeUntrainedScratchKey(project);

            return request(testServer)
                .post('/api/scratch/' + keyId + '/train')
                .send({
                    data : ['123', '45'],
                    label : 'NOT_VALID',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then(async (res) => {
                    await store.deleteEntireProject(userid, TESTCLASS, project);

                    assert.deepStrictEqual(res.body, { error : 'Invalid label' });
                });
        });


        function mockClassifier(url: string, options?: coreReq.CoreOptions): requestPromise.RequestPromise {
            // TODO this is ridiculous... do I really have to fight with TypeScript like this?
            const unk: unknown = options as unknown;
            const opts: conversation.LegacyTestRequest = unk as conversation.LegacyTestRequest;

            const prom: unknown = new Promise((resolve) => {
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

            return prom as requestPromise.RequestPromise;
        }

        function brokenClassifier(/*url: string, options?: coreReq.CoreOptions*/): requestPromise.RequestPromise {
            const prom: unknown = new Promise((resolve, reject) => {
                reject({ error : {
                    code : 500,
                    error : 'Something bad happened',
                    description : 'It really was very bad',
                }});
            });
            return prom as requestPromise.RequestPromise;
        }



        it('should return classes from a classifier', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const credentials = {
                id : uuid(),
                username : randomstring.generate({ length : 36 }),
                password : randomstring.generate({ length : 12 }),
                servicetype : 'conv' as Types.BluemixServiceType,
                url : uuid(),
                classid : TESTCLASS,
                credstypeid : 0,
            };

            const workspaceId = randomstring.generate({ length : 32 });

            const ts = new Date(2018, 3, 2, 1, 12, 0);

            const conversationWorkspace: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : workspaceId,
                credentialsid : credentials.id,
                url : uuid(),
                name,
                language : 'en',
                created : ts,
                expiry : new Date(),
            };

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [], false);
            const storedCredentials = await store.storeBluemixCredentials(TESTCLASS, credentials);
            await store.storeConversationWorkspace(storedCredentials, project, conversationWorkspace);

            const scratchKey = await store.storeOrUpdateScratchKey(
                project, storedCredentials,
                conversationWorkspace.workspace_id, conversationWorkspace.created);

            // @ts-ignore
            const conversationStub = sinon.stub(requestPromise, 'post').callsFake(mockClassifier);

            conversationStub.resetHistory();
            assert(conversationStub.notCalled);

            await request(testServer)
                .get('/api/scratch/' + scratchKey + '/classify')
                .query({ callback : 'cb', data : 'haddock' })
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.OK);

            assert(conversationStub.calledOnce);

            conversationStub.resetHistory();
            assert(conversationStub.notCalled);

            await request(testServer)
                .get('/api/scratch/' + scratchKey + '/classify')
                .set('If-Modified-Since', ts.toISOString())
                .query({ callback : 'cb', data : 'haddock' })
                .expect(httpstatus.NOT_MODIFIED);

            assert(conversationStub.notCalled);

            await store.deleteEntireProject(userid, TESTCLASS, project);
            await store.deleteBluemixCredentials(credentials.id);

            conversationStub.restore();
        });



        it('should return classes from a classifier', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const credentials = {
                id : uuid(),
                username : randomstring.generate({ length : 36 }),
                password : randomstring.generate({ length : 12 }),
                servicetype : 'conv' as Types.BluemixServiceType,
                url : uuid(),
                classid : TESTCLASS,
                credstypeid : 0,
            };

            const workspaceId = randomstring.generate({ length : 32 });

            const ts = new Date(2018, 3, 2, 1, 12, 0);

            const conversationWorkspace: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : workspaceId,
                credentialsid : credentials.id,
                url : uuid(),
                name,
                language : 'en',
                created : ts,
                expiry : new Date(),
            };

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [], false);
            const storedCredentials = await store.storeBluemixCredentials(TESTCLASS, credentials);
            await store.storeConversationWorkspace(storedCredentials, project, conversationWorkspace);

            const scratchKey = await store.storeOrUpdateScratchKey(
                project, storedCredentials,
                conversationWorkspace.workspace_id, conversationWorkspace.created);

            // @ts-ignore
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

                    assert.deepStrictEqual(payload, [
                        { class_name: 'temperature', confidence: 64, classifierTimestamp : ts.toISOString() },
                        { class_name: 'conditions', confidence: 36, classifierTimestamp : ts.toISOString() },
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
                    assert.deepStrictEqual(payload, { error : 'Missing data' });
                });
        });


        it('should support POST for returning classes from a classifier', async () => {
            const userid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const credentials = {
                id : uuid(),
                username : randomstring.generate({ length : 36 }),
                password : randomstring.generate({ length : 12 }),
                servicetype : 'conv' as Types.BluemixServiceType,
                url : uuid(),
                classid : TESTCLASS,
                credstypeid : 0,
            };

            const workspaceId = randomstring.generate({ length : 32 });

            const ts = new Date();
            ts.setMilliseconds(0);

            const conversationWorkspace: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : workspaceId,
                credentialsid : credentials.id,
                url : uuid(),
                name,
                language : 'en',
                created : ts,
                expiry : new Date(),
            };

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [], false);
            const storedCredentials = await store.storeBluemixCredentials(TESTCLASS, credentials);
            await store.storeConversationWorkspace(storedCredentials, project, conversationWorkspace);

            const scratchKey = await store.storeOrUpdateScratchKey(
                project, storedCredentials,
                conversationWorkspace.workspace_id, conversationWorkspace.created);

            // @ts-ignore
            const conversationStub = sinon.stub(requestPromise, 'post').callsFake(mockClassifier);

            return request(testServer)
                .post('/api/scratch/' + scratchKey + '/classify')
                .send({ data : 'haddock' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const payload = res.body;

                    assert.deepStrictEqual(payload, [
                        { class_name: 'temperature', confidence: 64, classifierTimestamp : ts.toISOString() },
                        { class_name: 'conditions', confidence: 36, classifierTimestamp : ts.toISOString() },
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
                username : randomstring.generate({ length : 36 }),
                password : randomstring.generate({ length : 12 }),
                servicetype : 'conv' as Types.BluemixServiceType,
                url : uuid(),
                classid : TESTCLASS,
                credstypeid : 0,
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

            const project = await store.storeProject(userid, TESTCLASS, typelabel, name, 'en', [], false);
            const storedCredentials = await store.storeBluemixCredentials(TESTCLASS, credentials);
            await store.storeConversationWorkspace(storedCredentials, project, workspace);

            const scratchKey = await store.storeOrUpdateScratchKey(
                project, storedCredentials,
                workspace.workspace_id, workspace.created);

            // @ts-ignore
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

                    assert.deepStrictEqual(payload, {
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


    describe('training data', () => {

        it('should verify scratch keys', async () => {
            const userid = uuid();
            const label = 'MYLAB';
            const testProject = await store.storeProject(userid, TESTCLASS, 'text', 'name', 'en', [], false);
            await store.addLabelToProject(userid, TESTCLASS, testProject.id, label);
            const storedText = await store.storeTextTraining(testProject.id, 'test', label);

            await store.storeUntrainedScratchKey(testProject);

            await request(testServer)
                .get('/api/scratch/' + 'NOT-THE-SCRATCH-KEY' +
                     '/images/api' +
                     '/classes/' + TESTCLASS +
                     '/students/' + userid +
                     '/projects/' + testProject.id +
                     '/images/' + storedText.id +
                     '?proxy=true')
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Scratch key not found' });
                });

            await store.deleteEntireProject(userid, TESTCLASS, testProject);
        });

        it('should only allow training downloads for image projects', async () => {
            const userid = uuid();
            const label = 'MYLAB';
            const testProject = await store.storeProject(userid, TESTCLASS, 'text', 'name', 'en', [], false);
            await store.addLabelToProject(userid, TESTCLASS, testProject.id, label);
            const storedText = await store.storeTextTraining(testProject.id, 'test', label);

            const scratchKey = await store.storeUntrainedScratchKey(testProject);

            await request(testServer)
                .get('/api/scratch/' + scratchKey +
                     '/images/api' +
                     '/classes/' + TESTCLASS +
                     '/students/' + userid +
                     '/projects/' + testProject.id +
                     '/images/' + storedText.id +
                     '?proxy=true')
                .expect(httpstatus.FORBIDDEN)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Invalid access' });
                });

            await store.deleteEntireProject(userid, TESTCLASS, testProject);
        });

        it('should only allow training downloads for Vis Rec projects', async () => {
            const userid = uuid();
            const label = 'MYLAB';
            const imgurl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Thomas_J_Watson_Sr.jpg/148px-Thomas_J_Watson_Sr.jpg';
            const testProject = await store.storeProject(userid, TESTCLASS, 'images', 'name', 'en', [], false);
            await store.addLabelToProject(userid, TESTCLASS, testProject.id, label);
            const storedImage = await store.storeImageTraining(testProject.id, imgurl, label, false);

            const scratchKey = await store.storeUntrainedScratchKey(testProject);

            await request(testServer)
                .get('/api/scratch/' + scratchKey +
                     '/images/api' +
                     '/classes/' + TESTCLASS +
                     '/students/' + userid +
                     '/projects/' + testProject.id +
                     '/images/' + storedImage.id +
                     '?proxy=true')
                .expect(httpstatus.FORBIDDEN)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Invalid access' });
                });

            await store.deleteEntireProject(userid, TESTCLASS, testProject);
        });

        it('should retrieve resized images ready for use in training', async () => {
            const userid = uuid();
            const label = 'MYLAB';
            const imgurl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Thomas_J_Watson_Sr.jpg/148px-Thomas_J_Watson_Sr.jpg';
            const testProject = await store.storeProject(userid, TESTCLASS, 'imgtfjs', 'name', 'en', [], false);
            await store.addLabelToProject(userid, TESTCLASS, testProject.id, label);
            const storedImage = await store.storeImageTraining(testProject.id, imgurl, label, false);

            const scratchKey = await store.storeUntrainedScratchKey(testProject);

            const testFileData = await readFile('./src/tests/utils/resources/watson-2.jpg');

            await request(testServer)
                .get('/api/scratch/' + scratchKey +
                     '/images/api' +
                     '/classes/' + TESTCLASS +
                     '/students/' + userid +
                     '/projects/' + testProject.id +
                     '/images/' + storedImage.id +
                     '?proxy=true')
                .expect(httpstatus.OK)
                .then((res) => {
                    const isEq = Buffer.compare(res.body, testFileData);
                    assert.strictEqual(isEq, 0);
                });

            await store.deleteEntireProject(userid, TESTCLASS, testProject);
        });

        it('should require a proxy query parameter to retrieve resized images', async () => {
            const userid = uuid();
            const label = 'MYLAB';
            const imgurl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Thomas_J_Watson_Sr.jpg/148px-Thomas_J_Watson_Sr.jpg';
            const testProject = await store.storeProject(userid, TESTCLASS, 'imgtfjs', 'name', 'en', [], false);
            await store.addLabelToProject(userid, TESTCLASS, testProject.id, label);
            const storedImage = await store.storeImageTraining(testProject.id, imgurl, label, false);

            const scratchKey = await store.storeUntrainedScratchKey(testProject);

            await request(testServer)
                .get('/api/scratch/' + scratchKey +
                     '/images/api' +
                     '/classes/' + TESTCLASS +
                     '/students/' + userid +
                     '/projects/' + testProject.id +
                     '/images/' + storedImage.id)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'File not found' });
                });

            await store.deleteEntireProject(userid, TESTCLASS, testProject);
        });

        it('should retrieve resized stored images ready for use in training', async () => {
            const userid = uuid();
            const objectid = uuid();
            const label = 'MYLAB';
            const testProject = await store.storeProject(userid, TESTCLASS, 'imgtfjs', 'name', 'en', [], false);
            await store.addLabelToProject(userid, TESTCLASS, testProject.id, label);
            const testFileData = await readFile('./src/tests/utils/resources/watson-1.jpg');
            const spec = {
                classid : TESTCLASS,
                projectid : testProject.id,
                objectid, userid,
            };
            await objectstore.storeImage(spec, 'image/jpg', testFileData);

            const storedImage = await store.storeImageTraining(testProject.id, 'imgurl', label, true, objectid);

            const scratchKey = await store.storeUntrainedScratchKey(testProject);

            await request(testServer)
                .get('/api/scratch/' + scratchKey +
                     '/images/api' +
                     '/classes/' + TESTCLASS +
                     '/students/' + userid +
                     '/projects/' + testProject.id +
                     '/images/' + storedImage.id)
                .expect(httpstatus.OK)
                .then((res) => {
                    const isEq = Buffer.compare(res.body, testFileData);
                    assert.strictEqual(isEq, 0);
                });

            await objectstore.deleteObject(spec);
            await store.deleteEntireProject(userid, TESTCLASS, testProject);
        });

        it('should retrieve resized stored images ready for use in training even if proxy is requested', async () => {
            const userid = uuid();
            const objectid = uuid();
            const label = 'MYLAB';
            const testProject = await store.storeProject(userid, TESTCLASS, 'imgtfjs', 'name', 'en', [], false);
            await store.addLabelToProject(userid, TESTCLASS, testProject.id, label);
            const testFileData = await readFile('./src/tests/utils/resources/watson-1.jpg');
            const spec = {
                classid : TESTCLASS,
                projectid : testProject.id,
                objectid, userid,
            };
            await objectstore.storeImage(spec, 'image/jpg', testFileData);

            const storedImage = await store.storeImageTraining(testProject.id, 'imgurl', label, true, objectid);

            const scratchKey = await store.storeUntrainedScratchKey(testProject);

            await request(testServer)
                .get('/api/scratch/' + scratchKey +
                     '/images/api' +
                     '/classes/' + TESTCLASS +
                     '/students/' + userid +
                     '/projects/' + testProject.id +
                     '/images/' + storedImage.id)
                .expect(httpstatus.OK)
                .then((res) => {
                    const isEq = Buffer.compare(res.body, testFileData);
                    assert.strictEqual(isEq, 0);
                });

            await objectstore.deleteObject(spec);
            await store.deleteEntireProject(userid, TESTCLASS, testProject);
        });

        it('handle missing data in object storage', async () => {
            const userid = uuid();
            const objectid = uuid();
            const label = 'MYLAB';
            const testProject = await store.storeProject(userid, TESTCLASS, 'imgtfjs', 'name', 'en', [], false);
            await store.addLabelToProject(userid, TESTCLASS, testProject.id, label);
            const testFileData = await readFile('./src/tests/utils/resources/watson-1.jpg');
            const spec = {
                classid : TESTCLASS,
                projectid : testProject.id,
                objectid, userid,
            };
            await objectstore.storeImage(spec, 'image/jpg', testFileData);

            const storedImage = await store.storeImageTraining(testProject.id, 'imgurl', label, true, objectid);

            const scratchKey = await store.storeUntrainedScratchKey(testProject);

            await objectstore.deleteObject(spec);

            await request(testServer)
                .get('/api/scratch/' + scratchKey +
                     '/images/api' +
                     '/classes/' + TESTCLASS +
                     '/students/' + userid +
                     '/projects/' + testProject.id +
                     '/images/' + storedImage.id)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'File not found' });
                });

            await store.deleteEntireProject(userid, TESTCLASS, testProject);
        });

        it('should retrieve resized images ready for use in training', async () => {
            const userid = uuid();
            const label = 'MYLAB';
            const imgurl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Thomas_J_Watson_Sr.jpg/148px-Thomas_J_Watson_Sr.jpg';
            const testProject = await store.storeProject(userid, TESTCLASS, 'imgtfjs', 'name', 'en', [], false);
            await store.addLabelToProject(userid, TESTCLASS, testProject.id, label);
            const storedImage = await store.storeImageTraining(testProject.id, imgurl, label, false);

            const scratchKey = await store.storeUntrainedScratchKey(testProject);

            const testFileData = await readFile('./src/tests/utils/resources/watson-2.jpg');

            await request(testServer)
                .get('/api/scratch/' + scratchKey +
                     '/images/api' +
                     '/classes/' + TESTCLASS +
                     '/students/' + userid +
                     '/projects/' + testProject.id +
                     '/images/' + storedImage.id +
                     '?proxy=true')
                .expect(httpstatus.OK)
                .then((res) => {
                    const isEq = Buffer.compare(res.body, testFileData);
                    assert.strictEqual(isEq, 0);
                });

            await store.deleteEntireProject(userid, TESTCLASS, testProject);
        });

        it('should retrieve training for text projects', async () => {
            const userid = uuid();
            const name = uuid();

            const testProject = await store.storeProject(userid, TESTCLASS, 'text', name, 'en', [], false);

            const scratchKey = await store.storeUntrainedScratchKey(testProject);
            await store.addLabelToProject(userid, TESTCLASS, testProject.id, 'one');
            await store.addLabelToProject(userid, TESTCLASS, testProject.id, 'two');
            const itemOne = await store.storeTextTraining(testProject.id, 'Hello', 'one');
            const itemTwo = await store.storeTextTraining(testProject.id, 'World', 'two');

            await request(testServer)
                .get('/api/scratch/' + scratchKey + '/train')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, [
                        { id : itemOne.id, label : 'one', textdata : 'Hello' },
                        { id : itemTwo.id, label : 'two', textdata : 'World' },
                    ]);
                });

            await store.deleteEntireProject(userid, TESTCLASS, testProject);
        });

        it('should not work for VR image projects', async () => {
            const userid = uuid();
            const name = uuid();

            const testProject = await store.storeProject(userid, TESTCLASS, 'images', name, 'en', [], false);

            const scratchKey = await store.storeUntrainedScratchKey(testProject);

            await request(testServer)
                .get('/api/scratch/' + scratchKey + '/train')
                .expect('Content-Type', /json/)
                .expect(httpstatus.METHOD_NOT_ALLOWED)
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, { error : 'Method not allowed' });
                });

            await store.deleteEntireProject(userid, TESTCLASS, testProject);
        });


        it('should retrieve empty training lists', async () => {
            const userid = uuid();
            const name = uuid();

            const testProject = await store.storeProject(userid, TESTCLASS, 'imgtfjs', name, 'en', [], false);

            const scratchKey = await store.storeUntrainedScratchKey(testProject);

            await request(testServer)
                .get('/api/scratch/' + scratchKey + '/train')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, []);
                });

            await store.deleteEntireProject(userid, TESTCLASS, testProject);
        });

        it('should retrieve image training lists', async () => {
            const userid = uuid();
            const name = uuid();

            const testProject = await store.storeProject(userid, TESTCLASS, 'imgtfjs', name, 'en', [], false);
            await store.addLabelToProject(userid, TESTCLASS, testProject.id, 'test');
            const urls = [
                'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/IBM_logo.svg/320px-IBM_logo.svg.png',
                'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Thomas_J_Watson_Sr.jpg/148px-Thomas_J_Watson_Sr.jpg',
                'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Old_Map_Hursley_1607.jpg/218px-Old_Map_Hursley_1607.jpg?download',
            ];
            await Promise.all(urls.map((url) => {
                return store.storeImageTraining(testProject.id, url, 'test', false);
            }));
            await store.storeImageTraining(testProject.id, 'somethinginternal', 'test', true, uuid());

            const scratchKey = await store.storeUntrainedScratchKey(testProject);

            await request(testServer)
                .get('/api/scratch/' + scratchKey + '/train')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert(Array.isArray(body));
                    assert.strictEqual(body.length, 4);
                    assert(body.every((item) => {
                        return Object.keys(item).length === 3 &&
                               item.id && item.imageurl &&
                               item.label === 'test';
                    }));
                    for (const url of urls) {
                        assert.strictEqual(body.filter((item) => { return item.imageurl === url; }).length, 1);
                    }
                });

            await store.deleteEntireProject(userid, TESTCLASS, testProject);
        });

        it('should retrieve image training lists with proxied URLs', async () => {
            const userid = uuid();
            const name = uuid();

            const testProject = await store.storeProject(userid, TESTCLASS, 'imgtfjs', name, 'en', [], false);
            await store.addLabelToProject(userid, TESTCLASS, testProject.id, 'test');
            const urls = [
                'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/IBM_logo.svg/320px-IBM_logo.svg.png',
                'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Thomas_J_Watson_Sr.jpg/148px-Thomas_J_Watson_Sr.jpg',
                'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Old_Map_Hursley_1607.jpg/218px-Old_Map_Hursley_1607.jpg?download',
            ];
            await Promise.all(urls.map((url) => {
                return store.storeImageTraining(testProject.id, url, 'test', false);
            }));
            await store.storeImageTraining(testProject.id, 'somethinginternal', 'test', true, uuid());

            const scratchKey = await store.storeUntrainedScratchKey(testProject);

            await request(testServer)
                .get('/api/scratch/' + scratchKey + '/train?proxy=true')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert(Array.isArray(body));
                    assert.strictEqual(body.length, 4);
                    assert.strictEqual(body.filter((item) => {
                        return item.imageurl.includes('/api/scratch/' + scratchKey +
                            '/images/api/classes/classid' +
                            '/students/userid' +
                            '/projects/' + testProject.id +
                            '/images/' + item.id +
                            '?proxy=true');
                    }).length, 3);
                });

            await store.deleteEntireProject(userid, TESTCLASS, testProject);
        });


        it('should handle requests for training data with invalid scratch keys', () => {
            return request(testServer)
                .get('/api/scratch/' + uuid() + '/train')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Scratch key not found' });
                });
        });
    });
});
