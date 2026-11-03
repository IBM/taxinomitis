import { describe, it, afterEach } from 'node:test';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as Express from 'express';
import * as store from '../../lib/db/store';
import * as DbTypes from '../../lib/db/db-types';
import * as textserviceusage from '../../lib/training/textserviceusage';


describe('Training - text service usage', () => {

    const ORIGINAL_REGION = process.env.CE_REGION;

    afterEach(() => {
        sinon.restore();
        if (ORIGINAL_REGION === undefined) {
            delete process.env.CE_REGION;
        }
        else {
            process.env.CE_REGION = ORIGINAL_REGION;
        }
    });


    function mockRequest(headers: { [name: string]: string }): Express.Request {
        return {
            header : (name: string) => headers[name.toLowerCase()],
        } as unknown as Express.Request;
    }


    describe('clients', () => {

        it('should record the country for website requests', () => {
            const client = textserviceusage.getWebsiteClient(mockRequest({
                'x-mlforkids-country' : 'FR',
                'user-agent' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            }));
            assert.deepStrictEqual(client, { source : 'website', country : 'FR' });
        });

        it('should record the country for Scratch key requests', () => {
            const client = textserviceusage.getScratchKeyClient(mockRequest({
                'x-mlforkids-country' : 'PK',
                'x-user-agent' : 'mlforkids-scratch3-text',
            }));
            assert.deepStrictEqual(client, { source : 'scratchkey', country : 'PK' });
        });

        it('should handle requests without a country', () => {
            const client = textserviceusage.getWebsiteClient(mockRequest({}));
            assert.deepStrictEqual(client, { source : 'website', country : undefined });
        });
    });


    describe('record', () => {

        const event: DbTypes.TextServiceUsageEvent = {
            recorded : new Date(),
            event : 'classify',
            outcome : 'ok',
            projectid : 'projectid',
            client : { source : 'website', country : 'GB' },
        };

        it('should store events with the region from Code Engine', () => {
            process.env.CE_REGION = 'eu-de';
            const storeStub = sinon.stub(store, 'storeTextServiceUsageEvent').resolves();

            textserviceusage.record(event);

            assert(storeStub.calledOnce);
            assert.deepStrictEqual(storeStub.firstCall.args[0], { ...event, region : 'eu-de' });
        });

        it('should store events without a region when not on Code Engine', () => {
            delete process.env.CE_REGION;
            const storeStub = sinon.stub(store, 'storeTextServiceUsageEvent').resolves();

            textserviceusage.record(event);

            assert.deepStrictEqual(storeStub.firstCall.args[0], event);
        });

        it('should not throw if events cannot be stored', async () => {
            const storeStub = sinon.stub(store, 'storeTextServiceUsageEvent').rejects(new Error('DB is down'));

            textserviceusage.record(event);
            assert(storeStub.calledOnce);

            // give the rejected promise a chance to be handled
            await new Promise((resolve) => setImmediate(resolve));
        });
    });
});
