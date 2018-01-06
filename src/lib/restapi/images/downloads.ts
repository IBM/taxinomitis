// external dependencies
import * as Express from 'express';
import * as httpStatus from 'http-status';
// local dependencies
import * as auth from '../auth';
import * as store from '../../imagestore';
import * as parse from './urlparse';
import * as urls from '../urls';



/**
 * Sets up API required to allow image downloads.
 */
export default function registerApis(app: Express.Application) {

    // register route handler
    app.get(urls.IMAGE,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectAccess,
            handleDownload);
}



async function handleDownload(req: Express.Request, res: Express.Response) {
    try {
        const image = await store.getImage(parse.imageUrl(req));
        res.setHeader('Content-Type', image.filetype);

        if (image.modified) {
            res.setHeader('Last-Modified', image.modified);
        }
        if (image.etag) {
            res.setHeader('ETag', image.etag);
        }

        // this is slow, so encourage browsers to cache the images
        //  rather than repeatedly download them
        res.setHeader('Cache-Control', 'max-age=31536000');

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
