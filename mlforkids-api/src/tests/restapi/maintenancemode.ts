import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import * as request from 'supertest';
import { status as httpstatus } from 'http-status';
import * as express from 'express';

import testapiserver from './testserver';

let testServer: express.Express;

describe('REST API - maintenance mode', () => {

    before(() => {
        process.env.MAINTENANCE_MODE = 'true';
        testServer = testapiserver();
    });

    after(() => {
        delete process.env.MAINTENANCE_MODE;
    });


    it('should handle get requests', async () => {
        const res = await request(testServer)
            .get('/api/classes/myclassid/students/mystudentid/projects')
            .expect('Content-Type', /json/)
            .expect(httpstatus.SERVICE_UNAVAILABLE);

        assert.deepStrictEqual(res.body, { error : 'Site is temporarily down for maintenance' });
    });

    it('should handle delete requests', async () => {
        const res = await request(testServer)
            .delete('/api/classes/myclassid/students/mystudentid/projects/myprojectid')
            .expect('Content-Type', /json/)
            .expect(httpstatus.SERVICE_UNAVAILABLE);

        assert.deepStrictEqual(res.body, { error : 'Site is temporarily down for maintenance' });
    });

    it('should handle patch requests', async () => {
        const res = await request(testServer)
            .patch('/api/classes/myclassid/students/mystudentid/projects/myprojectid')
            .send({ hello : 'world' })
            .expect('Content-Type', /json/)
            .expect(httpstatus.SERVICE_UNAVAILABLE);

        assert.deepStrictEqual(res.body, { error : 'Site is temporarily down for maintenance' });
    });

    it('should handle post requests', async () => {
        const res = await request(testServer)
            .post('/api/classes/myclassid/students/mystudentid/projects/myprojectid/labels')
            .send({ hello : 'world' })
            .expect('Content-Type', /json/)
            .expect(httpstatus.SERVICE_UNAVAILABLE);

        assert.deepStrictEqual(res.body, { error : 'Site is temporarily down for maintenance' });
    });
});
