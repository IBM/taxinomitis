/*eslint-env mocha */

import * as assert from 'assert';
import * as request from 'supertest';
import * as httpStatus from 'http-status';

import testServerSetup from './testserver';



describe('REST API - Bluemix', () => {

    let testServer;

    before(() => {
        testServer = testServerSetup();
    });

    describe('ping()', () => {
        it('should return a healthcheck ping', () => {
            return request(testServer)
                .get('/')
                .expect('Content-Type', /json/)
                .expect(httpStatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.equal(typeof body, 'object');
                    assert.equal(Object.keys(body).length, 0);
                });
        });
    });
});
