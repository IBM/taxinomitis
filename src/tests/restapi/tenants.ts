/*eslint-env mocha */
import { v1 as uuid } from 'uuid';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as express from 'express';

import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import * as auth0 from '../../lib/auth0/requests';
import * as auth0types from '../../lib/auth0/auth-types';
import * as mocks from '../auth0/requestmocks';
import testapiserver from './testserver';


let testServer: express.Express;


describe('REST API - tenants', () => {

    let authStub: sinon.SinonStub<any, any>;
    let getOauthToken: sinon.SinonStub<[], Promise<auth0types.Auth0TokenPayload>>;
    let getUserCounts: sinon.SinonStub<[string, string], Promise<auth0types.UsersInfo>>;

    let nextAuth0UserId = 'userid';
    let nextAuth0UserTenant = 'tenant';
    let nextAuth0UserRole = 'supervisor';

    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        // @ts-ignore
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


    describe('get policy', () => {

        it('should only allow students to query project types', () => {
            const tenant = uuid();
            const url = '/api/classes/' + tenant + '/policy';
            nextAuth0UserTenant = tenant;
            nextAuth0UserRole = 'student';
            return request(testServer)
                .get(url)
                .expect(httpstatus.OK)
                .then((res) => {
                    assert.deepStrictEqual(Object.keys(res.body),
                        [ 'supportedProjectTypes' ]);
                    assert.deepStrictEqual(res.body.supportedProjectTypes,
                        [ 'text', 'imgtfjs', 'numbers', 'sounds' ]);
                });
        });

        it('should allow teachers to query detailed policy info', () => {
            const tenant = uuid();
            const url = '/api/classes/' + tenant + '/policy';
            nextAuth0UserTenant = tenant;
            nextAuth0UserRole = 'supervisor';
            return request(testServer)
                .get(url)
                .expect(httpstatus.OK)
                .then((res) => {
                    assert.deepStrictEqual(Object.keys(res.body),
                        [
                            'isManaged',
                            'tenantType',
                            'maxTextModels',
                            'maxUsers',
                            'supportedProjectTypes',
                            'maxProjectsPerUser',
                            'textClassifierExpiry',
                            'textTrainingItemsPerProject',
                            'numberTrainingItemsPerProject',
                            'numberTrainingItemsPerClassProject',
                            'imageTrainingItemsPerProject',
                            'soundTrainingItemsPerProject',
                        ]);
                    assert.deepStrictEqual(res.body.supportedProjectTypes,
                        [ 'text', 'imgtfjs', 'numbers', 'sounds' ]);
                });
        });
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
                    ],
                    expected : 'PATCH body should include 1 value',
                },
                {
                    patch : [
                        { op : 'replace', path : '/textClassifierExpiry', value : 1 },
                        { hello : 'world' },
                    ],
                    expected : 'PATCH body should include 1 value',
                },
                {
                    patch : [
                        { op : 'replace', path : '/textClassifierExpiry', value : 1 },
                        { op : 'replace', path : '/textClassifierExpiry', value : 2 },
                    ],
                    expected : 'PATCH body should include 1 value',
                },
                {
                    patch : [
                        { op : 'replace', path : '/textClassifierExpiry', value : -1000 },
                    ],
                    expected : 'Missing data',
                },
                {
                    patch : [
                        { op : 'replace', path : '/textClassifierExpiry', value : 'bad' },
                    ],
                    expected : 'Missing data',
                },
                {
                    patch : [
                        { op : 'replace', path : '/textClassifierExpiry', value : 1000 },
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

            //
            // MODIFY A NON-EXISTENT TENANT
            //
                    return request(testServer)
                        .patch(url)
                        .send([
                            { op : 'replace', path : '/textClassifierExpiry', value : 100 },
                        ])
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    assert.strictEqual(res.body.textClassifierExpiry, 100);

                    return request(testServer)
                        .get(url)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.textClassifierExpiry, 100);

            //
            // MODIFY AN EXISTING TENANT
            //
                    return request(testServer)
                        .patch(url)
                        .send([
                            { op : 'replace', path : '/textClassifierExpiry', value : 16 },
                        ])
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    assert.strictEqual(res.body.textClassifierExpiry, 16);

                    return request(testServer)
                        .get(url)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.textClassifierExpiry, 16);

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
                });
        });
    });

});
