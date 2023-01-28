// external dependencies
import * as request from 'request-promise';
import * as requestErrors from 'request-promise/errors';

// local dependencies
import loggerSetup from './logger';


const log = loggerSetup();

export function isTimeoutErrorCode(code?: string): boolean {
    if (code) {
        return code === 'ETIMEDOUT' ||
               code === 'ESOCKETTIMEDOUT' ||
               code === 'ECONNRESET';
    }
    return false;
}


/**
 * Checks an exception thrown by request-promise to see if the
 * root cause was a timeout. We check this so we can retry for
 * such errors.
 *
 * @param err
 * @returns true if the exception looks like it was caused by a timeout
 */
function isTimeoutError(err: requestErrors.RequestError): boolean {
    if (err &&
        err.cause &&
        err.cause.code)
    {
        return isTimeoutErrorCode(err.cause.code);
    }
    return false;
}


export function head(url: string, opts: request.RequestPromiseOptions) {
    return request.head(url, opts);
}

export function get(url: string, opts: request.RequestPromiseOptions) {
    return request.get(url, opts)
        .catch((err) => {
            if (isTimeoutError(err)) {
                log.debug({ url, err, code : err.cause.code }, 'Retrying request after timeout');
                return request.get(url, opts);
            }
            else {
                throw err;
            }
        });
}

export function post(url: string, opts: request.RequestPromiseOptions, retryOnTimeout: boolean) {
    return request.post(url, opts)
        .catch((err) => {
            if (retryOnTimeout && isTimeoutError(err)) {
                log.debug({ url, err, code : err.cause.code }, 'Retrying request after timeout');
                return request.post(url, opts);
            }
            else {
                throw err;
            }
        });
}

export function del(url: string, opts: request.RequestPromiseOptions) {
    return request.delete(url, opts);
}


