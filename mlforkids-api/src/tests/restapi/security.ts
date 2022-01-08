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

                    // disabled by default now : https://github.com/helmetjs/helmet/issues/230
                    // assert.strictEqual(res.header['x-xss-protection'], '1; mode=block');
                    assert.strictEqual(res.header['x-xss-protection'], '0');
                });
        });
    });

    describe('CORS', () => {
        it('should prevent CORS by default', () => {
            return request(testServer)
                .get('/api')
                .expect('Content-Type', /json/)
                .expect(httpStatus.OK)
                .then((res) => {
                    assert.strictEqual(res.header['access-control-allow-origin'], undefined);
                    assert.strictEqual(res.header['access-control-allow-headers'], undefined);
                });
        });

        it('should allow CORS for local development access to TensorFlow', () => {
            return request(testServer)
                .get('/static/bower_components/tensorflow-models/speech-commands/model.json')
                .set('origin', 'http://ml-for-kids-local.net:3000')
                .expect('Content-Type', /json/)
                .expect(httpStatus.OK)
                .expect('access-control-allow-origin', 'http://ml-for-kids-local.net:3000')
                .expect('access-control-allow-headers', 'Origin, X-Requested-With, Content-Type, Accept');
        });
    });
});
