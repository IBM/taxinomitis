/*eslint-env mocha */

import * as assert from 'assert';
import * as request from 'supertest';
import * as httpStatus from 'http-status';

import testServerSetup from './testserver';



describe('REST API - UI', () => {

    let testServer;

    before(() => {
        testServer = testServerSetup();
    });




    describe('ui redirects', () => {
        function verifyRedirect(name: string) {
            return request(testServer)
                .get('/' + name)
                .expect(httpStatus.FOUND)
                .then((res) => {
                    assert.equal(res.header.location, '/#!/' + name);
                });
        }

        it('should redirect main site sections', () => {
            const names = [ 'about', 'projects', 'news', 'teacher', 'worksheets', 'help' ];
            return Promise.all(names.map((name) => verifyRedirect(name)));
        });
    });

    describe('caching headers', () => {
        it('should set required headers on responses',  () => {
            return request(testServer)
                .get('/index.html')
                .expect('Content-Type', /html/)
                .expect(httpStatus.OK)
                .then((res) => {
                    assert.equal(res.header['cache-control'], 'public, max-age=0');
                });
        });
    });
});
