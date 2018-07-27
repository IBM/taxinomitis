/*eslint-env mocha */

import * as util from 'util';
import * as uuid from 'uuid/v1';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as randomstring from 'randomstring';
import * as express from 'express';

import * as conversation from '../../lib/training/conversation';
import * as visualrecognition from '../../lib/training/visualrecognition';
import * as TrainingTypes from '../../lib/training/training-types';
import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import testapiserver from './testserver';

let testServer: express.Express;


describe('REST API - Bluemix credentials', () => {

    let authStub: sinon.SinonStub;
    let checkUserStub: sinon.SinonStub;
    let requireSupervisorStub: sinon.SinonStub;
    // let ensureUnmanagedStub;
    let getClassStub: sinon.SinonStub;
    let getTextClassifiersStub: sinon.SinonStub;
    let getImageClassifiersStub: sinon.SinonStub;

    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        next();
    }


    const VALID_USERNAME = randomstring.generate({ length : 36 });
    const VALID_PASSWORD = randomstring.generate({ length : 12 });
    const VALID_EU_USERNAME = randomstring.generate({ length : 36 });
    const VALID_EU_PASSWORD = randomstring.generate({ length : 12 });
    const VALID_APIKEY = randomstring.generate({ length : 44 });


    before(async () => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
        checkUserStub = sinon.stub(auth, 'checkValidUser').callsFake(authNoOp);
        requireSupervisorStub = sinon.stub(auth, 'requireSupervisor').callsFake(authNoOp);

        getClassStub = sinon.stub(store, 'getClassTenant').callsFake((id) => {
            if (id === 'TESTTENANT' || id === 'DIFFERENT') {
                return Promise.resolve({ isManaged : false });
            }
            else {
                return Promise.resolve({ isManaged : true });
            }
        });

        getTextClassifiersStub = sinon
            .stub(conversation, 'identifyRegion')
            .callsFake((username: string, password: string) => {
                if (username === VALID_USERNAME && password === VALID_PASSWORD) {
                    return Promise.resolve('https://gateway.watsonplatform.net/conversation/api');
                }
                else if (username === VALID_EU_USERNAME && password === VALID_EU_PASSWORD) {
                    return Promise.resolve('https://gateway-fra.watsonplatform.net/assistant/api');
                }
                return Promise.reject({
                    statusCode : 401,
                });
            });
        getImageClassifiersStub = sinon
            .stub(visualrecognition, 'getImageClassifiers')
            .callsFake((creds: TrainingTypes.BluemixCredentials) => {
                if (creds.username + creds.password === VALID_APIKEY) {
                    return Promise.resolve();
                }
                return Promise.reject({
                    statusCode : 403,
                });
            });

        await store.init();

        testServer = testapiserver();
    });

    after(() => {
        authStub.restore();
        checkUserStub.restore();
        requireSupervisorStub.restore();
        getClassStub.restore();
        getTextClassifiersStub.restore();
        getImageClassifiersStub.restore();

        return store.disconnect();
    });



    describe('getCredentials', () => {

        it('should not allow this for managed classes', () => {
            const classid = 'MANAGED';
            return request(testServer)
                .get('/api/classes/' + classid + '/credentials?servicetype=conv')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Access to API keys is forbidden for managed tenants');
                });
        });

        it('should require a service type', () => {
            const classid = 'TESTTENANT';
            return request(testServer)
                .get('/api/classes/' + classid + '/credentials')
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Missing required servicetype parameter');
                });
        });

        it('should require a valid service type', () => {
            const classid = 'TESTTENANT';
            return request(testServer)
                .get('/api/classes/' + classid + '/credentials?servicetype=fish')
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Unrecognised servicetype parameter');
                });
        });

        it('should fetch visrec credentials', () => {
            const classid = 'TESTTENANT';
            return request(testServer)
                .get('/api/classes/' + classid + '/credentials?servicetype=visrec')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, []);
                });
        });

        it('should fetch conv credentials', () => {
            const classid = 'TESTTENANT';
            return request(testServer)
                .get('/api/classes/' + classid + '/credentials?servicetype=conv')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, []);
                });
        });

    });


    describe('deleteCredentials', () => {

        it('should prevent deleting credentials from other tenants', () => {
            const classid = 'TESTTENANT';

            let credsid: string;

            return request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype : 'conv',
                    username : VALID_USERNAME,
                    password : VALID_PASSWORD,
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    credsid = body.id;

                    return request(testServer)
                        .delete('/api/classes/' + 'DIFFERENT' + '/credentials/' + credsid)
                        .expect(httpstatus.NOT_FOUND);
                })
                .then(() => {
                    return request(testServer)
                        .delete('/api/classes/' + classid + '/credentials/' + credsid)
                        .expect(httpstatus.NO_CONTENT);
                });
        });

    });


    describe('createCredentials', () => {

        it('should prevent creating credentials for managed classes', () => {
            const classid = 'MANAGED';
            const username = randomstring.generate({ length : 36 });
            const password = randomstring.generate({ length : 12 });

            return request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype : 'conv',
                    username, password,
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN)
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, { error: 'Access to API keys is forbidden for managed tenants' });
                });
        });

        it('should validate new credentials', () => {
            const classid = 'TESTTENANT';
            const username = randomstring.generate({ length : 20 });
            const password = randomstring.generate({ length : 20 });

            return request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype : 'conv',
                    username, password,
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Invalid credentials');
                });
        });


        it('should test Watson credentials', () => {
            const classid = 'TESTTENANT';
            const username = randomstring.generate({ length : 36 });
            const password = randomstring.generate({ length : 12 });

            return request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype : 'conv',
                    username, password,
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Watson credentials could not be verified');
                });
        });


        it('should create and delete conv credentials using US-South', () => {
            const classid = 'TESTTENANT';

            let credsid: string;

            return request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype : 'conv',
                    username : VALID_USERNAME,
                    password : VALID_PASSWORD,
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    credsid = body.id;

                    assert.strictEqual(body.username, VALID_USERNAME);
                    assert.strictEqual(body.password, VALID_PASSWORD);

                    return request(testServer)
                        .get('/api/classes/' + classid + '/credentials?servicetype=conv')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then(async (res) => {
                    const body = res.body;
                    assert.strictEqual(body.length, 1);

                    assert.strictEqual(body[0].id, credsid);
                    assert.strictEqual(body[0].username, VALID_USERNAME);
                    assert.strictEqual(body[0].password, VALID_PASSWORD);

                    // check that the correct region was identified
                    const verify = await store.getBluemixCredentialsById(credsid);
                    assert.strictEqual(verify.url, 'https://gateway.watsonplatform.net/conversation/api');

                    return request(testServer)
                        .delete('/api/classes/' + classid + '/credentials/' + credsid)
                        .expect(httpstatus.NO_CONTENT);
                })
                .then(() => {
                    return request(testServer)
                        .get('/api/classes/' + classid + '/credentials?servicetype=conv')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, []);
                });
        });


        it('should create and delete conv credentials using EU-FR', () => {
            const classid = 'TESTTENANT';

            let credsid: string;

            return request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype : 'conv',
                    username : VALID_EU_USERNAME,
                    password : VALID_EU_PASSWORD,
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    credsid = body.id;

                    assert.strictEqual(body.username, VALID_EU_USERNAME);
                    assert.strictEqual(body.password, VALID_EU_PASSWORD);

                    return request(testServer)
                        .get('/api/classes/' + classid + '/credentials?servicetype=conv')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then(async (res) => {
                    const body = res.body;
                    assert.strictEqual(body.length, 1);

                    assert.strictEqual(body[0].id, credsid);
                    assert.strictEqual(body[0].username, VALID_EU_USERNAME);
                    assert.strictEqual(body[0].password, VALID_EU_PASSWORD);

                    // check that the correct region was identified
                    const verify = await store.getBluemixCredentialsById(credsid);
                    assert.strictEqual(verify.url, 'https://gateway-fra.watsonplatform.net/assistant/api');

                    return request(testServer)
                        .delete('/api/classes/' + classid + '/credentials/' + credsid)
                        .expect(httpstatus.NO_CONTENT);
                })
                .then(() => {
                    return request(testServer)
                        .get('/api/classes/' + classid + '/credentials?servicetype=conv')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, []);
                });
        });


        it('should create and delete visrec credentials', () => {
            const classid = 'TESTTENANT';

            let credsid: string;

            return request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype : 'visrec',
                    apikey : VALID_APIKEY,
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    credsid = body.id;

                    assert.strictEqual(body.apikey, VALID_APIKEY);

                    return request(testServer)
                        .get('/api/classes/' + classid + '/credentials?servicetype=visrec')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.length, 1);

                    assert.strictEqual(body[0].id, credsid);
                    assert.strictEqual(body[0].apikey, VALID_APIKEY);

                    return request(testServer)
                        .delete('/api/classes/' + classid + '/credentials/' + credsid)
                        .expect(httpstatus.NO_CONTENT);
                })
                .then(() => {
                    return request(testServer)
                        .get('/api/classes/' + classid + '/credentials?servicetype=visrec')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, []);
                });
        });
    });


});
