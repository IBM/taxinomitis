// core dependencies
import * as fs from 'fs';
import { IncomingHttpHeaders } from 'http';
// external dependencies
import * as requestcore from 'request';
import * as httpstatus from 'http-status';
import * as sharp from 'sharp';
import * as probe from 'probe-image-size';
// local dependencies
import * as request from './request';
import loggerSetup from './logger';

const log = loggerSetup();



// number of times an image download has been attempted
let numDownloads = 0;
// number of failures to download an image
let numErrors = 0;


type IErrCallback = (err?: Error) => void;


// disable aggressive use of memory for caching
sharp.cache(false);
// prevent sharp using multiple cores in parallel to reduce memory use
sharp.concurrency(1);

// standard options for downloading images
const REQUEST_OPTIONS = {
    timeout : 20000,
    rejectUnauthorized : false,
    strictSSL : false,
    gzip : true,
    insecureHTTPParser : true,
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
};

const RESIZE_OPTIONS = {
    // skew, don't crop, when resizing
    fit : 'fill',
} as sharp.ResizeOptions;



interface CustomError extends Error {
    canReturn?: boolean;
    code?: string;
}


/**
 * Downloads a file from the specified URL to the specified location on disk.
 *
 * @param url  - downloads from
 * @param targetFilePath  - writes to
 */
export function file(url: string, targetFilePath: string, callback: IErrCallback): void {
    // first attempt
    performFileDownload(url, targetFilePath, (err) => {
        if (err) {
            const reqError = err as CustomError;

            // something went wrong - check if the problem is retriable
            if (err.message && request.isTimeoutErrorCode(reqError.code || err.message)) {

                // will retry after brief pause
                log.debug({ url, code : err.message, numDownloads, numErrors }, 'Retrying download');
                return setTimeout(() => {

                    // second attempt
                    performFileDownload(url, targetFilePath, (retryErr) => {
                        if (retryErr) {
                            // failed after second attempt
                            return reportDownloadFailure(url, retryErr, callback);
                        }

                        // second attempt was successful
                        log.debug({ url }, 'retrying seemed to help');
                        callback();
                    });
                }, 500);
            }

            // problem does not look retriable - report failure immediately
            return reportDownloadFailure(url, reqError, callback);
        }
        else {
            // first attempt successful
            callback();
        }
    });
}

function reportDownloadFailure(url: string, err: CustomError, callback: IErrCallback): void {
    if (err.canReturn) {
        log.debug({ err, url, numDownloads, numErrors }, 'download failure (for recognized reason)');
        callback(err);
    }
    else {
        log.error({ err, url, numDownloads, numErrors }, 'download failure');
        callback(new Error(ERRORS.DOWNLOAD_FAIL + url));
    }
}

function performFileDownload(url: string, targetFilePath: string, callback: IErrCallback): void {

    // local inner function used to avoid calling callback multiple times
    let resolved = false;
    function resolve(err?: Error) {
        if (resolved === false) {
            resolved = true;
            return callback(err);
        }
    }

    const writeStream = fs.createWriteStream(targetFilePath)
                            .on('error', resolve)
                            .on('finish', resolve);

    try {
        numDownloads += 1;

        const opts = { ...REQUEST_OPTIONS, url };
        request.getStreaming(opts)
            .on('response', (r) => {
                // request doesn't emit errors for unsuccessful status codes
                //  so we check for status codes that look like errors here
                const problem = recognizeCommonProblems(r, url);
                if (problem) {
                    const customErr = problem as CustomError;
                    customErr.canReturn = true;

                    resolve(customErr);
                    return r.destroy();
                }
            })
            .on('error', (err) => {
                numErrors += 1;
                log.debug({ err, url }, 'request get fail');
                resolve(err);
            })
            .pipe(writeStream);
    }
    catch (err) {
        log.debug({ err, url }, 'Failed to download file');
        resolve(err);
    }
}



