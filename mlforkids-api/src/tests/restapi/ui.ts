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
            const names = [ 'about', 'projects', 'teacher', 'worksheets', 'help', 'signup', 'login' ];
            return Promise.all(names.map((name) => verifyRedirect(name)));
        });
    });

    describe('caching headers', () => {
        it('should set required headers on HTML responses',  () => {
            return request(testServer)
                .get('/index.html')
                .expect(httpStatus.OK)
                .expect('Content-Type', /html/)
                .then((res) => {
                    assert.strictEqual(res.header['cache-control'], 'public, max-age=3600');
                });
        });
        it('should set required headers on JS responses',  () => {
            return request(testServer)
                .get('/static/app.js')
                .expect(httpStatus.OK)
                .expect('Content-Type', /javascript/)
                .then((res) => {
                    assert.strictEqual(res.header['cache-control'], 'public, max-age=31536000');
                });
        });
        it('should set required headers on image responses',  () => {
            return request(testServer)
                .get('/static/images/mlforkids-logo.svg')
                .expect(httpStatus.OK)
                .expect('Content-Type', /svg/)
                .then((res) => {
                    assert.strictEqual(res.header['cache-control'], 'public, max-age=31536000');
                });
        });
    });
});
