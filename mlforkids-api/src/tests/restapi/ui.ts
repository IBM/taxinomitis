import { describe, it, before } from 'node:test';
import * as assert from 'assert';
import * as request from 'supertest';
import { status as httpStatus } from 'http-status';
import * as express from 'express';

import testServerSetup from './testserver';



describe('REST API - UI', () => {

    let testServer: express.Express;

    before(() => {
        testServer = testServerSetup();
    });




    describe('ui redirects', () => {
        async function verifyRedirect(name: string) {
            const res = await request(testServer)
                .get('/' + name)
                .expect(httpStatus.FOUND);

            assert.strictEqual(res.header.location, '/#!/' + name);
        }

        it('should redirect main site sections', async () => {
            const names = [ 'about', 'projects', 'teacher', 'worksheets', 'help', 'signup', 'login' ];
            await Promise.all(names.map((name) => verifyRedirect(name)));
        });
    });

    describe('unknown urls', () => {
        it('should redirect page navigations to the 404 page', async () => {
            const res = await request(testServer)
                .get('/no-such-page')
                .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
                .expect(httpStatus.FOUND);

            assert.strictEqual(res.header.location, '/#!/404');
        });
        it('should return a 404 for script requests', async () => {
            // the Accept header jQuery sends when loading a script
            await request(testServer)
                .get('/translationFile.js')
                .set('Accept', 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01')
                .expect(httpStatus.NOT_FOUND);
        });
        it('should return a 404 for wildcard requests', async () => {
            await request(testServer)
                .get('/static/components/no-such-template.html')
                .set('Accept', '*/*')
                .expect(httpStatus.NOT_FOUND);
        });
        it('should return a 404 for requests with no Accept header', async () => {
            await request(testServer)
                .get('/no-such-file.css')
                .expect(httpStatus.NOT_FOUND);
        });
    });

    describe('caching headers', () => {
        it('should set required headers on HTML responses', async () => {
            const res = await request(testServer)
                .get('/index.html')
                .expect(httpStatus.OK)
                .expect('Content-Type', /html/);

            assert.strictEqual(res.header['cache-control'], 'public, max-age=3600');
        });
        it('should set required headers on JS responses', async () => {
            const res = await request(testServer)
                .get('/static/app.js')
                .expect(httpStatus.OK)
                .expect('Content-Type', /javascript/);

            assert.strictEqual(res.header['cache-control'], 'public, max-age=31536000');
        });
        it('should set required headers on image responses', async () => {
            const res = await request(testServer)
                .get('/static/images/mlforkids-logo.svg')
                .expect(httpStatus.OK)
                .expect('Content-Type', /svg/);

            assert.strictEqual(res.header['cache-control'], 'public, max-age=31536000');
        });
    });
});
