// external dependencies
import * as Express from 'express';
import * as httpStatus from 'http-status';
// local dependencies
import * as auth from '../auth';
import * as store from '../../objectstore';
import * as parse from './urlparse';
import * as urls from '../urls';
import * as headers from '../headers';



/**
 * Sets up API required to allow image downloads.
 */
export default function registerApis(app: Express.Application) {

    // register route handler
    app.get(urls.IMAGE,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectAccessOrTeacher,
            handleDownload);
}



async function handleDownload(req: Express.Request, res: Express.Response) {
    try {
        const image = await store.getImage(parse.imageUrl(req));

        //
        // set headers dynamically based on the image we've fetched
        //

        res.setHeader('Content-Type', image.filetype);

        if (image.modified) {
            res.setHeader('Last-Modified', image.modified);
        }
        if (image.etag) {
            res.setHeader('ETag', image.etag);
        }

        // This is slow, so encourage browsers to aggressively
        //  cache the images rather than repeatedly download them
        // (This is safe as we don't allow images to be modified,
        //  so it's okay to treat them as immutable).
        res.set(headers.CACHE_1YEAR);


        res.send(image.body);
    }
    catch (err) {
        return returnDownloadError(res, err);
    }
}




function returnDownloadError(res: Express.Response, err: Error) {
    if (err.message === 'The specified key does not exist.') {
        return res.status(httpStatus.NOT_FOUND).json({
            error : 'File not found',
        });
    }

    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        error : err.message,
        details : err,
    });
}
