// external dependencies
import * as LRU from 'lru';
// internal dependencies
import * as tokens from './tokens';
import * as constants from '../utils/constants';


let accessTokensCache: any;


export function init() {
    accessTokensCache = new LRU({
        max: 500,
        // according to https://cloud.ibm.com/docs/iam?topic=iam-iamtoken_from_apikey#iamtoken_from_apikey
        //  tokens are only valid for 1 hour
        maxAge: constants.ONE_HOUR,
    });
}


export async function getToken(apikey: string): Promise<string>
{
    const token = getTokenFromCache(apikey);

    if (token) {
        return Promise.resolve(token);
    }

    const iamToken = await tokens.getAccessToken(apikey);
    accessTokensCache.set(apikey, iamToken);
    return iamToken.access_token;
}



function getTokenFromCache(apikey: string): string | undefined {
    const token = accessTokensCache.get(apikey);
    if (token && token.expiry_timestamp > Date.now()) {
        return token.access_token;
    }
}
