// internal dependencies
import * as util from 'util';
import * as downloader from './Downloader';
import ImageStore from './ImageStore';
import { HttpResponse } from './Responses';
import { CreateZipParams, validate } from './Requests';
import { OK, BAD_REQUEST, ERROR } from './StatusCodes';
import * as MimeTypes from './MimeTypes';
import { log } from './Debug';



export default function main(params: CreateZipParams): Promise<HttpResponse> {
    // check the request is safe to use
    const isValid = validate(params);
    if (!isValid) {
        log('invalid request', util.inspect(params, { depth : null }));
        return Promise.resolve(new HttpResponse({ error : 'Invalid request payload' }, BAD_REQUEST));
    }

    // connect to image store
    const store = new ImageStore(params.imagestore);
    store.connect();
    return downloader.run(store, params.locations)
        .then((zipFileData) => {
            log('SUCCESS - returning zip data');
            return new HttpResponse(zipFileData, OK, MimeTypes.ZipData);
        })
        .catch((err) => {
            log('FAILURE');
            log(err);

            const errorPayload = { error : err.message } as any;
            if (err.location) {
                errorPayload.location = err.location;
            }
            let status = ERROR;
            if (err.statusCode) {
                status = err.statusCode;
            }
            return new HttpResponse(errorPayload, status, {
                'X-MachineLearningForKids-Error' : JSON.stringify(errorPayload),
            });
        });
}

(<any>global).main = main;
