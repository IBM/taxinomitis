// external dependencies
import * as Express from 'express';
import * as multer from 'multer';
import * as httpStatus from 'http-status';
// local dependencies
import * as auth from '../auth';
import * as config from '../../objectstore/config';
import * as store from '../../objectstore';
import * as db from '../../db/store';
import * as urls from '../urls';
import * as parse from './urlparse';
import loggerSetup from '../../utils/logger';
// type definitions
import * as Types from './types';
import * as StoreTypes from '../../objectstore/types';


const log = loggerSetup();


let uploadHandler: Express.RequestHandler;




/**
 * Sets up API required to allow image uploads.
 */
export default function registerApis(app: Express.Application) {

    // init image uploads request handler
    uploadHandler = prepareMulterUploadHandler();

    // register route handler
    app.post(urls.IMAGES,
             auth.authenticate,
             auth.checkValidUser,
             auth.verifyProjectAccess,
             // @ts-ignore
             handleUpload);
}



function handleUpload(req: auth.RequestWithProject, res: Express.Response) {
    if (!uploadHandler) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            error : 'Server not initialised',
            details : 'Multer upload handler undefined',
        });
    }

    // make sure this is an images project before we proceed
    if (req.project.type !== 'images' && req.project.type !== 'imgtfjs') {
        return res.status(httpStatus.BAD_REQUEST).json({
            error : 'Only images projects allow image uploads',
        });
    }

    uploadHandler(req, res, async (err?: Error | any) => {
        if (err) {
            return returnUploadError(res, err);
        }
        if (!req.file) {
            return res.status(httpStatus.BAD_REQUEST).json({
                error : 'File not provided',
            });
        }
        if (!req.body ||
            !req.body.label ||
            typeof req.body.label !== 'string' ||
            req.body.label.trim().length === 0)
        {
            return res.status(httpStatus.BAD_REQUEST).json({
                error : 'Image label not provided',
            });
        }
        if (req.project.labels.includes(req.body.label) === false) {
            return res.status(httpStatus.BAD_REQUEST).json({
                error : 'Unrecognised label',
            });
        }


        let imageSpec: StoreTypes.ObjectSpec | undefined;
        let etag: string | undefined;

        try {
            imageSpec = parse.imagesUrl(req);
            const imageType: StoreTypes.ImageFileType = getImageType(req.file.mimetype);
            const imageLabel: string = req.body.label.trim();

            etag = await store.storeImage(imageSpec, imageType, req.file.buffer);

            const training = await db.storeImageTraining(
                imageSpec.projectid,
                parse.createImageUrl(imageSpec),
                imageLabel,
                true,
                imageSpec.objectid);

            if (etag) {
                res.setHeader('ETag', etag);
            }

            res.status(httpStatus.CREATED).json(training);
        }
        catch (storeErr) {
            if (imageSpec && etag && storeErr &&
                storeErr.message === 'Project already has maximum allowed amount of training data')
            {
                // we've already stored the image data in objectstorage, but
                //  we failed to store the info about the image in the DB as
                //  the user has reached the project limit
                // so we need to delete the image from image data again
                //  (but we'll do that in the background rather than synchronously)
                removeStoredImage(imageSpec);

                return res.status(httpStatus.CONFLICT).json({
                    error : 'Project already has maximum allowed amount of training data',
                });
            }

            log.error({ err : storeErr, projectid : req.project.id }, 'Store fail');
            res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                error : storeErr.message,
                details : storeErr,
            });
        }
    });
}




function getImageType(mimetype: string): StoreTypes.ImageFileType {
    if (config.SUPPORTED_IMAGE_MIMETYPES.includes(mimetype)) {
        return mimetype as StoreTypes.ImageFileType;
    }

    log.error({ mimetype }, 'Unexpected mime type');
    return '';
}



function imageTypesFilter(
    req: Express.Request,
    file: Types.MulterFile,
    cb: (err: Error, accept: boolean) => void)
{
    if (config.SUPPORTED_IMAGE_MIMETYPES.includes(file.mimetype)) {
        const noError: unknown = null;
        cb(noError as Error, true);
    }
    else {
        cb(new Error('Unsupported file type ' + file.mimetype), false);
    }
}




function prepareMulterUploadHandler(): Express.RequestHandler {
    const inMemory = multer.memoryStorage();
    return multer({
        limits : {
            fileSize : config.MAX_IMAGE_FILESIZE_BYTES,
            files : 1,
        },
        fileFilter : imageTypesFilter,
        storage : inMemory,
    }).single('image');
}





function returnUploadError(res: Express.Response, err: Error) {
    if (err.message === 'File too large') {
        return res.status(httpStatus.BAD_REQUEST).json({
            error : 'File too large',
            details : 'Limit : ' + config.MAX_IMAGE_FILESIZE_BYTES,
        });
    }
    if (err.message.startsWith('Unsupported file type ')) {
        return res.status(httpStatus.BAD_REQUEST).json({
            error : err.message,
        });
    }

    log.error({ err }, 'Unexpected error');
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        error : err.message,
        details : err,
    });
}



function removeStoredImage(image: StoreTypes.ObjectSpec): void {
    db.storeDeleteObjectJob(image.classid, image.userid, image.projectid, image.objectid)
        .catch((err) => {
            log.error({ err, image }, 'Failed to clean-up image');
        });
}
