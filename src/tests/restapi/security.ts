/*eslint-env mocha */

import * as assert from 'assert';
import * as request from 'supertest';
import * as httpStatus from 'http-status';
import * as express from 'express';

import testServerSetup from './testserver';



describe('REST API - Security', () => {

    let testServer: express.Express;

    before(() => {
        testServer = testServerSetup();
    });

    describe('headers', () => {
        it('should set required headers on responses',  () => {
            return request(testServer)
                .get('/api')
                .expect('Content-Type', /json/)
                .expect(httpStatus.OK)
                .then((res) => {
                    assert.strictEqual(res.header['x-dns-prefetch-control'], 'off');
                    assert.strictEqual(res.header['x-frame-options'], 'SAMEORIGIN');
                    assert.strictEqual(res.header['x-content-type-options'], 'nosniff');
                    assert.strictEqual(res.header['x-download-options'], 'noopen');
                    assert.strictEqual(res.header['x-xss-protection'], '1; mode=block');
                });
        });
    });
});
