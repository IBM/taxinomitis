/*eslint-env mocha */

import * as util from 'util';
import * as uuid from 'uuid/v1';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as randomstring from 'randomstring';

import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import testapiserver from './testserver';

let testServer;


describe('REST API - Bluemix credentials', () => {

    let authStub;
    let checkUserStub;
    let requireSupervisorStub;
    // let ensureUnmanagedStub;
    let getClassStub;

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

        getClassStub = sinon.stub(store, 'getClassTenant').callsFake((id) => {
            if (id === 'TESTTENANT' || id === 'DIFFERENT') {
                return Promise.resolve({ isManaged : false });
            }
            else {
                return Promise.resolve({ isManaged : true });
            }
        });
        proxyquire('../../lib/restapi/auth', { '../db/store' : { getClassTenant : getClassStub } });

        await store.init();

        testServer = testapiserver();
    });

    after(() => {
        authStub.restore();
        checkUserStub.restore();
        requireSupervisorStub.restore();
        getClassStub.restore();

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
                    assert.equal(body.error, 'Access to API keys is forbidden for managed tenants');
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
                    assert.equal(body.error, 'Missing required servicetype parameter');
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
                    assert.equal(body.error, 'Unrecognised servicetype parameter');
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
                    assert.deepEqual(body, []);
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
                    assert.deepEqual(body, []);
                });
        });

    });


    describe('deleteCredentials', () => {

        it('should prevent deleting credentials from other tenants', () => {
            const classid = 'TESTTENANT';
            const username = randomstring.generate({ length : 36 });
            const password = randomstring.generate({ length : 12 });

            let credsid;

            return request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype : 'conv',
                    username, password,
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
                    assert.deepEqual(body, { error: 'Access to API keys is forbidden for managed tenants' });
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
                    assert.equal(body.error, 'Invalid credentials');
                });
        });


        it('should create and delete conv credentials', () => {
            const classid = 'TESTTENANT';
            const username = randomstring.generate({ length : 36 });
            const password = randomstring.generate({ length : 12 });

            let credsid;

            return request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype : 'conv',
                    username, password,
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    credsid = body.id;

                    assert.equal(body.username, username);
                    assert.equal(body.password, password);

                    return request(testServer)
                        .get('/api/classes/' + classid + '/credentials?servicetype=conv')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.equal(body.length, 1);

                    assert.equal(body[0].id, credsid);
                    assert.equal(body[0].username, username);
                    assert.equal(body[0].password, password);

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
                    assert.deepEqual(body, []);
                });
        });


        it('should create and delete visrec credentials', () => {
            const classid = 'TESTTENANT';
            const apikey = randomstring.generate({ length : 40 });

            let credsid;

            return request(testServer)
                .post('/api/classes/' + classid + '/credentials')
                .send({
                    servicetype : 'visrec',
                    apikey,
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    const body = res.body;
                    assert(body.id);
                    credsid = body.id;

                    assert.equal(body.apikey, apikey);

                    return request(testServer)
                        .get('/api/classes/' + classid + '/credentials?servicetype=visrec')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.equal(body.length, 1);

                    assert.equal(body[0].id, credsid);
                    assert.equal(body[0].apikey, apikey);

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
                    assert.deepEqual(body, []);
                });
        });
    });


});
