import { describe, it, before, beforeEach, after, afterEach } from 'node:test';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as request from 'supertest';
import { status as httpstatus } from 'http-status';
import * as express from 'express';

import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';

import testapiserver from './testserver';

let testServer: express.Express;


describe('REST API - session users', { concurrency: false }, () => {

    let authStub: sinon.SinonStub<[express.Request, express.Response, express.NextFunction], void>;

    let nextAuth0UserId = 'userid';
    let nextAuth0UserTenant = 'tenant';
    let nextAuth0UserRole = 'student';
    let nextDecodedToken = {};

    let clock: sinon.SinonFakeTimers;

    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        const mockedReq: any = req;
        mockedReq.user = {
            'sub' : nextAuth0UserId,
            'https://machinelearningforkids.co.uk/api/role' : nextAuth0UserRole,
            'https://machinelearningforkids.co.uk/api/tenant' : nextAuth0UserTenant,
            'session' : nextDecodedToken,
        };
        next();
    }

    before(() => {
        clock = sinon.useFakeTimers({ now: Date.now(), shouldAdvanceTime: true });

        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);

        testServer = testapiserver();

        return store.init();
    });

    after(() => {
        authStub.restore();
        clock.restore();

        return store.disconnect();
    });


    beforeEach(() => {
        // advance 12 seconds, because we don't check
        //  to see if a class is full more than once
        //  every 10 seconds
        clock.tick(1000 * 12);
    });





    describe('createSessionUser', () => {

        // test turnstile secrets defined in
        //  https://developers.cloudflare.com/turnstile/troubleshooting/testing/
        let originalTurnstileSecret: string | undefined;

        beforeEach(() => {
            // Save original env var
            originalTurnstileSecret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
        });

        afterEach(() => {
            // Restore original env var
            if (originalTurnstileSecret !== undefined) {
                process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = originalTurnstileSecret;
            }
            else {
                delete process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
            }
        });


        it('should create users', async () => {
            // Configure turnstile to accept any token
            process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';

            const count = await store.countTemporaryUsers();

            const timeBefore = new Date();

            await wait(1);

            const resp = await request(testServer)
                                .post('/api/sessionusers')
                                .send({ turnstile: 'valid-turnstile-token' })
                                .expect('Content-Type', /json/)
                                .expect(httpstatus.CREATED);

            await wait(1);

            const timeAfter = new Date();

            const user = resp.body;
            assert(user.id);
            assert(user.token);
            assert(user.sessionExpiry);
            assert(user.jwt);
            assert.strictEqual(typeof user.id, 'string');
            assert.strictEqual(typeof user.token, 'string');
            assert.strictEqual(typeof user.sessionExpiry, 'string');
            assert.strictEqual(typeof user.jwt, 'string');

            const exp = new Date(user.sessionExpiry);
            exp.setHours(exp.getHours() - 4);
            assert(timeBefore.getTime() < exp.getTime());
            assert(timeAfter.getTime() > exp.getTime());

            assert.strictEqual(user.jwt.split('.').length, 3);

            const after = await store.countTemporaryUsers();
            assert.strictEqual(after, count + 1);

            await store.deleteTemporaryUser(user);
        });


        it('should limit the number of users', async () => {
            // Configure turnstile to accept any token
            process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';

            await fillSessionUsersClass();

            const resp = await request(testServer)
                                .post('/api/sessionusers')
                                .send({ turnstile: 'valid-turnstile-token' })
                                .expect('Content-Type', /json/)
                                .expect(httpstatus.PRECONDITION_FAILED);

            assert.deepStrictEqual(resp.body, { error : 'Class full' });

            await store.testonly_resetSessionUsersStore();
        });


        it('should require a turnstile token', async () => {
            const resp = await request(testServer)
                                .post('/api/sessionusers')
                                .send({})
                                .expect('Content-Type', /json/)
                                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(resp.body, {
                error: 'A turnstile token is required to start a session',
            });
        });


        it('should reject an invalid turnstile token', async () => {
            // Configure turnstile to reject any token
            process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = '2x0000000000000000000000000000000AA';

            const resp = await request(testServer)
                                .post('/api/sessionusers')
                                .send({ turnstile: 'invalid-turnstile-token' })
                                .expect('Content-Type', /json/)
                                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(resp.body, {
                error: 'A valid turnstile token is required to start a session',
            });
        });


        it('should reject an already-used turnstile token', async () => {
            // Configure turnstile to reject token as already used
            process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = '3x0000000000000000000000000000000AA';

            const resp = await request(testServer)
                                .post('/api/sessionusers')
                                .send({ turnstile: 'already-used-turnstile-token' })
                                .expect('Content-Type', /json/)
                                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(resp.body, {
                error: 'A valid turnstile token is required to start a session',
            });
        });

    });



    describe('deleteSessionUser', () => {

        it('should not allow a session user to log off another user', async () => {
            const user = await store.storeTemporaryUser(300000);

            nextAuth0UserId = user.id;
            nextAuth0UserRole = 'student';
            nextAuth0UserTenant = 'session-users';
            nextDecodedToken = user;

            const resp = await request(testServer)
                                .delete('/api/classes/session-users/sessionusers/' + 'someoneelse')
                                .expect(httpstatus.FORBIDDEN);

            assert.deepStrictEqual(resp.body, { error : 'Invalid access' });

            const verify = await store.getTemporaryUser(user.id);
            assert(verify);

            return store.deleteTemporaryUser(user);
        });


        it('should not delete a session user that was not successfully retrieved', async () => {
            const user = await store.storeTemporaryUser(300000);

            nextAuth0UserId = user.id;
            nextAuth0UserRole = 'student';
            nextAuth0UserTenant = 'session-users';
            nextDecodedToken = {
                id : user.id,
            };

            const resp = await request(testServer)
                                .delete('/api/classes/session-users/sessionusers/' + user.id)
                                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(resp.body, { error : 'Missing data' });

            const verify = await store.getTemporaryUser(user.id);
            assert(verify);

            return store.deleteTemporaryUser(user);
        });


        it('should delete a session user at log-off', async () => {
            const user = await store.storeTemporaryUser(300000);

            const verify = await store.getTemporaryUser(user.id);
            assert(verify);
            if (verify) {
                assert.strictEqual(verify.token, user.token);
            }

            nextAuth0UserId = user.id;
            nextAuth0UserRole = 'student';
            nextAuth0UserTenant = 'session-users';
            nextDecodedToken = user;

            await request(testServer)
                    .delete('/api/classes/session-users/sessionusers/' + user.id)
                    .expect(httpstatus.NO_CONTENT);

            const verifyMissing = await store.getTemporaryUser(user.id);
            assert(!verifyMissing);
        });
    });





    async function fillSessionUsersClass(): Promise<void> {
        for (let i = 0; i < 3500; i++) {
            await store.storeTemporaryUser(1);
        }
    }

    async function wait(seconds: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => resolve(), (seconds * 1000));
        });
    }
});
