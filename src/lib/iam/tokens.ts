// external dependencies
import * as request from 'request-promise';
import * as httpStatus from 'http-status';
// local dependencies
import * as Types from './iam-types';
import * as constants from '../utils/constants';
import loggerSetup from '../utils/logger';

const log = loggerSetup();




/**
 * Requests an access token from the Bluemix IAM service.
 */
export async function getAccessToken(apikey: string): Promise<Types.BluemixToken> {
    const req = {
        form : {
            grant_type : 'urn:ibm:params:oauth:grant-type:apikey',
            apikey,
        },
        json : true,
    };

    try {
        const body = await request.post('https://iam.bluemix.net/identity/token', req);

        const expirySeconds = body.expires_in;
        const expiryMs = expirySeconds * 1000;

        // internally expire the token a little earlier than necessary,
        //  to avoid the risk of timing windows resulting in us
        //  submitting a request after the expiration deadline
        const expiryTimestamp = Date.now() + expiryMs - constants.FIVE_MINUTES;

        return {
            access_token : body.access_token,
            expiry_timestamp : expiryTimestamp,
        };
    }
    catch (err) {
        if (err &&
            err.error && typeof err.error === 'object' &&
            err.error.errorCode === 'BXNIM0415E')
        {
            log.debug({ err, apikey }, 'API key rejected');

            const throwErr: any = new Error(ERRORS.INVALID_API_KEY);
            throwErr.statusCode = httpStatus.UNAUTHORIZED;
            throw throwErr;
        }

        log.error({ err }, 'Failed to get access token');
        throw new Error(ERRORS.UNKNOWN);
    }
}

export const ERRORS = {
    UNKNOWN : 'Failed to create token',
    INVALID_API_KEY : 'Invalid API key',
};
