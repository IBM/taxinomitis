import { describe, it, before } from 'node:test';
import * as request from 'supertest';
import { status as httpStatus } from 'http-status';
import * as express from 'express';

import testServerSetup from './testserver';



describe('REST API - debug', () => {

    let testServer: express.Express;

    before(() => {
        testServer = testServerSetup();
    });

    async function checkDebug(code: number) {
        await request(testServer)
            .get('/api/debug/errors/' + code)
            .expect('Content-Type', /json/)
            .expect(code);
    }

    describe('debug APIs', () => {
        it('200', async () => { await checkDebug(httpStatus.OK); });
        it('400', async () => { await checkDebug(httpStatus.BAD_REQUEST); });
        it('401', async () => { await checkDebug(httpStatus.UNAUTHORIZED); });
        it('403', async () => { await checkDebug(httpStatus.FORBIDDEN); });
        it('404', async () => { await checkDebug(httpStatus.NOT_FOUND); });
        it('413', async () => { await checkDebug(httpStatus.REQUEST_ENTITY_TOO_LARGE); });
        it('500', async () => { await checkDebug(httpStatus.INTERNAL_SERVER_ERROR); });
        it('501', async () => { await checkDebug(httpStatus.NOT_IMPLEMENTED); });
        it('503', async () => { await checkDebug(httpStatus.SERVICE_UNAVAILABLE); });
    });
});
