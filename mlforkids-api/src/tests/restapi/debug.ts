/*eslint-env mocha */

import * as request from 'supertest';
import * as httpStatus from 'http-status';
import * as express from 'express';

import testServerSetup from './testserver';



describe('REST API - debug', () => {

    let testServer: express.Express;

    before(() => {
        testServer = testServerSetup();
    });

    function checkDebug(code: number) {
        return request(testServer)
            .get('/api/debug/errors/' + code)
            .expect('Content-Type', /json/)
            .expect(code);
    }

    describe('debug APIs', () => {
        it('200', () => { return checkDebug(httpStatus.OK); });
        it('400', () => { return checkDebug(httpStatus.BAD_REQUEST); });
        it('401', () => { return checkDebug(httpStatus.UNAUTHORIZED); });
        it('403', () => { return checkDebug(httpStatus.FORBIDDEN); });
        it('404', () => { return checkDebug(httpStatus.NOT_FOUND); });
        it('413', () => { return checkDebug(httpStatus.REQUEST_ENTITY_TOO_LARGE); });
        it('500', () => { return checkDebug(httpStatus.INTERNAL_SERVER_ERROR); });
        it('501', () => { return checkDebug(httpStatus.NOT_IMPLEMENTED); });
        it('503', () => { return checkDebug(httpStatus.SERVICE_UNAVAILABLE); });
    });
});
