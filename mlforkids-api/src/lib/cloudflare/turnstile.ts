// local dependencies
import * as env from '../utils/env';
import loggerSetup from '../utils/logger';

const log = loggerSetup();




export function validate(token: string): Promise<boolean> {
    if (!token || typeof token !== 'string' || token.length === 0 || token.length > 2048) {
        // invalid token
        log.error({ token }, 'Invalid turnstile token');
        return Promise.resolve(false);
    }

    // adapted from https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
    const payload: TurnstileRequest = {
        response: token,
        secret: process.env[env.CLOUDFLARE_TURNSTILE_SECRET_KEY] as string,
    };
    const fetchReq = {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
            'user-agent': 'machinelearningforkids',
        },
        body: JSON.stringify(payload),
    };
    return fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', fetchReq)
        .then((resp) => {
            return resp.json() as Promise<TurnstileResponse>;
        })
        .then((result) => {
            return result.success;
        })
        .catch((err) => {
            log.error({ err, token }, 'Turnstile validation error');
            return false;
        });
}



interface TurnstileRequest {
    readonly secret: string;
    readonly response: string;
    readonly remoteip?: string;
    readonly idempotency_key?: string;
}

interface TurnstileResponse {
    readonly success: boolean;
    readonly challenge_ts: string;
    readonly hostname: string;
    readonly 'error-codes': string[];
}
