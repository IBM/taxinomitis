// external dependencies
import * as Express from 'express';
import * as multer from 'multer';
import * as httpStatus from 'http-status';
// local dependencies
import * as config from '../../imagestore/config';
import * as store from '../../imagestore';
import * as urls from '../urls';
import * as parse from './urlparse';
import loggerSetup from '../../utils/logger';
// type definitions
import * as Types from './types';
import * as StoreTypes from '../../imagestore/types';


const log = loggerSetup();


let uploadHandler: Express.RequestHandler;




/**
 * Sets up API required to allow image uploads.
 */
export default function registerApis(app: Express.Application) {

    // init image uploads request handler
    uploadHandler = prepareMulterUploadHandler();

    // register route handler
    app.post(urls.IMAGES, handleUpload);
}



function handleUpload(req: Express.Request, res: Express.Response) {
    if (!uploadHandler) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            error : 'Server not initialised',
            details : 'Multer upload handler undefined',
        });
    }

    uploadHandler(req, res, (err?: Error) => {
        if (err) {
            return returnUploadError(res, err);
        }
        if (!req.file) {
            return res.status(httpStatus.BAD_REQUEST).json({
                error : 'File not provided',
            });
        }

        const imageSpec: StoreTypes.ImageSpec = parse.imagesUrl(req);
        const imageType: StoreTypes.ImageFileType = getImageType(req.file.mimetype);

        store.storeImage(imageSpec, imageType, req.file.buffer)
            .then((etag) => {
                if (etag) {
                    res.setHeader('ETag', etag);
                }
                res.status(httpStatus.CREATED).json({
                    id : imageSpec.imageid,
                });
            })
            .catch((storeErr) => {
                log.error({ err : storeErr }, 'Store fail');
                res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                    error : storeErr.message,
                    details : storeErr,
                });
            });
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
    cb: (err: Error | null, accept: boolean) => void)
{
    if (config.SUPPORTED_IMAGE_MIMETYPES.includes(file.mimetype)) {
        cb(null, true);
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

