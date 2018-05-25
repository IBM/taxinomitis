import * as assert from 'assert';
import * as randomstring from 'randomstring';

export const KEYS = {
    FAIL : 'FAILFAILFAILFAILFAILFAILFAILFAILFAILFAILFAIL',
    INVALID : 'pLSOMEOkQCaZce7tLvZu3xOCxSCkcuXDDwYnSWFfhtcc',

    VALID :      'xSCkcuXCCwYnSWFfhtcUpLSOLBWkQCaZnb7tKvZu8xOC',
    VALID_RAND : 'VALIDRANDOMVALIDRANDOMVALIDRANDOMVALID',
};


export const request = {
    get : (url: string, options: any) => {
        switch (options.form.apikey) {
        case KEYS.VALID:
            return Promise.resolve({
                access_token: 'I am a valid access token',
                refresh_token: 'I am a valid refresh token',
                token_type: 'Bearer',
                expires_in: 3600,
                expiration: Math.round(Date.now() / 1000) + 3600,
            });
        case KEYS.INVALID:
            return Promise.reject({
                statusCode : 400,
                name: 'StatusCodeError',
                // tslint:disable-next-line:max-line-length
                message: '400 - {"context":{"requestId":"1074110915","requestType":"incoming.Identity_Token","userAgent":"Go-http-client/1.1","clientIp":"87.113.84.91","url":"https://iam-id-2.eu-gb.bluemix.net","instanceId":"iamid-696d69f4b-qv76s","threadId":"4a5362","host":"iamid-696d69f4b-qv76s","startTime":"24.05.2018 16:52:22:067 UTC","endTime":"24.05.2018 16:52:22:144 UTC","elapsedTime":"77","locale":"en_US","clusterName":"iam-id-prlon04-6r67"},"errorCode":"BXNIM0415E","errorMessage":"Provided API key could not be found"}',
                error: {
                    context : {
                        requestId: '1074110915',
                    },
                    errorCode: 'BXNIM0415E',
                    errorMessage: 'Provided API key could not be found',
                },
            });
        case KEYS.FAIL:
            return Promise.reject({
                name: 'RequestError',
                message: 'Error: getaddrinfo ENOTFOUND iam.bluemix.net iam.bluemix.net:443',
                error: {
                    code: 'ENOTFOUND',
                    errno: 'ENOTFOUND',
                    syscall: 'getaddrinfo',
                },
            });
        default:
            if (options.form.apikey.startsWith(KEYS.VALID_RAND)) {
                return Promise.resolve({
                    access_token: randomstring.generate(1305),
                    refresh_token: randomstring.generate(984),
                    token_type: 'Bearer',
                    expires_in: 3600,
                    expiration: Math.round(Date.now() / 1000) + 3600,
                });
            }
            else {
                assert.fail('Unexpected');
            }
        }
    },
};

