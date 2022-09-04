// external dependencies
import * as gm from 'gm';
import * as request from 'request';
// internal dependencies
import { ResizeParams, isANonEmptyString } from './Requests';
import { HttpResponse } from './Responses';
import { downloadTooBig } from './Rules';
import { OK, BAD_REQUEST, ERROR } from './StatusCodes';
import * as MimeTypes from './MimeTypes';
import { log } from './Debug';

import * as fs from 'fs';

// standard options for downloading images
const REQUEST_OPTIONS = {
    followRedirect : true,
    timeout : 8000,
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


// imagemagick option
const IGNORE_ASPECT_RATIO = '!';


export default function main(params: ResizeParams): Promise<HttpResponse> {

    return new Promise((resolve) => {
        // check the request is safe to use
        const isValid = isANonEmptyString(params.url);
        if (!isValid) {
            log('invalid request', params);
            return resolve(new HttpResponse({ error : 'url is a required parameter' },
                                            BAD_REQUEST));
        }

        // resize image
        const url = params.url;
        log('url', url);
        requestAndResize(url, (resp) => {
            if (resp.statusCode === OK) {
                return resolve(resp);
            }

            log('retrying', url);
            requestAndResize(url, resolve);
        });
    });
}



function requestAndResize(url: string, callback: (resp: HttpResponse) => void): void {
    request.get({ ...REQUEST_OPTIONS, url })
        .on('error', (err) => {
            log('resize error', err);
            return callback(handleError(err));
        })
        .on('response', (downloadStream) => {
            const commonProblem = recognizeCommonProblems(downloadStream);
            if (commonProblem) {
                log('recognized problem', commonProblem);
                callback(commonProblem);
                return downloadStream.destroy();
            }

            gm(downloadStream)
                .resize(224, 224, IGNORE_ASPECT_RATIO)
                .toBuffer('png', (err, buffer) => {
                    if (err) {
                        log('resize problem', err);
                        return callback(handleError(err));
                    }

                    log('success');
                    callback(new HttpResponse(buffer.toString('base64'),
                                              OK, MimeTypes.ImagePng));
                });
        });
}


const GOOGLE_IMAGE_HOST_REGEX = /^lh[1-9]\.google(?:usercontent)?\.com$/;
function isGoogleFilesUrl(hostname: string): boolean {
    return GOOGLE_IMAGE_HOST_REGEX.test(hostname);
}


function getHostName(req: request.Request): string {
    if (isGoogleFilesUrl(req.host)) {
        return 'Google';
    }
    return req.host;
}



function handleErrorResponse(err: request.Response): HttpResponse {
    log('ERROR response : ' + err.statusCode);
    if (err.statusCode === 404) {
        return new HttpResponse({ error : 'Unable to download image from ' + err.request.host }, BAD_REQUEST);
    }
    if (err.statusCode === 401 || err.statusCode === 403) {
        return new HttpResponse({ error : getHostName(err.request) +
                                          ' would not allow "Machine Learning for Kids" to use that image' },
                                BAD_REQUEST);
    }
    log('resize handleErrorResponse', err);
    if (err.statusCode === 500) {
        return new HttpResponse({ error : 'Unable to download image from ' + err.request.host }, BAD_REQUEST);
    }

    return new HttpResponse({ error : 'Unable to download image from ' + err.request.host }, ERROR);
}



function handleError(err: any): HttpResponse {
    log('resize handleError', err);
    if (err.message === 'Stream yields empty buffer') {
        return new HttpResponse({ error : 'Unsupported image file type' }, BAD_REQUEST);
    }
    if (err.message === 'ESOCKETTIMEDOUT' || err.message === 'ETIMEDOUT') {
        return new HttpResponse({ error : 'Unable to download image from the website' }, BAD_REQUEST);
    }
    if (err.code === 'ENOTFOUND') {
        return new HttpResponse({ error : 'Unable to download image from ' + err.hostname }, BAD_REQUEST);
    }
    if (err.code === 'ECONNRESET') {
        return new HttpResponse({ error : 'Unable to download image from ' + err.host }, BAD_REQUEST);
    }
    return new HttpResponse({ error : err.message }, ERROR);
}



function recognizeCommonProblems(response: request.Response): HttpResponse | undefined {

    if (response.statusCode === 400 &&
        response.headers &&
        response.headers['content-type'] &&
        response.headers['content-type'].startsWith('text/html') &&
        response.request.uri.href.startsWith('https://accounts.google.com/ServiceLogin?continue='))
    {
        return new HttpResponse({
            error : 'Google would not allow "Machine Learning for Kids" to use that image',
        }, BAD_REQUEST);
    }

    if (response.statusCode >= 400) {
        return handleErrorResponse(response);
    }

    if (downloadTooBig(response.headers)) {
        return new HttpResponse({
            'error' : 'Image size exceeds maximum limit',
            'content-length' : response.headers['content-length'],
        }, BAD_REQUEST);
    }
}


(<any>global).main = main;
