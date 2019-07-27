// external dependencies
import * as gm from 'gm';
import * as request from 'request';
// internal dependencies
import { ResizeParams, isANonEmptyString } from './Requests';
import { HttpResponse } from './Responses';
import { downloadTooBig } from './Rules';
import { OK, BAD_REQUEST, ERROR } from './StatusCodes';
import * as MimeTypes from './MimeTypes';

// standard options for downloading images
const REQUEST_OPTIONS = {
    timeout : 10000,
    rejectUnauthorized : false,
    strictSSL : false,
    gzip : true,
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
            return resolve(new HttpResponse({ error : 'url is a required parameter' },
                                            BAD_REQUEST));
        }

        // resize image
        const url = params.url;
        request.get({ ...REQUEST_OPTIONS, url })
            .on('error', (err) => {
                return resolve(handleError(err));
            })
            .on('response', (downloadStream) => {
                if (downloadStream.statusCode >= 400) {
                    resolve(handleErrorResponse(downloadStream));

                    return downloadStream.destroy();
                }
                if (downloadTooBig(downloadStream.headers))
                {
                    resolve(new HttpResponse({
                        'error' : 'Image size exceeds maximum limit',
                        'content-length' : downloadStream.headers['content-length'],
                    }, BAD_REQUEST));

                    return downloadStream.destroy();
                }

                gm(downloadStream)
                    .resize(224, 224, IGNORE_ASPECT_RATIO)
                    .toBuffer('png', (err, buffer) => {
                        if (err) {
                            return resolve(handleError(err));
                        }
                        return resolve(new HttpResponse(buffer.toString('base64'),
                                                        OK, MimeTypes.ImagePng));
                    });
            });
    });
}


function handleErrorResponse(err: request.Response): HttpResponse {
    if (err.statusCode === 404) {
        return new HttpResponse({ error : 'Unable to download image from ' + err.request.host }, BAD_REQUEST);
    }
    if (err.statusCode === 401 || err.statusCode === 403) {
        return new HttpResponse({ error : err.request.host +
                                          ' would not allow "Machine Learning for Kids" to use that image' },
                                BAD_REQUEST);
    }
    if (err.statusCode === 500) {
        return new HttpResponse({ error : 'Unable to download image from ' + err.request.host }, BAD_REQUEST);
    }

    console.log('resize handleErrorResponse', err);
    return new HttpResponse({ error : 'Unable to download image from ' + err.request.host }, ERROR);
}


function handleError(err: any): HttpResponse {
    if (err.message === 'Stream yields empty buffer') {
        return new HttpResponse({ error : 'Unsupported image file type' }, BAD_REQUEST);
    }
    if (err.errno === 'ENOTFOUND') {
        return new HttpResponse({ error : 'Website ' + err.hostname + ' could not be found' }, BAD_REQUEST);
    }
    console.log('resize handleError', err);
    return new HttpResponse({ error : err.message }, ERROR);
}


(<any>global).main = main;
