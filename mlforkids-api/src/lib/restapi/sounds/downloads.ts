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
 * Sets up API required to allow sound downloads.
 */
export default function registerApis(app: Express.Application) {

    // register route handler
    app.get(urls.SOUND,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectAccessOrTeacher,
            handleDownload);
}


async function handleDownload(req: Express.Request, res: Express.Response) {
    try {
        const sound = await store.getSound(parse.soundUrl(req));

        if (sound.modified) {
            res.setHeader('Last-Modified', sound.modified);
        }
        if (sound.etag) {
            res.setHeader('ETag', sound.etag);
        }

        // This is slow, so encourage browsers to aggressively
        //  cache the spectrograms rather than repeatedly download them
        // (This is safe as we don't allow sound data to be modified,
        //  so it's okay to treat them as immutable).
        res.set(headers.CACHE_1YEAR);


        res.json(sound.body);
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
