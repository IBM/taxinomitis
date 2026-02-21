import { describe, it, before, beforeEach, after } from 'node:test';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as tokens from '../../lib/iam/tokens';
import * as store from '../../lib/iam/token-store';

import * as constants from '../../lib/utils/constants';

import * as mockIAM from './mock-iam';



describe('IAM - tokens store', () => {

    let fetchStub: sinon.SinonStub<any, any>;
    let clock: sinon.SinonFakeTimers;

    before(() => {
        fetchStub = sinon.stub(global, 'fetch');
        fetchStub.callsFake(mockIAM.fetch.post);
        clock = sinon.useFakeTimers();
    });
    after(() => {
        fetchStub.restore();
        clock.restore();
    });

    beforeEach(() => {
        store.init();
        fetchStub.resetHistory();
    });


    it('should return a token from the IAM service', async () => {
        const token = await store.getToken(mockIAM.KEYS.VALID_RAND + '000001');
        assert(token);
        assert.strictEqual(typeof token, 'string');
        assert(fetchStub.called);
    });

    it('should return new tokens from the IAM service', async () => {
        const tokenA = await store.getToken(mockIAM.KEYS.VALID_RAND + '000002');
        const tokenB = await store.getToken(mockIAM.KEYS.VALID_RAND + '000003');
        assert.notStrictEqual(tokenA, tokenB);
    });

    it('should return a token from the cache', async () => {
        const APIKEY = mockIAM.KEYS.VALID_RAND + '000004';
        const iamToken = await store.getToken(APIKEY);
        assert(fetchStub.called);

        fetchStub.resetHistory();

        const cachedToken = await store.getToken(APIKEY);
        assert.strictEqual(fetchStub.called, false);

        assert.strictEqual(iamToken, cachedToken);
    });

    it('should replace expired tokens', async () => {
        const APIKEY = mockIAM.KEYS.VALID_RAND + '000005';

        const iamToken = await store.getToken(APIKEY);
        assert(fetchStub.called);

        fetchStub.resetHistory();

        const cachedToken = await store.getToken(APIKEY);
        assert.strictEqual(fetchStub.called, false);

        assert.strictEqual(iamToken, cachedToken);

        await store.getToken(APIKEY);
        assert.strictEqual(fetchStub.called, false);

        clock.tick(constants.ONE_HOUR);

        const newToken = await store.getToken(APIKEY);
        assert(fetchStub.called);

        assert.notStrictEqual(newToken, iamToken);
    });

    it('should handle invalid API keys', async () => {
        await assert.rejects(
            () => store.getToken(mockIAM.KEYS.INVALID),
            { message: tokens.ERRORS.INVALID_API_KEY }
        );
    });

    it('should handle IAM failures', async () => {
        await assert.rejects(
            () => store.getToken(mockIAM.KEYS.FAIL),
            { message: tokens.ERRORS.UNKNOWN }
        );
    });
});
