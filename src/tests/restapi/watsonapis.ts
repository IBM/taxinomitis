/*eslint-env mocha */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as randomstring from 'randomstring';
import * as express from 'express';

import * as conversation from '../../lib/training/conversation';
import * as visualrecognition from '../../lib/training/visualrecognition';
import * as TrainingTypes from '../../lib/training/training-types';
import * as ProjectTypes from '../../lib/db/projects';
import * as store from '../../lib/db/store';
import * as Types from '../../lib/db/db-types';
import * as auth from '../../lib/restapi/auth';
import testapiserver from './testserver';

let testServer: express.Express;


describe('REST API - Bluemix credentials', () => {

    let authStub: sinon.SinonStub<any, any>;
    let checkUserStub: sinon.SinonStub<any, any>;
    let requireSupervisorStub: sinon.SinonStub<any, any>;
    // let ensureUnmanagedStub;
    let getClassStub: sinon.SinonStub<[string], Promise<Types.ClassTenant>>;
    let getTextClassifiersStub: sinon.SinonStub<[string, string], Promise<string>>;
    let getImageClassifiersStub: sinon.SinonStub<[TrainingTypes.BluemixCredentials],
                                                 Promise<string>>;

    function authNoOp(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
    )
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

        getClassStub = sinon.stub(store, 'getClassTenant').callsFake((id: string): Promise<Types.ClassTenant> => {
            if (id === 'TESTTENANT' || id === 'DIFFERENT') {
                const placeholder: Types.ClassTenant = {
                    isManaged : false,
                } as Types.ClassTenant;
                return Promise.resolve(placeholder);
            }
            else {
                const placeholder: Types.ClassTenant = {
                    isManaged : true,
                } as Types.ClassTenant;
                return Promise.resolve(placeholder);
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
            .stub(visualrecognition, 'identifyRegion')
            .callsFake((creds: TrainingTypes.BluemixCredentials) => {
                if (creds.username + creds.password === VALID_APIKEY) {
                    return Promise.resolve(creds.url);
                }
                return Promise.reject({
                    statusCode : 403,
                });
            });

        await store.init();
        await store.deleteClassResources('TESTTENANT');

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
                    credstype : 'conv_lite',
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



    describe('modifyCredentials', () => {
        it('should make sure that credentials type match the service type', () => {
            const before = ProjectTypes.credsTypesByLabel.conv_lite.label;
            const after = ProjectTypes.credsTypesByLabel.visrec_standard.label;

            const servicetype = 'conv';
            const classid = 'TESTTENANT';

            let credsid: string;

            return request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype,
                    username : VALID_USERNAME,
                    password : VALID_PASSWORD,
                    credstype : before,
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    credsid = body.id;

                    assert.strictEqual(body.username, VALID_USERNAME);
                    assert.strictEqual(body.password, VALID_PASSWORD);
                    assert.strictEqual(body.credstype, before);

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
                    assert.strictEqual(body[0].credstype, before);

                    return request(testServer)
                        .patch('/api/classes/' + classid + '/credentials/' + credsid)
                        .send([{
                            op : 'replace',
                            path : '/credstype',
                            value : {
                                servicetype : 'visrec',
                                credstype : after,
                            },
                        }])
                        .expect(httpstatus.NOT_FOUND);
                })
                .then(() => {
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
                    assert.strictEqual(body[0].credstype, before);

                    return request(testServer)
                        .delete('/api/classes/' + classid + '/credentials/' + credsid)
                        .expect(httpstatus.NO_CONTENT);
                });
        });


        it('should modify the type of conv credentials', () => {
            const before = ProjectTypes.credsTypesByLabel.conv_lite.label;
            const after = ProjectTypes.credsTypesByLabel.conv_standard.label;

            const servicetype = 'conv';
            const classid = 'TESTTENANT';

            let credsid: string;

            return request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype,
                    username : VALID_USERNAME,
                    password : VALID_PASSWORD,
                    credstype : before,
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    credsid = body.id;

                    assert.strictEqual(body.username, VALID_USERNAME);
                    assert.strictEqual(body.password, VALID_PASSWORD);
                    assert.strictEqual(body.credstype, before);

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
                    assert.strictEqual(body[0].credstype, before);

                    return request(testServer)
                        .patch('/api/classes/' + classid + '/credentials/' + credsid)
                        .send([{
                            op : 'replace',
                            path : '/credstype',
                            value : {
                                servicetype,
                                credstype : after,
                            },
                        }])
                        .expect(httpstatus.NO_CONTENT);
                })
                .then(() => {
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
                    assert.strictEqual(body[0].credstype, after);

                    return request(testServer)
                        .delete('/api/classes/' + classid + '/credentials/' + credsid)
                        .expect(httpstatus.NO_CONTENT);
                });
        });


        it('should modify the type of visrec credentials', () => {
            const before = ProjectTypes.credsTypesByLabel.visrec_standard.label;
            const after = ProjectTypes.credsTypesByLabel.visrec_lite.label;

            const servicetype = 'visrec';
            const classid = 'TESTTENANT';

            let credsid: string;

            return request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype,
                    apikey : VALID_APIKEY,
                    credstype : before,
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    credsid = body.id;

                    assert.strictEqual(body.apikey, VALID_APIKEY);
                    assert.strictEqual(body.credstype, before);

                    return request(testServer)
                        .get('/api/classes/' + classid + '/credentials?servicetype=visrec')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then(async (res) => {
                    const body = res.body;
                    assert.strictEqual(body.length, 1);

                    assert.strictEqual(body[0].id, credsid);
                    assert.strictEqual(body[0].apikey, VALID_APIKEY);
                    assert.strictEqual(body[0].credstype, before);

                    return request(testServer)
                        .patch('/api/classes/' + classid + '/credentials/' + credsid)
                        .send([{
                            op : 'replace',
                            path : '/credstype',
                            value : {
                                servicetype,
                                credstype : after,
                            },
                        }])
                        .expect(httpstatus.NO_CONTENT);
                })
                .then(() => {
                    return request(testServer)
                        .get('/api/classes/' + classid + '/credentials?servicetype=visrec')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then(async (res) => {
                    const body = res.body;
                    assert.strictEqual(body.length, 1);

                    assert.strictEqual(body[0].id, credsid);
                    assert.strictEqual(body[0].apikey, VALID_APIKEY);
                    assert.strictEqual(body[0].credstype, after);

                    return request(testServer)
                        .delete('/api/classes/' + classid + '/credentials/' + credsid)
                        .expect(httpstatus.NO_CONTENT);
                });
        });



        it('should reject invalid patch requests', async () => {
            const tests = [
                {
                    input : { hello : 'world' },
                    output : 'PATCH body should be an array',
                },
                {
                    input : [ { hello : 'world' }, { again : 'world' } ],
                    output : 'Only individual PATCH requests are supported',
                },
                {
                    input : [{ op : 'replace', path : '/servicetype',
                        value : { servicetype : 'conv', credstype : 'conv_lite' } }],
                    output : 'Only modifications to credentials type are supported',
                },
                {
                    input : [{ path : '/credstype',
                        value : { servicetype : 'conv', credstype : 'conv_standard' } }],
                    output : 'PATCH requests must include an op',
                },
                {
                    input : [{ op : 'invalid', path : '/credstype',
                        value : { servicetype : 'conv', credstype : 'conv_lite' } }],
                    output : 'Invalid PATCH op',
                },
                {
                    input : [{ op : 'replace', path : '/credstype' }],
                    output : 'PATCH requests must include a value',
                },
                {
                    input : [{ op : 'replace', path : '/credstype',
                        value : { servicetype : 'invalid', credstype : 'conv_standard' } }],
                    output : 'PATCH requests must specify the service type and credentials type',
                },
                {
                    input : [{ op : 'replace', path : '/credstype',
                        value : { servicetype : 'conv', credstype : 'invalid' } }],
                    output : 'Unrecognised credentials type',
                },
                {
                    input : [{ op : 'replace', path : '/credstype',
                        value : { servicetype : 'conv', credstype : 'visrec_lite' } }],
                    output : 'Invalid credentials type',
                },
            ];

            for (const test of tests) {
                await request(testServer)
                        .patch('/api/classes/TESTTENANT/credentials/abcdef')
                        .send(test.input)
                        .expect(httpstatus.BAD_REQUEST)
                        .expect('Content-Type', /json/)
                        .then((err) => {
                            assert.strictEqual(err.body.error, test.output);
                        });
            }
        });


        it('should fail to modify non-existent credentials', () => {
            return request(testServer)
                .patch('/api/classes/TESTTENANT/credentials/abcdef')
                .send([{
                    op : 'replace', path : '/credstype',
                    value : { servicetype : 'conv', credstype : 'conv_standard' },
                }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);
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
                    credstype : 'unknown',
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
                    credstype : 'unknown',
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
                    credstype : 'conv_standard',
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
                    credstype : 'conv_lite',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    credsid = body.id;

                    assert.strictEqual(body.username, VALID_USERNAME);
                    assert.strictEqual(body.password, VALID_PASSWORD);
                    assert.strictEqual(body.credstype, 'conv_lite');

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
                    assert.strictEqual(body[0].credstype, 'conv_lite');

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
                    credstype : 'conv_standard',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    credsid = body.id;

                    assert.strictEqual(body.username, VALID_EU_USERNAME);
                    assert.strictEqual(body.password, VALID_EU_PASSWORD);
                    assert.strictEqual(body.credstype, 'conv_standard');

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
                    assert.strictEqual(body[0].credstype, 'conv_standard');

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
                    credstype : 'visrec_lite',
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
