/*eslint-env mocha */

import * as assert from 'assert';
import * as request from 'request-promise';
import * as sinon from 'sinon';
import * as tokens from '../../lib/iam/tokens';
import * as store from '../../lib/iam/token-store';

import * as constants from '../../lib/utils/constants';

import * as mockIAM from './mock-iam';



describe('IAM - tokens store', () => {

    let getTokenStub: sinon.SinonStub<any, any>;
    let clock: sinon.SinonFakeTimers;

    before(() => {
        getTokenStub = sinon.stub(request, 'post');
        getTokenStub.callsFake(mockIAM.request.get);
        clock = sinon.useFakeTimers();
    });
    after(() => {
        getTokenStub.restore();
        clock.restore();
    });

    beforeEach(() => {
        store.init();
        getTokenStub.resetHistory();
    });


    it('should return a token from the IAM service', async () => {
        const token = await store.getToken(mockIAM.KEYS.VALID_RAND + '000001');
        assert(token);
        assert.strictEqual(typeof token, 'string');
        assert(getTokenStub.called);
    });

    it('should return new tokens from the IAM service', async () => {
        const tokenA = await store.getToken(mockIAM.KEYS.VALID_RAND + '000002');
        const tokenB = await store.getToken(mockIAM.KEYS.VALID_RAND + '000003');
        assert.notStrictEqual(tokenA, tokenB);
    });

    it('should return a token from the cache', async () => {
        const APIKEY = mockIAM.KEYS.VALID_RAND + '000004';
        const iamToken = await store.getToken(APIKEY);
        assert(getTokenStub.called);

        getTokenStub.resetHistory();

        const cachedToken = await store.getToken(APIKEY);
        assert.strictEqual(getTokenStub.called, false);

        assert.strictEqual(iamToken, cachedToken);
    });

    it('should replace expired tokens', async () => {
        const APIKEY = mockIAM.KEYS.VALID_RAND + '000005';

        const iamToken = await store.getToken(APIKEY);
        assert(getTokenStub.called);

        getTokenStub.resetHistory();

        const cachedToken = await store.getToken(APIKEY);
        assert.strictEqual(getTokenStub.called, false);

        assert.strictEqual(iamToken, cachedToken);

        await store.getToken(APIKEY);
        assert.strictEqual(getTokenStub.called, false);

        clock.tick(constants.ONE_HOUR);

        const newToken = await store.getToken(APIKEY);
        assert(getTokenStub.called);

        assert.notStrictEqual(newToken, iamToken);
    });

    it('should handle invalid API keys', async () => {
        try {
            await store.getToken(mockIAM.KEYS.INVALID);
            assert.fail('should not reach here');
        }
        catch (err) {
            assert.strictEqual(err.message, tokens.ERRORS.INVALID_API_KEY);
        }
    });

    it('should handle IAM failures', async () => {
        try {
            await store.getToken(mockIAM.KEYS.FAIL);
            assert.fail('should not reach here');
        }
        catch (err) {
            assert.strictEqual(err.message, tokens.ERRORS.UNKNOWN);
        }
    });
});
