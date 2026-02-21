import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as tokens from '../../lib/iam/tokens';
import * as constants from '../../lib/utils/constants';
import * as mockIAM from './mock-iam';


describe('IAM - access tokens', () => {

    let fetchStub: sinon.SinonStub<any, any>;

    before(() => {
        fetchStub = sinon.stub(global, 'fetch');
        fetchStub.callsFake(mockIAM.fetch.post);
    });
    after(() => {
        fetchStub.restore();
    });


    it('should create an access token', async () => {
        const before = Date.now();
        const inFiftyMinutes = before + constants.FIFTY_MINUTES;
        const inOneHour = before + constants.ONE_HOUR;

        const token = await tokens.getAccessToken(mockIAM.KEYS.VALID);

        assert.strictEqual(token.access_token, 'I am a valid access token');
        assert(token.expiry_timestamp);
        assert(token.expiry_timestamp < inOneHour);
        assert(token.expiry_timestamp > inFiftyMinutes);
    });

    it('should handle invalid API keys', async () => {
        await assert.rejects(
            () => tokens.getAccessToken(mockIAM.KEYS.INVALID),
            { message: tokens.ERRORS.INVALID_API_KEY }
        );
    });

    it('should handle unexpected failures', async () => {
        await assert.rejects(
            () => tokens.getAccessToken(mockIAM.KEYS.FAIL),
            { message: tokens.ERRORS.UNKNOWN }
        );
    });
});