function recognizeCommonProblems(response: requestcore.Response, url: string): Error | undefined
{
    if (response.statusCode >= 400) {
        if (response.statusCode === httpstatus.FORBIDDEN ||
            response.statusCode === httpstatus.UNAUTHORIZED)
        {
            return new Error(safeGetHost(url) + ERRORS.DOWNLOAD_FORBIDDEN);
        }
        else if (response.statusCode === httpstatus.NOT_FOUND || response.statusCode === httpstatus.INTERNAL_SERVER_ERROR)
        {
            return new Error(ERRORS.DOWNLOAD_FAIL + url);
        }

        numErrors += 1;
        log.error({ statusCode : response.statusCode, url, numDownloads, numErrors }, 'Failed to request url');
        return new Error(ERRORS.DOWNLOAD_FAIL + url);
    }

    if (downloadTooBig(response.headers)) {
        return new Error(ERRORS.DOWNLOAD_TOO_BIG);
    }

    if (response.headers['content-type'] &&
        response.headers['content-type'].startsWith('text/html') &&
        response.request.uri.href.startsWith('https://accounts.google.com/ServiceLogin?continue='))
    {
        return new Error('Google' + ERRORS.DOWNLOAD_FORBIDDEN);
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




/**
 * Downloads a file from the specified URL to the specified location on disk.
 *
 * @param url  - downloads from
 * @param width - width (in pixels) to resize the image to
 * @param height - height (in pixels) to resize the image to
 * @param targetFilePath  - writes to
 */
export function resize(
    url: string,
    width: number, height: number,
    targetFilePath: string,
    callback: IErrCallback,
): void
{
    // local inner function used to avoid calling callback multiple times
    let resolved = false;
    function resolve(err?: Error) {
        if (resolved === false) {
            resolved = true;
            return callback(err);
        }
    }

    probe(url, { rejectUnauthorized : false })
        .then((imageinfo: any) => {
            if (imageinfo.type !== 'jpg' && imageinfo.type !== 'jpeg' && imageinfo.type !== 'png') {
                log.error({ imageinfo, url }, 'Unexpected file type');
                throw new Error('Unsupported file type ' + imageinfo.type);
            }

            const shrinkStream = sharp()
                                    // resize before writing to disk
                                    .resize(width, height, RESIZE_OPTIONS)
                                    .on('error', resolve)
                                    // write to file using the same image
                                    //  format (i.e. jpg vs png) as the
                                    //  original
                                    .toFile(targetFilePath, resolve);

            request.getStreaming({ ...REQUEST_OPTIONS, url })
                .on('error', (err) => {
                    log.warn({ err, url }, 'Download fail (request)');
                    resolve(new Error(ERRORS.DOWNLOAD_FAIL + url));
                })
                .pipe(shrinkStream);
        })
        .catch ((err: any) => {
            if (err.statusCode === httpstatus.NOT_FOUND || err.message === 'ETIMEDOUT') {
                log.warn({ err, url }, 'Image could not be downloaded');
            }
            else if (err.statusCode === httpstatus.FORBIDDEN || err.statusCode === httpstatus.UNAUTHORIZED) {
                log.warn({ err, url }, 'Image download was forbidden');
                return resolve(new Error(safeGetHost(url) + ERRORS.DOWNLOAD_FORBIDDEN));
            }
            else {
                log.error({ err, url }, 'Download fail (probe)');
            }
            resolve(new Error(ERRORS.DOWNLOAD_FAIL + url));
        });
}


export function resizeUrl(url: string, width: number, height: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const shrinkStream = sharp()
                                .resize(width, height, RESIZE_OPTIONS)
                                .on('error', reject)
                                .toBuffer((err, buff) => {
                                    if (err) {
                                        if (err.message === 'Input buffer contains unsupported image format') {
                                            return reject(new Error(ERRORS.DOWNLOAD_FILETYPE_UNSUPPORTED));
                                        }
                                        return reject(err);
                                    }
                                    return resolve(buff);
                                });

        request.getStreaming({ ...REQUEST_OPTIONS, url })
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
};
