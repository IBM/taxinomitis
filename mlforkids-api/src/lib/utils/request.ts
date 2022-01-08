// external dependencies
import * as requestcore from 'request';
import * as request from 'request-promise';
import * as requestErrors from 'request-promise/errors';
import * as Agent from 'agentkeepalive';

// local dependencies
import loggerSetup from './logger';


const log = loggerSetup();

const httpsAgentKeepAlive = new Agent.HttpsAgent();
const httpAgentKeepAlive = new Agent();


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

/**
 * Returns a modified version of the provided request options, to
 * override the default HTTP agent, replacing it with one that will
 * reuse connections.
 *
 * @param url - URL that the request is being made to, to allow the correct agent to be chosen
 * @param opts - request options (will not be modified)
 * @returns modified version of provided opts
 */
function reuseConnections(url: string, opts: request.RequestPromiseOptions): request.RequestPromiseOptions {
    return {
        ...opts,
        agent : url.startsWith('https') ? httpsAgentKeepAlive : httpAgentKeepAlive,
    };
}


export function head(url: string, opts: request.RequestPromiseOptions) {
    const optionsWithReuse = reuseConnections(url, opts);
    return request.head(url, optionsWithReuse);
}

export function get(url: string, opts: request.RequestPromiseOptions) {
    const optionsWithReuse = reuseConnections(url, opts);
    return request.get(url, optionsWithReuse)
        .catch((err) => {
            if (isTimeoutError(err)) {
                log.debug({ url, err, code : err.cause.code }, 'Retrying request after timeout');
                return request.get(url, optionsWithReuse);
            }
            else {
                throw err;
            }
        });
}

export function post(url: string, opts: request.RequestPromiseOptions, retryOnTimeout: boolean) {
    const optionsWithReuse = reuseConnections(url, opts);
    return request.post(url, optionsWithReuse)
        .catch((err) => {
            if (retryOnTimeout && isTimeoutError(err)) {
                log.debug({ url, err, code : err.cause.code }, 'Retrying request after timeout');
                return request.post(url, optionsWithReuse);
            }
            else {
                throw err;
            }
        });
}

export function del(url: string, opts: request.RequestPromiseOptions) {
    const optionsWithReuse = reuseConnections(url, opts);
    return request.delete(url, optionsWithReuse);
}

export function getStreaming(opts: requestcore.UrlOptions) {
    return requestcore.get({
        ...opts,
        agent : typeof opts.url === 'string' && opts.url.startsWith('https') ? httpsAgentKeepAlive : httpAgentKeepAlive,
    });
}

