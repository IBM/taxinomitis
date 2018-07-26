/*eslint-env mocha */

import * as assert from 'assert';
import * as request from 'supertest';
import * as httpStatus from 'http-status';

import testServerSetup from './testserver';



describe('REST API - Bluemix', () => {

    describe('security', () => {
        it('should require https on Bluemix', () => {
            process.env.BLUEMIX_REGION = 'something';
            const testServer = testServerSetup();
            return request(testServer)
                .get('/')
                .expect(httpStatus.MOVED_PERMANENTLY)
                .then((res) => {
                    assert(res.header.location.startsWith('https'));

                    delete process.env.BLUEMIX_REGION;
                });
        });
    });


    describe('ping()', () => {
        it('should return a healthcheck ping', () => {
            const testServer = testServerSetup();
            return request(testServer)
                .get('/api')
                .expect('Content-Type', /json/)
                .expect(httpStatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(typeof body, 'object');
                    assert.strictEqual(Object.keys(body).length, 0);
                });
        });
    });
});
