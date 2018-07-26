/*eslint-env mocha */

import * as assert from 'assert';
import * as request from 'supertest';
import * as httpStatus from 'http-status';
import * as express from 'express';

import testServerSetup from './testserver';



describe('REST API - UI', () => {

    let testServer: express.Express;

    before(() => {
        testServer = testServerSetup();
    });




    describe('ui redirects', () => {
        function verifyRedirect(name: string) {
            return request(testServer)
                .get('/' + name)
                .expect(httpStatus.FOUND)
                .then((res) => {
                    assert.strictEqual(res.header.location, '/#!/' + name);
                });
        }

        it('should redirect main site sections', () => {
            const names = [ 'about', 'projects', 'news', 'teacher', 'worksheets', 'help', 'signup', 'login' ];
            return Promise.all(names.map((name) => verifyRedirect(name)));
        });
    });

    describe('caching headers', () => {
        it.skip('should set required headers on responses',  () => {
            return request(testServer)
                .get('/index.html')
                .expect('Content-Type', /html/)
                .expect(httpStatus.OK)
                .then((res) => {
                    assert.strictEqual(res.header['cache-control'], 'public, max-age=0');
                });
        });
    });
});
