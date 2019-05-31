/*eslint-env mocha */

import * as assert from 'assert';
import * as request from 'request-promise';
import * as sinon from 'sinon';
import * as tokens from '../../lib/iam/tokens';
import * as constants from '../../lib/utils/constants';
import * as mockIAM from './mock-iam';


describe('IAM - access tokens', () => {

    let getTokenStub: sinon.SinonStub<any, any>;

    before(() => {
        getTokenStub = sinon.stub(request, 'post');
        getTokenStub.callsFake(mockIAM.request.get);
    });
    after(() => {
        getTokenStub.restore();
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
        try {
            await tokens.getAccessToken(mockIAM.KEYS.INVALID);
            assert.fail('should not reach here');
        }
        catch (err) {
            assert.strictEqual(err.message, tokens.ERRORS.INVALID_API_KEY);
        }
    });

    it('should handle unexpected failures', async () => {
        try {
            await tokens.getAccessToken(mockIAM.KEYS.FAIL);
            assert.fail('should not reach here');
        }
        catch (err) {
            assert.strictEqual(err.message, tokens.ERRORS.UNKNOWN);
        }
    });
});
