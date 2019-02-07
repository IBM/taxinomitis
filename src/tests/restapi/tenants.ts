/*eslint-env mocha */
import * as uuid from 'uuid/v1';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as express from 'express';

import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import * as auth0 from '../../lib/auth0/requests';
import * as mocks from '../auth0/requestmocks';
import testapiserver from './testserver';


let testServer: express.Express;


describe('REST API - tenants', () => {

    let authStub: sinon.SinonStub;
    let getOauthToken: sinon.SinonStub;
    let getUserCounts: sinon.SinonStub;

    let nextAuth0UserId = 'userid';
    let nextAuth0UserTenant = 'tenant';
    let nextAuth0UserRole = 'supervisor';

    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        req.user = {
            'sub' : nextAuth0UserId,
            'https://machinelearningforkids.co.uk/api/role' : nextAuth0UserRole,
            'https://machinelearningforkids.co.uk/api/tenant' : nextAuth0UserTenant,
        };
        next();
    }



    before(async () => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
        getOauthToken = sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good);
        getUserCounts = sinon.stub(auth0, 'getUserCounts').callsFake(mocks.getUserCounts);

        await store.init();

        testServer = testapiserver();
    });

    beforeEach(() => {
        nextAuth0UserId = 'userid';
        nextAuth0UserTenant = 'classid';
        nextAuth0UserRole = 'supervisor';
    });

    after(async () => {
        authStub.restore();
        getOauthToken.restore();
        getUserCounts.restore();
        return store.disconnect();
    });



    describe('set policy', () => {

        it('should not allow students to modify expiry limits', () => {
            const tenant = uuid();
            const url = '/api/classes/' + tenant + '/policy';
            nextAuth0UserTenant = tenant;
            nextAuth0UserRole = 'student';

            return request(testServer)
                .patch(url)
                .send([
                    { op : 'replace', path : '/textClassifierExpiry', value : 1 },
                    { op : 'replace', path : '/imageClassifierExpiry', value : 2 },
                ])
                .expect(httpstatus.FORBIDDEN)
                .then((res) => {
                    assert.strictEqual(res.body.error, 'Only supervisors are allowed to invoke this');

                    nextAuth0UserRole = 'supervisor';
                    return request(testServer)
                        .get(url)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.textClassifierExpiry, 24);
                    assert.strictEqual(body.imageClassifierExpiry, 24);
                });
        });


        async function verifyRejectedModification(url: string, patch: any, expected: string) {
            return request(testServer)
                .patch(url)
                .send(patch)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.strictEqual(res.body.error, expected);
                    return request(testServer)
                        .get(url)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.textClassifierExpiry, 24);
                    assert.strictEqual(body.imageClassifierExpiry, 24);
                });
        }


        it('should require a complete modification', async () => {
            const tenant = uuid();
            const url = '/api/classes/' + tenant + '/policy';
            nextAuth0UserTenant = tenant;

            const tests = [
                {
                    patch : { op : 'replace', path : '/textClassifierExpiry', value : 1 },
                    expected : 'PATCH body should be an array',
                },
                {
                    patch : [
                        { op : 'replace', path : '/textClassifierExpiry', value : 1 },
                    ],
                    expected : 'PATCH body should include 2 values',
                },
                {
                    patch : [
                        { op : 'replace', path : '/textClassifierExpiry', value : 1 },
                        { hello : 'world' },
                    ],
                    expected : 'Invalid PATCH request',
                },
                {
                    patch : [
                        { op : 'replace', path : '/textClassifierExpiry', value : 1 },
                        { op : 'replace', path : '/textClassifierExpiry', value : 2 },
                    ],
                    expected : 'Missing data',
                },
                {
                    patch : [
                        { op : 'replace', path : '/textClassifierExpiry', value : -1000 },
                        { op : 'replace', path : '/imageClassifierExpiry', value : 20 },
                    ],
                    expected : 'Missing data',
                },
                {
                    patch : [
                        { op : 'replace', path : '/textClassifierExpiry', value : 'bad' },
                        { op : 'replace', path : '/imageClassifierExpiry', value : 20 },
                    ],
                    expected : 'Missing data',
                },
                {
                    patch : [
                        { op : 'replace', path : '/textClassifierExpiry', value : 1000 },
                        { op : 'replace', path : '/imageClassifierExpiry', value : 20 },
                    ],
                    expected : 'Missing data',
                },
            ];

            for (const test of tests) {
                await verifyRejectedModification(url, test.patch, test.expected);
            }
        });


        it('should modify a tenant', () => {
            const tenant = uuid();
            const url = '/api/classes/' + tenant + '/policy';
            nextAuth0UserTenant = tenant;

            //
            // GET THE DEFAULT TENANT
            //
            return request(testServer)
                .get(url)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.textClassifierExpiry, 24);
                    assert.strictEqual(body.imageClassifierExpiry, 24);

            //
            // MODIFY A NON-EXISTENT TENANT
            //
                    return request(testServer)
                        .patch(url)
                        .send([
                            { op : 'replace', path : '/textClassifierExpiry', value : 100 },
                            { op : 'replace', path : '/imageClassifierExpiry', value : 32 },
                        ])
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    assert.strictEqual(res.body.textClassifierExpiry, 100);
                    assert.strictEqual(res.body.imageClassifierExpiry, 32);

                    return request(testServer)
                        .get(url)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.textClassifierExpiry, 100);
                    assert.strictEqual(body.imageClassifierExpiry, 32);

            //
            // MODIFY AN EXISTING TENANT
            //
                    return request(testServer)
                        .patch(url)
                        .send([
                            { op : 'replace', path : '/textClassifierExpiry', value : 16 },
                            { op : 'replace', path : '/imageClassifierExpiry', value : 7 },
                        ])
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    assert.strictEqual(res.body.textClassifierExpiry, 16);
                    assert.strictEqual(res.body.imageClassifierExpiry, 7);

                    return request(testServer)
                        .get(url)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.textClassifierExpiry, 16);
                    assert.strictEqual(body.imageClassifierExpiry, 7);

            //
            // CLEAN-UP
            //
                    return store.deleteClassTenant(tenant);
                })
                .then(() => {
                    return request(testServer)
                        .get(url)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.textClassifierExpiry, 24);
                    assert.strictEqual(body.imageClassifierExpiry, 24);
                });
        });
    });

});
