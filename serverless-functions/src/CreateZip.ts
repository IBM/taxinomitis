// internal dependencies
import * as downloader from './Downloader';
import ImageStore from './ImageStore';
import { HttpResponse } from './Responses';
import { CreateZipParams, validate } from './Requests';
import { OK, BAD_REQUEST, ERROR } from './StatusCodes';
import * as MimeTypes from './MimeTypes';



export default function main(params: CreateZipParams): Promise<HttpResponse> {
    // check the request is safe to use
    const isValid = validate(params);
    if (!isValid) {
        return Promise.resolve(new HttpResponse({ error : 'Invalid request payload' }, BAD_REQUEST));
    }

    // connect to image store
    const store = new ImageStore(params.imagestore);
    store.connect();
    return downloader.run(store, params.locations)
        .then((zipFileData) => {
            return new HttpResponse(zipFileData, OK, MimeTypes.ZipData);
        })
        .catch((err) => {
            const errorPayload = { error : err.message } as any;
            if (err.location) {
                errorPayload.location = err.location;
            }
            return new HttpResponse(errorPayload, ERROR, {
                'X-MachineLearningForKids-Error' : JSON.stringify(errorPayload),
            });
        });
}

(<any>global).main = main;
