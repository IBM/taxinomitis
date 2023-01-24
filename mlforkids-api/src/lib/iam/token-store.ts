// external dependencies
import * as LRU from 'lru-cache';
// internal dependencies
import * as tokens from './tokens';
import * as constants from '../utils/constants';
import { BluemixToken } from './iam-types';


const accessTokensCache = new LRU({
    max: 500,
    // according to https://cloud.ibm.com/docs/iam?topic=iam-iamtoken_from_apikey#iamtoken_from_apikey
    //  tokens are only valid for 1 hour
    ttl: constants.ONE_HOUR,
});


export function init() {
    accessTokensCache.clear();
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
    const token = accessTokensCache.get(apikey) as BluemixToken;
    if (token && token.expiry_timestamp > Date.now()) {
        return token.access_token;
    }
}
