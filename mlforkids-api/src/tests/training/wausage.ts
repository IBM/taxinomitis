import { describe, it, afterEach } from 'node:test';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as Express from 'express';
import * as store from '../../lib/db/store';
import * as DbTypes from '../../lib/db/db-types';
import * as wausage from '../../lib/training/wausage';


describe('Training - text model usage', () => {

    afterEach(() => {
        sinon.restore();
    });


    function mockRequest(method: string, headers: { [name: string]: string }): Express.Request {
        return {
            method,
            header : (name: string) => headers[name.toLowerCase()],
        } as unknown as Express.Request;
    }


    describe('getWebsiteClient', () => {

        it('should only record the country', () => {
            const client = wausage.getWebsiteClient(mockRequest('POST', {
                'user-agent' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                'cf-ipcountry' : 'FR',
                'sec-fetch-site' : 'same-origin',
                'referer' : 'https://machinelearningforkids.co.uk/',
            }));
            assert.deepStrictEqual(client, {
                source : 'website',
                country : 'FR',
            });
        });

        it('should handle requests without a country', () => {
            const client = wausage.getWebsiteClient(mockRequest('POST', {}));
            assert.deepStrictEqual(client, {
                source : 'website',
                country : undefined,
            });
        });
    });


    describe('getScratchKeyClient', () => {

        it('should identify Scratch extensions', () => {
            const client = wausage.getScratchKeyClient(mockRequest('GET', {
                'user-agent' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                'x-user-agent' : 'mlforkids-scratch3-text',
                'origin' : 'https://machinelearningforkids.co.uk',
                'cf-ipcountry' : 'PK',
                'sec-fetch-site' : 'same-origin',
                'sec-fetch-mode' : 'cors',
                'referer' : 'https://machinelearningforkids.co.uk/scratch/?url=https://machinelearningforkids.co.uk/api/scratch/abc/extension3.js',
            }));
            assert.deepStrictEqual(client, {
                source : 'scratchkey',
                useragent : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                xuseragent : 'mlforkids-scratch3-text',
                origin : 'https://machinelearningforkids.co.uk',
                country : 'PK',
                method : 'GET',
                fetchsite : 'same-origin',
                fetchmode : 'cors',
                referrer : 'machinelearningforkids.co.uk',
            });
        });

        it('should handle clients without identifying headers', () => {
            const client = wausage.getScratchKeyClient(mockRequest('POST', {}));
            assert.deepStrictEqual(client, {
                source : 'scratchkey',
                useragent : undefined,
                xuseragent : undefined,
                origin : undefined,
                country : undefined,
                method : 'POST',
                fetchsite : undefined,
                fetchmode : undefined,
                referrer : undefined,
            });
        });
    });


    describe('getReferrerHost', () => {

        it('should only return the host name', () => {
            assert.strictEqual(
                wausage.getReferrerHost('https://Scratch.Example.ORG:8443/projects/123/editor?key=secret#top'),
                'scratch.example.org');
        });

        it('should handle host names without a scheme', () => {
            assert.strictEqual(wausage.getReferrerHost('www.google.com'), 'www.google.com');
        });

        it('should handle missing and invalid values', () => {
            assert.strictEqual(wausage.getReferrerHost(undefined), undefined);
            assert.strictEqual(wausage.getReferrerHost(''), undefined);
            assert.strictEqual(wausage.getReferrerHost('http://'), undefined);
            assert.strictEqual(wausage.getReferrerHost('not a url at all'), undefined);
        });
    });


    describe('describeTraining', () => {

        it('should summarise training data', () => {
            const summary = wausage.describeTraining({
                name : 'test',
                language : 'en',
                intents : [
                    { intent : 'happy', examples : [ { text : 'I like it' }, { text : 'great' } ] },
                    { intent : 'sad', examples : [ { text : 'no' } ] },
                ],
                entities : [], dialog_nodes : [], counterexamples : [], metadata : {},
            });
            assert.deepStrictEqual(summary, { labels : 2, examples : 3, chars : 16 });
        });

        it('should summarise empty training data', () => {
            const summary = wausage.describeTraining({
                name : 'test',
                language : 'en',
                intents : [],
                entities : [], dialog_nodes : [], counterexamples : [], metadata : {},
            });
            assert.deepStrictEqual(summary, { labels : 0, examples : 0, chars : 0 });
        });
    });


    describe('record', () => {

        const event: DbTypes.WaUsageEvent = {
            recorded : new Date(),
            event : 'classify',
            outcome : 'ok',
            projectid : 'projectid',
            client : wausage.WEBSITE,
        };

        it('should store events', () => {
            const storeStub = sinon.stub(store, 'storeWaUsageEvent').resolves();
            wausage.record(event);
            assert(storeStub.calledOnceWith(event));
        });

        it('should not throw if events cannot be stored', async () => {
            const storeStub = sinon.stub(store, 'storeWaUsageEvent').rejects(new Error('DB is down'));
            wausage.record(event);
            assert(storeStub.calledOnce);

            // give the rejected promise a chance to be handled
            await new Promise((resolve) => setImmediate(resolve));
        });
    });
});
