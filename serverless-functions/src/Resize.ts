// external dependencies
import * as gm from 'gm';
import * as request from 'request';
// internal dependencies
import { ResizeParams, isANonEmptyString } from './Requests';
import { HtmlResponse } from './Responses';
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

export default function main(params: ResizeParams): Promise<HtmlResponse> {

    return new Promise((resolve) => {
        // check the request is safe to use
        const isValid = isANonEmptyString(params.url);
        if (!isValid) {
            return resolve(new HtmlResponse({ error : 'url is a required parameter' },
                                            BAD_REQUEST));
        }

        // resize image
        const url = params.url;
        const downloadStream = request.get({ ...REQUEST_OPTIONS, url });
        gm(downloadStream)
            .resize(224, 224, IGNORE_ASPECT_RATIO)
            .toBuffer('PNG', (err, buffer) => {
                if (err) {
                    console.log(err);
                    return resolve(new HtmlResponse({ error : err.message }, ERROR));
                }
                return resolve(new HtmlResponse(buffer.toString('base64'),
                                                OK, MimeTypes.ImagePng));
            });
    });
}
(<any>global).main = main;
