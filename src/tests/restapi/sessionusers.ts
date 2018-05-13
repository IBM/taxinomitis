/*eslint-env mocha */

import * as uuid from 'uuid/v1';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as randomstring from 'randomstring';
import * as express from 'express';

import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import * as auth0 from '../../lib/auth0/requests';
import * as mocks from '../auth0/requestmocks';

import testapiserver from './testserver';

let testServer: express.Express;


describe('REST API - session users', () => {

    let authStub: sinon.SinonStub;
    let checkUserStub: sinon.SinonStub;

    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        next();
    }


    before(() => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
        checkUserStub = sinon.stub(auth, 'checkValidUser').callsFake(authNoOp);

        testServer = testapiserver();

        return store.init();
    });

    after(() => {
        authStub.restore();
        checkUserStub.restore();

        return store.disconnect();
    });



    describe('createSessionUser', () => {


        it('should create users', async () => {
            const count = await store.countTemporaryUsers();

            const timeBefore = new Date();

            await wait(1);

            const resp = await request(testServer)
                                .post('/api/sessionusers')
                                .expect('Content-Type', /json/)
                                .expect(httpstatus.CREATED);

            await wait(1);

            const timeAfter = new Date();

            const user = resp.body;
            assert(user.id);
            assert(user.token);
            assert(user.sessionExpiry);
            assert(user.jwt);
            assert.equal(typeof user.id, 'string');
            assert.equal(typeof user.token, 'string');
            assert.equal(typeof user.sessionExpiry, 'string');
            assert.equal(typeof user.jwt, 'string');

            const exp = new Date(user.sessionExpiry);
            exp.setHours(exp.getHours() - 4);
            assert(timeBefore.getTime() < exp.getTime());
            assert(timeAfter.getTime() > exp.getTime());

            assert.equal(user.jwt.split('.').length, 3);

            const after = await store.countTemporaryUsers();
            assert.strictEqual(after, count + 1);

            await store.deleteTemporaryUser(user);
        });


        it('should limit the number of users', async () => {
            await fillSessionUsersClass();

            const resp = await request(testServer)
                                .post('/api/sessionusers')
                                .expect('Content-Type', /json/)
                                .expect(httpstatus.PRECONDITION_FAILED);

            assert.deepStrictEqual(resp.body, { error : 'Class full' });

            await store.testonly_resetSessionUsersStore();
        });

    });







    async function fillSessionUsersClass(): Promise<void> {
        for (let i = 0; i < 360; i++) {
            await store.storeTemporaryUser(1);
        }
    }

    async function wait(seconds: number): Promise<{}> {
        return new Promise((resolve) => {
            setTimeout(resolve, (seconds * 1000));
        });
    }
});
