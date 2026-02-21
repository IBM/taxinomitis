import { describe, it, before, beforeEach, after } from 'node:test';
import * as assert from 'node:assert';
import { v1 as uuid } from 'uuid';
import * as sinon from 'sinon';
import * as request from 'supertest';
import { status as httpstatus } from 'http-status';
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
        const mockedReq: any = req;
        mockedReq.user = {
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
        await store.disconnect();
    });


    describe('get policy', () => {

        it('should only allow students to query project types', async () => {
            const tenant = uuid();
            const url = '/api/classes/' + tenant + '/policy';
            nextAuth0UserTenant = tenant;
            nextAuth0UserRole = 'student';
            const res = await request(testServer)
                .get(url)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(Object.keys(res.body),
                [ 'supportedProjectTypes' ]);
            assert.deepStrictEqual(res.body.supportedProjectTypes,
                [ 'text', 'imgtfjs', 'numbers', 'sounds' ]);
        });

        it('should allow teachers to query detailed policy info', async () => {
            const tenant = uuid();
            const url = '/api/classes/' + tenant + '/policy';
            nextAuth0UserTenant = tenant;
            nextAuth0UserRole = 'supervisor';
            const res = await request(testServer)
                .get(url)
                .expect(httpstatus.OK);

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


    describe('set policy', () => {

        it('should not allow students to modify expiry limits', async () => {
            const tenant = uuid();
            const url = '/api/classes/' + tenant + '/policy';
            nextAuth0UserTenant = tenant;
            nextAuth0UserRole = 'student';

            const forbiddenRes = await request(testServer)
                .patch(url)
                .send([
                    { op : 'replace', path : '/textClassifierExpiry', value : 1 },
                ])
                .expect(httpstatus.FORBIDDEN);

            assert.strictEqual(forbiddenRes.body.error, 'Only supervisors are allowed to invoke this');

            nextAuth0UserRole = 'supervisor';
            const getRes = await request(testServer)
                .get(url)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes.body.textClassifierExpiry, 24);
        });


        async function verifyRejectedModification(url: string, patch: any, expected: string) {
            const patchRes = await request(testServer)
                .patch(url)
                .send(patch)
                .expect(httpstatus.BAD_REQUEST);

            assert.strictEqual(patchRes.body.error, expected);

            const getRes = await request(testServer)
                .get(url)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes.body.textClassifierExpiry, 24);
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


        it('should modify a tenant', async () => {
            const tenant = uuid();
            const url = '/api/classes/' + tenant + '/policy';
            nextAuth0UserTenant = tenant;

            //
            // GET THE DEFAULT TENANT
            //
            const defaultRes = await request(testServer)
                .get(url)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(defaultRes.body.textClassifierExpiry, 24);

            //
            // MODIFY A NON-EXISTENT TENANT
            //
            const patchRes1 = await request(testServer)
                .patch(url)
                .send([
                    { op : 'replace', path : '/textClassifierExpiry', value : 100 },
                ])
                .expect(httpstatus.OK);

            assert.strictEqual(patchRes1.body.textClassifierExpiry, 100);

            const getRes1 = await request(testServer)
                .get(url)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes1.body.textClassifierExpiry, 100);

            //
            // MODIFY AN EXISTING TENANT
            //
            const patchRes2 = await request(testServer)
                .patch(url)
                .send([
                    { op : 'replace', path : '/textClassifierExpiry', value : 16 },
                ])
                .expect(httpstatus.OK);

            assert.strictEqual(patchRes2.body.textClassifierExpiry, 16);

            const getRes2 = await request(testServer)
                .get(url)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes2.body.textClassifierExpiry, 16);

            //
            // CLEAN-UP
            //
            await store.deleteClassTenant(tenant);

            const finalRes = await request(testServer)
                .get(url)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(finalRes.body.textClassifierExpiry, 24);
        });
    });

});
