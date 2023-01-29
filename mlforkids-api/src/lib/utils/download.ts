// core dependencies
import * as fs from 'fs';
import { IncomingHttpHeaders, IncomingMessage } from 'http';
import { pipeline } from 'node:stream';
// external dependencies
import * as httpstatus from 'http-status';
import * as sharp from 'sharp';
import got from 'got';
import * as googleDns from 'mlforkids-google-dns';
// local dependencies
import loggerSetup from './logger';

const log = loggerSetup();


type IErrCallback = (err?: ML4KError) => void;


// disable aggressive use of memory for caching
sharp.cache(false);
// prevent sharp using multiple cores in parallel to reduce memory use
sharp.concurrency(1);

// standard options for downloading images
const REQUEST_OPTIONS = {
    http2 : true,
    dnsCache : true, // replaced once googleDns module has loaded
    timeout : { request : 20000 },
    https : { rejectUnauthorized : false },
    decompress : true,
    headers : {
        // identify source of the request
        //  partly as it's polite and good practice,
        //  partly as some websites block requests that don't specify a user-agent
        'User-Agent': 'machinelearningforkids.co.uk',
        // prefer images if we have a choice
        'Accept': 'image/png,image/jpeg,image/*,*/*',
        // some servers block requests that don't include this
        'Accept-Language': '*',
    },
    throwHttpErrors: false,
};

const RESIZE_OPTIONS = {
    // skew, don't crop, when resizing
    fit : 'fill',
} as sharp.ResizeOptions;


export interface ML4KError extends Error {
    ml4k: boolean;
}


/**
 * Downloads a file from the specified URL to the specified location on disk.
 *
 * @param url  - downloads from
 * @param targetFilePath  - writes to
 */
export function file(url: string, targetFilePath: string, callback: IErrCallback): void {
    // local inner function used to avoid calling callback multiple times
    let resolved = false;
    function resolve(err?: ML4KError) {
        if (resolved === false) {
            resolved = true;
            if (err) {
                return reportDownloadFailure(url, err, callback);
            }
            else {
                return callback();
            }
        }
    }

    // downloading from url
    const readStream = got.stream(url, REQUEST_OPTIONS)
        .on('response', (r: IncomingMessage) => {
            const problem = recognizeCommonProblems(r, url);
            if (problem) {
                resolve(problem);
                r.destroy();
            }
        });
    // writing to file
    const writeStream = fs.createWriteStream(targetFilePath);

    // joining the two streams
    pipeline(readStream, writeStream, (err) => {
        resolve(err as ML4KError);
    });
}



function reportDownloadFailure(url: string, err: ML4KError, callback: IErrCallback): void {
    if (err.ml4k) {
        log.debug({ err, url }, 'download failure (for recognized reason)');
        callback(err);
    }
    else {
        log.error({ err, url }, 'download failure');
        callback(returnAsMl4kError(new Error(ERRORS.DOWNLOAD_FAIL + url)));
    }
}

function returnAsMl4kError(err: Error): ML4KError {
    const modifyErr = err as ML4KError;
    modifyErr.ml4k = true;
    return modifyErr;
}


function recognizeCommonProblems(response: IncomingMessage, url: string): ML4KError | undefined
{
    if (response.statusCode && response.statusCode >= 400) {
        if (response.statusCode === httpstatus.FORBIDDEN ||
            response.statusCode === httpstatus.UNAUTHORIZED)
        {
            return returnAsMl4kError(new Error(safeGetHost(url) + ERRORS.DOWNLOAD_FORBIDDEN));
        }
        else if (response.statusCode === httpstatus.NOT_FOUND || response.statusCode === httpstatus.INTERNAL_SERVER_ERROR)
        {
            return returnAsMl4kError(new Error(ERRORS.DOWNLOAD_FAIL + url));
        }
        else if (response.statusCode === httpstatus.TOO_MANY_REQUESTS)
        {
            return returnAsMl4kError(new Error(safeGetHost(url) + ERRORS.DOWNLOAD_TOO_MANY_REQUESTS));
        }

        log.error({ statusCode : response.statusCode, url }, 'Failed to request url');
        return returnAsMl4kError(new Error(ERRORS.DOWNLOAD_FAIL + url));
    }

    if (downloadTooBig(response.headers)) {
        return returnAsMl4kError(new Error(ERRORS.DOWNLOAD_TOO_BIG));
    }

    if (response.headers['content-type'] &&
        response.headers['content-type'].startsWith('text/html') &&
        response.url && response.url.startsWith('https://accounts.google.com/'))
    {
        return returnAsMl4kError(new Error('Google' + ERRORS.DOWNLOAD_FORBIDDEN));
    }
}



/**
 * Checks if the response headers for an image download suggest the
 * image will be too big to resize
 *
 * @returns true - if the headers suggest the image is too big
 */
export function downloadTooBig(headers: IncomingHttpHeaders): boolean {
    if (headers['content-length']) {
        const sizeStr = headers['content-length'];
        try {
            const sizeInt = parseInt(sizeStr, 10);
            if (sizeInt > 52428800) {
                return true;
            }
        }
        catch (err) {
            log.error({ err, sizeStr }, 'Unable to parse content-length header');
        }
    }

    // assume it's probably okay
    return false;
}


export function resizeUrl(url: string, width: number, height: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const shrinkStream = sharp()
                                .resize(width, height, RESIZE_OPTIONS)
                                .on('error', reject)
                                .toBuffer((err, buff) => {
                                    if (err) {
                                        if (err.message === 'Input buffer contains unsupported image format' ||
                                            err.message.startsWith('Input buffer has corrupt header')) {
                                            return reject(new Error(ERRORS.DOWNLOAD_FILETYPE_UNSUPPORTED));
                                        }
                                        return reject(err);
                                    }
                                    return resolve(buff);
                                });

        got.stream(url, REQUEST_OPTIONS)
            .on('error', (err) => {
                log.warn({ err, url }, 'Download fail');
                return reject(new Error(ERRORS.DOWNLOAD_FAIL + url));
            })
            .pipe(shrinkStream);
    });
}

export function resizeBuffer(imagedata: Buffer, width: number, height: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        sharp(imagedata)
            .resize(width, height, RESIZE_OPTIONS)
            .on('error', reject)
            .toBuffer((err, buff) => {
                if (err) {
                    log.error({ err }, 'Resize fail');
                    return reject(err);
                }
                return resolve(buff);
            });
    });
}



/**
 * Return the host from a full URL. If the provided url string is not a valid
 * URL, return "The website" instead.
 */
function safeGetHost(url: string): string {
    try {
        const parsed = new URL(url);
        return parsed.hostname;
    }
    catch (err) {
        log.debug({ url }, 'Failed to parse url');
        return 'The website';
    }
}


export const ERRORS = {
    DOWNLOAD_FAIL : 'Unable to download image from ',
    DOWNLOAD_FILETYPE_UNSUPPORTED : 'Unsupported image file type',
    DOWNLOAD_FORBIDDEN : ' would not allow "Machine Learning for Kids" to use that image',
    DOWNLOAD_TOO_BIG : 'The image is too big to use. Please choose a different image.',
    DOWNLOAD_TOO_MANY_REQUESTS : ' is receiving too many requests for images and has started refusing access.'
};


log.debug('setting up alternate DNS cache');
googleDns.getCacheableLookup()
    .then((dnsCache: any) => {
        REQUEST_OPTIONS.dnsCache = dnsCache;
        log.info('using Google DNS for downloading images');
    })
    .catch((err: Error) => {
        log.error({ err }, 'Unable to use Google DNS');
    });