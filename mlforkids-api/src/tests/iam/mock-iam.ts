import * as assert from 'assert';
import * as randomstring from 'randomstring';
import { RequestError } from '../../lib/utils/request';

export const KEYS = {
    FAIL : 'FAILFAILFAILFAILFAILFAILFAILFAILFAILFAILFAIL',
    INVALID : 'pLSOMEOkQCaZce7tLvZu3xOCxSCkcuXDDwYnSWFfhtcc',

    VALID :      'xSCkcuXCCwYnSWFfhtcUpLSOLBWkQCaZnb7tKvZu8xOC',
    VALID_RAND : 'VALIDRANDOMVALIDRANDOMVALIDRANDOMVALID',
};


export const fetch = {
    post : async (url: string | URL | Request, init?: RequestInit) => {
        const body = init?.body as string;
        const params = new URLSearchParams(body);
        const apikey = params.get('apikey');

        switch (apikey) {
        case KEYS.VALID:
            return Promise.resolve(new Response(
                JSON.stringify({
                    access_token: 'I am a valid access token',
                    refresh_token: 'I am a valid refresh token',
                    token_type: 'Bearer',
                    expires_in: 3600,
                    expiration: Math.round(Date.now() / 1000) + 3600,
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                },
            ));
        case KEYS.INVALID: {
            return Promise.resolve(new Response(
                JSON.stringify({
                    context : {
                        requestId: '1074110915',
                    },
                    errorCode: 'BXNIM0415E',
                    errorMessage: 'Provided API key could not be found',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                },
            ));
        }
        case KEYS.FAIL: {
            const cause = new Error('getaddrinfo ENOTFOUND iam.bluemix.net iam.bluemix.net:443');
            (cause as any).code = 'ENOTFOUND';
            (cause as any).errno = 'ENOTFOUND';
            (cause as any).syscall = 'getaddrinfo';

            return Promise.reject(new RequestError(cause, { json: true }));
        }
        default:
            if (apikey && apikey.startsWith(KEYS.VALID_RAND)) {
                return Promise.resolve(new Response(
                    JSON.stringify({
                        access_token: randomstring.generate(1305),
                        refresh_token: randomstring.generate(984),
                        token_type: 'Bearer',
                        expires_in: 3600,
                        expiration: Math.round(Date.now() / 1000) + 3600,
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                ));
            }
            else {
                assert.fail('Unexpected');
            }
        }
    },
};

