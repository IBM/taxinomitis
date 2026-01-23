// local dependencies
import loggerSetup from './logger';


const log = loggerSetup();

type HttpVerb = 'HEAD' | 'GET' | 'PUT' | 'POST' | 'DELETE';

export interface RequestPromiseOptions {
    json?: boolean;
    gzip?: boolean;
    timeout?: number;
    qs?: Record<string, any>;
    headers?: Record<string, string>;
    auth?: {
        user: string | undefined;
        pass: string | undefined;
    };
    form?: Record<string, any>;
    formData?: Record<string, {
        value: string | Buffer;
        options?: {
            filename?: string;
            contentType?: string;
        };
    }>;
    body?: any;
    resolveWithFullResponse?: boolean;
}

export class RequestError extends Error {
    name = 'RequestError';
    cause: any;
    error: any;
    options: RequestPromiseOptions;
    response?: Response;

    constructor(cause: any, options: RequestPromiseOptions, response?: Response) {
        super(cause.message || 'Request failed');
        this.cause = cause;
        this.error = cause;
        this.options = options;
        this.response = response;
        Object.setPrototypeOf(this, RequestError.prototype);
    }
}

export class StatusCodeError extends Error {
    name = 'StatusCodeError';
    statusCode: number;
    error: any;
    options: RequestPromiseOptions;
    response: Response;

    constructor(statusCode: number, body: any, options: RequestPromiseOptions, response: Response) {
        super(`${statusCode} - ${JSON.stringify(body)}`);
        this.statusCode = statusCode;
        this.error = body;
        this.options = options;
        this.response = response;
        Object.setPrototypeOf(this, StatusCodeError.prototype);
    }
}

export function isTimeoutErrorCode(code?: string): boolean {
    if (code) {
        return code === 'ETIMEDOUT' ||
               code === 'ESOCKETTIMEDOUT' ||
               code === 'ECONNRESET';
    }
    return false;
}


/**
 * Checks an exception to see if the root cause was a timeout.
 * We check this so we can retry for such errors.
 *
 * @param err
 * @returns true if the exception looks like it was caused by a timeout
 */
function isTimeoutError(err: RequestError): boolean {
    if (err &&
        err.cause &&
        err.cause.code)
    {
        return isTimeoutErrorCode(err.cause.code);
    }
    return false;
}


function buildUrl(url: string, qs?: Record<string, any>): string {
    if (!qs || Object.keys(qs).length === 0) {
        return url;
    }
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(qs)) {
        params.append(key, String(value));
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${params.toString()}`;
}


async function buildFetchOptions(method: HttpVerb, opts: RequestPromiseOptions): Promise<RequestInit> {
    const headers: Record<string, string> = {
        ...opts.headers,
    };
    let body: string | FormData | undefined;

    if (opts.auth && opts.auth.user && opts.auth.pass) {
        const credentials = Buffer.from(`${opts.auth.user}:${opts.auth.pass}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
    }

    if (opts.gzip) {
        headers['Accept-Encoding'] = 'gzip, deflate';
    }

    if (opts.formData) {
        const formData = new FormData();
        for (const [key, field] of Object.entries(opts.formData)) {
            const blob = new Blob([field.value], {
                type: field.options?.contentType || 'application/octet-stream',
            });
            formData.append(key, blob, field.options?.filename);
        }
        body = formData;
        // Don't set Content-Type header - let fetch set it with boundary
    }
    else if (opts.form) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(opts.form)) {
            params.append(key, String(value));
        }
        body = params.toString();
    }
    else if (opts.body) {
        if (opts.json) {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(opts.body);
        }
        else {
            body = opts.body;
        }
    }

    if (opts.json && !headers['Accept']) {
        headers['Accept'] = 'application/json';
    }

    const fetchOptions: RequestInit = { method, headers, body };

    if (opts.timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), opts.timeout);
        fetchOptions.signal = controller.signal;
        (fetchOptions as any)._timeoutId = timeoutId;
    }

    return fetchOptions;
}


async function executeFetch(url: string, fetchOptions: RequestInit, opts: RequestPromiseOptions): Promise<any> {
    let response: Response;

    try {
        response = await fetch(url, fetchOptions);
    }
    catch (err: any) {
        if ((fetchOptions as any)._timeoutId) {
            clearTimeout((fetchOptions as any)._timeoutId);
        }

        if (err.cause) {
            throw err.cause;
        }

        if (err.name === 'AbortError') {
            const timeoutError = new Error('ESOCKETTIMEDOUT');
            (timeoutError as any).code = 'ESOCKETTIMEDOUT';
            throw new RequestError(timeoutError, opts);
        }

        const networkError = new Error(err.message || 'Network request failed');
        (networkError as any).code = err.code || 'ECONNRESET';
        throw new RequestError(networkError, opts);
    }

    // Clean up timeout if it exists
    if ((fetchOptions as any)._timeoutId) {
        clearTimeout((fetchOptions as any)._timeoutId);
    }

    // error response
    if (!response.ok) {
        let errorBody: any;
        const contentType = response.headers.get('content-type');

        if (opts.json || (contentType && contentType.includes('application/json'))) {
            try {
                errorBody = await response.json();
            }
            catch {
                errorBody = await response.text();
            }
        }
        else {
            errorBody = await response.text();
        }

        throw new StatusCodeError(response.status, errorBody, opts, response);
    }

    // successful response
    if (opts.json) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        const text = await response.text();
        if (text) {
            try {
                return JSON.parse(text);
            }
            catch {
                return text;
            }
        }
        return text;
    }

    return response.text();
}







async function makeRequest(method: HttpVerb, url: string, opts: RequestPromiseOptions): Promise<any> {
    const fullUrl = buildUrl(url, opts.qs);
    const fetchOptions = await buildFetchOptions(method, opts);
    return executeFetch(fullUrl, fetchOptions, opts);
}




// --- exported functions



export function head(url: string, opts: RequestPromiseOptions) {
    return makeRequest('HEAD', url, opts);
}

export function get(url: string, opts: RequestPromiseOptions) {
    return makeRequest('GET', url, opts)
        .catch((err) => {
            if (isTimeoutError(err)) {
                log.debug({ url, err, code : err.cause.code }, 'Retrying request after timeout');
                return makeRequest('GET', url, opts);
            }
            else {
                throw err;
            }
        });
}

export function post(url: string, opts: RequestPromiseOptions, retryOnTimeout: boolean) {
    return makeRequest('POST', url, opts)
        .catch((err) => {
            if (retryOnTimeout && isTimeoutError(err)) {
                log.debug({ url, err, code : err.cause.code }, 'Retrying request after timeout');
                return makeRequest('POST', url, opts);
            }
            else {
                throw err;
            }
        });
}

export function del(url: string, opts: RequestPromiseOptions) {
    return makeRequest('DELETE', url, opts);
}

