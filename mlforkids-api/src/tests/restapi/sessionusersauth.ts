import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import * as request from 'supertest';
import { status as httpstatus } from 'http-status';
import * as express from 'express';
import * as jsonwebtoken from 'jsonwebtoken';

import * as store from '../../lib/db/store';
import * as Objects from '../../lib/db/db-types';
import * as sessionusers from '../../lib/sessionusers';

import testapiserver from './testserver';

let testServer: express.Express;


describe('REST API - session users auth', { concurrency: false }, () => {

    before(() => {
        testServer = testapiserver();

        return store.init();
    });

    after(() => {
        return store.disconnect();
    });

    describe('auth session users', () => {

        let user: Objects.TemporaryUser;


        before(async () => {
            user = await store.storeTemporaryUser(3 * 60 * 1000);
        });
        after(() => {
            return store.deleteTemporaryUser(user);
        });


        it('authenticate API calls from session users - empty projects list', async () => {
            const jwt = jsonwebtoken.sign(user, 'placeholdersecret');

            const res = await request(testServer)
                .get('/api/classes/' + sessionusers.CLASS_NAME + '/students/' + user.id + '/projects')
                .set('Authorization', 'Bearer ' + jwt)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            const body = res.body;
            assert.deepStrictEqual(body, []);
        });


        it('authenticate API calls from session users - fetch non-existent project', async () => {
            const jwt = jsonwebtoken.sign(user, 'placeholdersecret');

            const res = await request(testServer)
                .get('/api/classes/' + sessionusers.CLASS_NAME + '/students/' + user.id + '/projects/DOES-NOT-EXIST')
                .set('Authorization', 'Bearer ' + jwt)
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);

            const body = res.body;
            assert.deepStrictEqual(body, { error : 'Not found' });
        });


        it('authenticate API calls from session users - fetch project', async () => {
            const jwt = jsonwebtoken.sign(user, 'placeholdersecret');

            const project = await store.storeProject(
                user.id,
                sessionusers.CLASS_NAME,
                'text',
                'my test',
                'en', [], false);

            const res = await request(testServer)
                .get('/api/classes/' + sessionusers.CLASS_NAME + '/students/' + user.id + '/projects/' + project.id)
                .set('Authorization', 'Bearer ' + jwt)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            const body = res.body;
            assert.deepStrictEqual(body, project);

            await store.deleteEntireProject(user.id, sessionusers.CLASS_NAME, project);
        });


        it('authenticate API calls from session users - invalid access', async () => {
            const project = await store.storeProject(
                user.id,
                sessionusers.CLASS_NAME,
                'text',
                'my 2nd test',
                'fr', [], false);

            const diffUser = await store.storeTemporaryUser(100000);
            const jwt = jsonwebtoken.sign(diffUser, 'placeholdersecret');

            const res = await request(testServer)
                .get('/api/classes/' + sessionusers.CLASS_NAME + '/students/' + user.id + '/projects/' + project.id)
                .set('Authorization', 'Bearer ' + jwt)
                .expect('Content-Type', /json/)
                .expect(httpstatus.UNAUTHORIZED);

            const body = res.body;
            assert.deepStrictEqual(body, { error : 'Not authorised' });

            await store.deleteTemporaryUser(diffUser);
            await store.deleteEntireProject(user.id, sessionusers.CLASS_NAME, project);
        });


        it('authenticate API calls from session users - handle invalid JWT tokens', async () => {
            const jwt = 'This is not a valid token, but it is lovely';

            const res = await request(testServer)
                .get('/api/classes/' + sessionusers.CLASS_NAME + '/students/' + user.id + '/projects')
                .set('Authorization', 'Bearer ' + jwt)
                .expect('Content-Type', /json/)
                .expect(httpstatus.UNAUTHORIZED);

            const body = res.body;
            assert.deepStrictEqual(body, { error : 'Not authorised' });
        });


        it('authenticate API calls from session users - refuse access from expired users', async () => {
            const expiredUser = await store.storeTemporaryUser(-1000);
            const jwt = jsonwebtoken.sign(expiredUser, 'placeholdersecret');

            const res = await request(testServer)
                .get('/api/classes/' + sessionusers.CLASS_NAME + '/students/' + expiredUser.id + '/projects')
                .set('Authorization', 'Bearer ' + jwt)
                .expect('Content-Type', /json/)
                .expect(httpstatus.UNAUTHORIZED);

            const body = res.body;
            assert.deepStrictEqual(body, { error : 'Not authorised' });

            await store.deleteTemporaryUser(expiredUser);
        });

    });

});
