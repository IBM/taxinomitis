import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import * as http from 'http';
import { AddressInfo } from 'net';

import * as request from '../../lib/utils/request';


describe('Utils - request', () => {

    let server: http.Server;
    let serverUrl: string;

    before(() => {
        server = http.createServer((req, res) => {
            if (req.url === '/plain-text-error') {
                res.writeHead(500, { 'Content-Type' : 'text/plain; charset=utf-8' });
                res.end('Internal Server Error');
            }
            else if (req.url === '/json-error') {
                res.writeHead(400, { 'Content-Type' : 'application/json' });
                res.end(JSON.stringify({ detail : 'Model training in progress' }));
            }
            else {
                res.writeHead(404);
                res.end();
            }
        });
        return new Promise<void>((resolve) => {
            server.listen(0, '127.0.0.1', () => {
                const address = server.address() as AddressInfo;
                serverUrl = 'http://127.0.0.1:' + address.port;
                resolve();
            });
        });
    });

    after(() => {
        return new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    });


    describe('error responses', () => {

        it('should report a plain-text error when expecting JSON', async () => {
            await assert.rejects(
                request.post(serverUrl + '/plain-text-error', { json : true }, false),
                (err: request.StatusCodeError) => {
                    assert.strictEqual(err.statusCode, 500);
                    assert.strictEqual(err.error, 'Internal Server Error');
                    return true;
                });
        });

        it('should parse a JSON error', async () => {
            await assert.rejects(
                request.post(serverUrl + '/json-error', { json : true }, false),
                (err: request.StatusCodeError) => {
                    assert.strictEqual(err.statusCode, 400);
                    assert.deepStrictEqual(err.error, { detail : 'Model training in progress' });
                    return true;
                });
        });
    });
});
