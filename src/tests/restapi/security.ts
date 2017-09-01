/*eslint-env mocha */

import * as assert from 'assert';
import * as request from 'supertest';
import * as httpStatus from 'http-status';

import testServerSetup from './testserver';



describe('REST API - Security', () => {

    let testServer;

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
                    assert.equal(res.headers['x-dns-prefetch-control'], 'off');
                    assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
                    assert.equal(res.headers['x-content-type-options'], 'nosniff');
                    assert.equal(res.headers['x-download-options'], 'noopen');
                    assert.equal(res.headers['x-xss-protection'], '1; mode=block');
                });
        });
    });
});
