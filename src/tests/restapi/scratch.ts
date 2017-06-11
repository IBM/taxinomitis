/*eslint-env mocha */
import * as uuid from 'uuid/v1';
import * as assert from 'assert';
import * as request from 'supertest-as-promised';
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
            const classid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const project = await store.storeProject(userid, classid, typelabel, name);

            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + project.id + '/scratchkeys')
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
            const classid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const credentials = {
                id : uuid(),
                username : randomstring.generate({ length : 12 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'nlc' as Types.BluemixServiceType,
                url : uuid(),
            };

            const nlcClassifier = {
                classifierid : randomstring.generate({ length : 12 }),
                url : uuid(),
                name,
                language : 'en',
                created : new Date(),
            };

            const project = await store.storeProject(userid, classid, typelabel, name);
            await store.storeBluemixCredentials(classid, credentials);
            await store.storeNLCClassifier(credentials, userid, classid, project.id, nlcClassifier);

            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + project.id + '/scratchkeys')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body = res.body;
                    assert(util.isArray(body));
                    assert.equal(body.length, 1);
                    assert(body[0].id);
                    assert.equal(body[0].id.length, 72);
                    assert.equal(body[0].model, nlcClassifier.classifierid);

                    await store.deleteProject(project.id);
                    await store.deleteScratchKey(body[0].id);
                    await store.deleteBluemixCredentials(credentials.id);
                    await store.deleteNLCClassifier(project.id, userid, classid, nlcClassifier.classifierid);
                });

        });


        it('should return an existing scratch key', async () => {
            const projectid = uuid();
            const userid = uuid();
            const classid = uuid();

            const keyId = await store.storeUntrainedScratchKey(projectid, 'dummyproject', 'text', userid, classid);

            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/scratchkeys')
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
            const classid = uuid();

            const classifierid = randomstring.generate({ length : 12 });

            const credentials = {
                id : uuid(),
                username : randomstring.generate({ length : 12 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'nlc' as Types.BluemixServiceType,
                url : uuid(),
            };

            const keyId = await store.storeScratchKey(projectid, 'A Fake Project', 'text',
                                                      userid, classid, credentials,
                                                      classifierid);

            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/scratchkeys')
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

        it('should require something to classify', () => {
            const callbackFunctionName = 'mycb';
            return request(testServer)
                .get('/api/scratch/' + uuid() + '/classify?callback=' + callbackFunctionName)
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.equal(res.error.text,
                        '/**/ typeof ' + callbackFunctionName + ' === \'function\' && mycb({"error":"Missing data"});');
                });
        });


        it('should return random labels for keys without a classifier', async () => {
            const userid = uuid();
            const classid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const project = await store.storeProject(userid, classid, typelabel, name);

            await store.addLabelToProject(userid, classid, project.id, 'animal');
            await store.addLabelToProject(userid, classid, project.id, 'vegetable');
            await store.addLabelToProject(userid, classid, project.id, 'mineral');

            const keyId = await store.storeUntrainedScratchKey(project.id, name, 'text', userid, classid);

            const callbackFunctionName = 'jsonpCallback';

            return request(testServer)
                .get('/api/scratch/' + keyId + '/classify?callback=' + callbackFunctionName + '&text=haddock')
                // this is a JSONP API
                .expect('Content-Type', /javascript/)
                .expect(httpstatus.OK)
                .then((res) => {
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
                        assert(['animal', 'vegetable', 'mineral'].indexOf(item.class_name) >= 0);
                    });
                });
        });


        function mockClassifier(url, opts) {
            return new Promise((resolve) => {
                resolve({
                    classifier_id : 'good',
                    url : 'http://nlc.service/v1/classifiers/good/classify',
                    text : opts.body.text,
                    top_class : 'temperature',
                    classes : [
                        {
                            class_name : 'temperature',
                            confidence : 0.638,
                        },
                        {
                            class_name : 'conditions',
                            confidence : 0.362,
                        },
                    ],
                });
            });
        }


        it('should return classes from a classifier', async () => {
            const userid = uuid();
            const classid = uuid();
            const name = uuid();
            const typelabel = 'text';

            const credentials = {
                id : uuid(),
                username : randomstring.generate({ length : 12 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'nlc' as Types.BluemixServiceType,
                url : uuid(),
            };

            const classifierid = randomstring.generate({ length : 12 });

            const nlcClassifier = {
                classifierid,
                url : uuid(),
                name,
                language : 'en',
                created : new Date(),
            };

            const project = await store.storeProject(userid, classid, typelabel, name);
            await store.storeBluemixCredentials(classid, credentials);
            await store.storeNLCClassifier(credentials, userid, classid, project.id, nlcClassifier);

            const scratchKey = await store.storeOrUpdateScratchKey(
                project.id, 'text',
                userid, classid,
                credentials, classifierid);

            const nlcStub = sinon.stub(requestPromise, 'post').callsFake(mockClassifier);

            const callbackFunctionName = 'cb';

            return request(testServer)
                .get('/api/scratch/' + scratchKey + '/classify?callback=' + callbackFunctionName + '&text=haddock')
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
                    await store.deleteNLCClassifier(project.id, userid, classid, nlcClassifier.classifierid);

                    nlcStub.restore();
                });
        });


        // it('should return status for the ScratchX extension', async () => {
        //     const projectid = uuid();
        //     const userid = uuid();
        //     const classid = uuid();

        //     const keyId = await store.storeUntrainedScratchKey(projectid, 'dummyproject', 'text', userid, classid);

        //     return request(testServer)
        //         .get('/api/scratch/' + keyId + '/status')
        //         .expect('Content-Type', /json/)
        //         .expect(httpstatus.OK)
        //         .then(async (res) => {
        //             assert.deepEqual(res.body, { status : 2, msg : 'Ready' });

        //             await store.deleteScratchKey(keyId);
        //         });
        // });


        it('should build a working Scratchx extension', async () => {
            const projectid = uuid();
            const userid = uuid();
            const classid = uuid();

            const keyId = await store.storeUntrainedScratchKey(projectid, 'dummyproject', 'text', userid, classid);

            return request(testServer)
                .get('/api/scratch/' + keyId + '/extension.js')
                .expect(httpstatus.OK)
                .then(async (res) => {
                    const body: string = res.text;

                    assert(body.startsWith('(function(ext) {'));
                    assert(body.indexOf('/api/scratch/' + keyId + '/status') > 0);
                    assert(body.indexOf('/api/scratch/' + keyId + '/classify') > 0);

                    await store.deleteScratchKey(keyId);
                });
        });

    });




});
