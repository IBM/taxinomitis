// internal dependencies
import * as downloader from './Downloader';
import ImageStore from './ImageStore';
import { HtmlResponse }from './Responses';
import { CreateZipParams, validate } from './Requests';
import { OK, BAD_REQUEST, ERROR } from './StatusCodes';
import * as MimeTypes from './MimeTypes';



export default function main(params: CreateZipParams): Promise<HtmlResponse> {
    // check the request is safe to use
    const isValid = validate(params);
    if (!isValid) {
        return Promise.resolve(new HtmlResponse({ error : 'Invalid request payload' }, BAD_REQUEST));
    }

    // connect to image store
    const store = new ImageStore(params.imagestore);
    store.connect();
    return downloader.run(store, params.locations)
        .then((zipFileData) => {
            return new HtmlResponse(zipFileData, OK, MimeTypes.ZipData);
        })
        .catch((err) => {
            return new HtmlResponse({ error : err.message }, ERROR);
        });
}

(<any>global).main = main;
