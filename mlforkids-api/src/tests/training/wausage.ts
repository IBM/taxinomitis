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


    describe('getScratchKeyClient', () => {

        function mockRequest(headers: { [name: string]: string }): Express.Request {
            return {
                header : (name: string) => headers[name.toLowerCase()],
            } as unknown as Express.Request;
        }

        it('should identify Scratch extensions', () => {
            const client = wausage.getScratchKeyClient(mockRequest({
                'user-agent' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                'x-user-agent' : 'mlforkids-scratch3-text',
                'origin' : 'https://machinelearningforkids.co.uk',
            }));
            assert.deepStrictEqual(client, {
                source : 'scratchkey',
                useragent : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                xuseragent : 'mlforkids-scratch3-text',
                origin : 'https://machinelearningforkids.co.uk',
            });
        });

        it('should handle clients without identifying headers', () => {
            const client = wausage.getScratchKeyClient(mockRequest({}));
            assert.deepStrictEqual(client, {
                source : 'scratchkey',
                useragent : undefined,
                xuseragent : undefined,
                origin : undefined,
            });
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
