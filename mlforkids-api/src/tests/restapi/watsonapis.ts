import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';
import * as sinon from 'sinon';
import * as request from 'supertest';
import { status as httpstatus } from 'http-status';
import * as randomstring from 'randomstring';
import * as express from 'express';

import * as conversation from '../../lib/training/conversation';
import * as TrainingTypes from '../../lib/training/training-types';
import * as checker from '../../lib/training/credentialscheck';
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
    let testTxtMultipleCredentialsStub: sinon.SinonStub<[TrainingTypes.BluemixCredentials[]], Promise<boolean>>;

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


    before(async () => {
        checker.init();

        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
        checkUserStub = sinon.stub(auth, 'checkValidUser').callsFake(authNoOp);
        requireSupervisorStub = sinon.stub(auth, 'requireSupervisor').callsFake(authNoOp);

        getClassStub = sinon.stub(store, 'getClassTenant').callsFake((id: string): Promise<Types.ClassTenant> => {
            if (id === 'TESTTENANT' || id.startsWith('DIFFERENT')) {
                const placeholder: Types.ClassTenant = {
                    id, tenantType : Types.ClassTenantType.UnManaged,
                } as Types.ClassTenant;
                return Promise.resolve(placeholder);
            }
            else {
                const placeholder: Types.ClassTenant = {
                    id, tenantType : Types.ClassTenantType.Managed,
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
        testTxtMultipleCredentialsStub = sinon
            .stub(conversation, 'testMultipleCredentials')
            .callsFake((creds: TrainingTypes.BluemixCredentials[]) => {
                if (creds[0].username === VALID_USERNAME && creds[0].password === VALID_PASSWORD) {
                    return Promise.resolve(true);
                }
                return Promise.resolve(false);
            });

        await store.init();
        await store.deleteClassResources('TESTTENANT');

        testServer = testapiserver();
    });

    after(async () => {
        authStub.restore();
        checkUserStub.restore();
        requireSupervisorStub.restore();
        getClassStub.restore();
        getTextClassifiersStub.restore();
        testTxtMultipleCredentialsStub.restore();

        await store.disconnect();
    });



    describe('getCredentials', () => {

        it('should not allow this for managed classes', async () => {
            const classid = 'MANAGED';
            const res = await request(testServer)
                .get('/api/classes/' + classid + '/credentials?servicetype=conv')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);

            assert.strictEqual(res.body.error, 'Access to API keys is forbidden for managed tenants');
        });

        it('should require a service type', async () => {
            const classid = 'TESTTENANT';
            const res = await request(testServer)
                .get('/api/classes/' + classid + '/credentials')
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.strictEqual(res.body.error, 'Missing required servicetype parameter');
        });

        it('should require a valid service type', async () => {
            const classid = 'TESTTENANT';
            const res = await request(testServer)
                .get('/api/classes/' + classid + '/credentials?servicetype=fish')
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.strictEqual(res.body.error, 'Unrecognised servicetype parameter');
        });

        it('should fetch conv credentials', async () => {
            const classid = 'TESTTENANT';
            const res = await request(testServer)
                .get('/api/classes/' + classid + '/credentials?servicetype=conv')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(res.body, []);
        });

    });


    describe('deleteCredentials', () => {

        it('should prevent deleting credentials from other tenants', async () => {
            const classid = 'TESTTENANT';

            const createRes = await request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype : 'conv',
                    username : VALID_USERNAME,
                    password : VALID_PASSWORD,
                    credstype : 'conv_lite',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            const credsid = createRes.body.id;

            await request(testServer)
                .delete('/api/classes/' + 'DIFFERENT' + '/credentials/' + credsid)
                .expect(httpstatus.NOT_FOUND);

            await request(testServer)
                .delete('/api/classes/' + classid + '/credentials/' + credsid)
                .expect(httpstatus.NO_CONTENT);
        });

    });



    describe('modifyCredentials', () => {

        it('should modify the type of conv credentials', async () => {
            const before = ProjectTypes.credsTypesByLabel.conv_lite.label;
            const after = ProjectTypes.credsTypesByLabel.conv_standard.label;

            const servicetype = 'conv';
            const classid = 'TESTTENANT';

            const createRes = await request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype,
                    username : VALID_USERNAME,
                    password : VALID_PASSWORD,
                    credstype : before,
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert(createRes.body.id);
            const credsid = createRes.body.id;

            assert.strictEqual(createRes.body.username, VALID_USERNAME);
            assert.strictEqual(createRes.body.password, VALID_PASSWORD);
            assert.strictEqual(createRes.body.credstype, before);

            const getRes1 = await request(testServer)
                .get('/api/classes/' + classid + '/credentials?servicetype=conv')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes1.body.length, 1);
            assert.strictEqual(getRes1.body[0].id, credsid);
            assert.strictEqual(getRes1.body[0].username, VALID_USERNAME);
            assert.strictEqual(getRes1.body[0].password, VALID_PASSWORD);
            assert.strictEqual(getRes1.body[0].credstype, before);

            await request(testServer)
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

            const getRes2 = await request(testServer)
                .get('/api/classes/' + classid + '/credentials?servicetype=conv')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes2.body.length, 1);
            assert.strictEqual(getRes2.body[0].id, credsid);
            assert.strictEqual(getRes2.body[0].username, VALID_USERNAME);
            assert.strictEqual(getRes2.body[0].password, VALID_PASSWORD);
            assert.strictEqual(getRes2.body[0].credstype, after);

            await request(testServer)
                .delete('/api/classes/' + classid + '/credentials/' + credsid)
                .expect(httpstatus.NO_CONTENT);
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
                    output : 'Invalid credentials type',
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


        it('should fail to modify non-existent credentials', async () => {
            await request(testServer)
                .patch('/api/classes/TESTTENANT/credentials/abcdef')
                .send([{
                    op : 'replace', path : '/credstype',
                    value : { servicetype : 'conv', credstype : 'conv_standard' },
                }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);
        });
    });


    describe('checkAllCredentials', () => {
        const classid = 'DIFFERENT9';

        describe('text credentials', () => {
            const convid = uuid();

            before(async () => {
                await store.storeBluemixCredentials(classid, {
                    id : convid,
                    classid,
                    username : VALID_USERNAME,
                    password : VALID_PASSWORD,
                    servicetype : 'conv',
                    url : 'https://gateway.watsonplatform.net/assistant/api',
                    credstypeid : 0,
                });
            });
            after(async () => {
                await store.deleteBluemixCredentials(convid);
            });

            it('should validate credentials', async () => {
                const res = await request(testServer)
                    .get('/api/classes/' + classid + '/modelsupport/text')
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.OK);

                assert.strictEqual(res.headers['cache-control'], 'max-age=31536000');
                assert.deepStrictEqual(res.body, {
                    code: 'MLCRED-OK',
                    message: 'ok',
                });
            });

            it('should recognize classes without credentials', async () => {
                const res = await request(testServer)
                    .get('/api/classes/DIFFERENTNOCREDS/modelsupport/text')
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.CONFLICT);

                assert.strictEqual(res.headers['cache-control'], 'max-age=60');
                assert.deepStrictEqual(res.body, {
                    code: 'MLCRED-TEXT-NOKEYS',
                    message: 'There are no Watson Assistant credentials in this class',
                });
            });

            it('should use the cache for repeated requests', async () => {
                const res = await request(testServer)
                    .get('/api/classes/' + classid + '/modelsupport/text')
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.OK);

                assert.strictEqual(res.headers['cache-control'], 'max-age=31536000');
                assert.deepStrictEqual(res.body, {
                    code: 'MLCRED-OK',
                    message: 'ok',
                });
            });
        });

    });


    describe('createCredentials', () => {

        it('should prevent creating credentials for managed classes', async () => {
            const classid = 'MANAGED';
            const username = randomstring.generate({ length : 36 });
            const password = randomstring.generate({ length : 12 });

            const res = await request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype : 'conv',
                    username, password,
                    credstype : 'unknown',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);

            assert.deepStrictEqual(res.body, { error: 'Access to API keys is forbidden for managed tenants' });
        });

        it('should validate new credentials', async () => {
            const classid = 'TESTTENANT';
            const username = randomstring.generate({ length : 20 });
            const password = randomstring.generate({ length : 20 });

            const res = await request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype : 'conv',
                    username, password,
                    credstype : 'unknown',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.strictEqual(res.body.error, 'Invalid credentials');
        });


        it('should test Watson credentials', async () => {
            const classid = 'TESTTENANT';
            const username = randomstring.generate({ length : 36 });
            const password = randomstring.generate({ length : 12 });

            const res = await request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype : 'conv',
                    username, password,
                    credstype : 'conv_standard',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.strictEqual(res.body.error, 'Watson credentials could not be verified');
        });


        it('should create and delete conv credentials using US-South', async () => {
            const classid = 'TESTTENANT';

            const createRes = await request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype : 'conv',
                    username : VALID_USERNAME,
                    password : VALID_PASSWORD,
                    credstype : 'conv_lite',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert(createRes.body.id);
            const credsid = createRes.body.id;

            assert.strictEqual(createRes.body.username, VALID_USERNAME);
            assert.strictEqual(createRes.body.password, VALID_PASSWORD);
            assert.strictEqual(createRes.body.credstype, 'conv_lite');

            const getRes1 = await request(testServer)
                .get('/api/classes/' + classid + '/credentials?servicetype=conv')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes1.body.length, 1);
            assert.strictEqual(getRes1.body[0].id, credsid);
            assert.strictEqual(getRes1.body[0].username, VALID_USERNAME);
            assert.strictEqual(getRes1.body[0].password, VALID_PASSWORD);
            assert.strictEqual(getRes1.body[0].credstype, 'conv_lite');

            // check that the correct region was identified
            const verify = await store.getBluemixCredentialsById(Types.ClassTenantType.UnManaged, credsid);
            assert.strictEqual(verify.url, 'https://gateway.watsonplatform.net/conversation/api');

            await request(testServer)
                .delete('/api/classes/' + classid + '/credentials/' + credsid)
                .expect(httpstatus.NO_CONTENT);

            const getRes2 = await request(testServer)
                .get('/api/classes/' + classid + '/credentials?servicetype=conv')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(getRes2.body, []);
        });


        it('should create and delete conv credentials using EU-FR', async () => {
            const classid = 'TESTTENANT';

            const createRes = await request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype : 'conv',
                    username : VALID_EU_USERNAME,
                    password : VALID_EU_PASSWORD,
                    credstype : 'conv_standard',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            assert(createRes.body.id);
            const credsid = createRes.body.id;

            assert.strictEqual(createRes.body.username, VALID_EU_USERNAME);
            assert.strictEqual(createRes.body.password, VALID_EU_PASSWORD);
            assert.strictEqual(createRes.body.credstype, 'conv_standard');

            const getRes1 = await request(testServer)
                .get('/api/classes/' + classid + '/credentials?servicetype=conv')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes1.body.length, 1);
            assert.strictEqual(getRes1.body[0].id, credsid);
            assert.strictEqual(getRes1.body[0].username, VALID_EU_USERNAME);
            assert.strictEqual(getRes1.body[0].password, VALID_EU_PASSWORD);
            assert.strictEqual(getRes1.body[0].credstype, 'conv_standard');

            // check that the correct region was identified
            const verify = await store.getBluemixCredentialsById(Types.ClassTenantType.UnManaged, credsid);
            assert.strictEqual(verify.url, 'https://gateway-fra.watsonplatform.net/assistant/api');

            await request(testServer)
                .delete('/api/classes/' + classid + '/credentials/' + credsid)
                .expect(httpstatus.NO_CONTENT);

            const getRes2 = await request(testServer)
                .get('/api/classes/' + classid + '/credentials?servicetype=conv')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(getRes2.body, []);
        });
    });
});
