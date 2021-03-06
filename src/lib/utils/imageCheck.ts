// core dependencies
import * as fs from 'fs';
// external dependencies
import * as fileType from 'file-type';
import * as tmp from 'tmp';
import * as async from 'async';
import * as filesize from 'filesize';
// local dependencies
import * as download from './download';
import * as urlchecker from './urlchecker';
import loggerSetup from '../utils/logger';



const log = loggerSetup();

type PossibleError = Error | null;
type IFilePathCallback = (err?: PossibleError, location?: string) => void;
type IFileTypeCallback = (err?: PossibleError, filetype?: string) => void;
type IFilePathTypeCallback = (err?: PossibleError, filetype?: string, location?: string) => void;



export const ERROR_PREFIXES = {
    BAD_TYPE : 'Unsupported file type',
    TOO_BIG : 'Image file size',
    INVALID_URL : 'Not a valid web address',
};


export function verifyImage(url: string, maxAllowedSizeBytes: number): Promise<void> {
    return new Promise((resolve, reject) => {
        let imageurl: string;
        try {
            imageurl = urlchecker.check(url);
        }
        catch (err) {
            return reject(new Error(ERROR_PREFIXES.INVALID_URL));
        }

        async.waterfall([
            (next: IFilePathCallback) => {
                // work out where to download the file to
                tmp.file({ keep : true, discardDescriptor : true, prefix : 'chk-' }, (err, tmppath) => {
                    if (err) {
                        log.error({ err, imageurl }, 'Failed to create tmp file');
                    }

                    next(err, tmppath);
                });
            },
            (tmpFilePath: string, next: IFilePathCallback) => {
                // download the file to the temp location on disk
                download.file(imageurl, tmpFilePath, (err) => {
                    if (err) {
                        log.warn({ err, tmpFilePath, imageurl }, 'Failed to download image file');
                    }

                    next(err, tmpFilePath);
                });
            },
            (tmpFilePath: string, next: IFilePathCallback) => {
                // check that the file isn't too big
                fs.stat(tmpFilePath, (err, stats: fs.Stats) => {
                    if (err) {
                        log.error({ err, imageurl }, 'Failed to check image file size');
                        return next(err);
                    }

                    if (stats.size > maxAllowedSizeBytes) {
                        return next(new Error(ERROR_PREFIXES.TOO_BIG +
                                              ' (' + filesize(stats.size) + ') ' +
                                              'is too big. Please choose images smaller than ' +
                                              filesize(maxAllowedSizeBytes)));
                    }
                    return next(err, tmpFilePath);
                });
            },
            (tmpFilePath: string, next: IFilePathTypeCallback) => {
                // sniff the start of the file to work out the file type
                getFileTypeFromContents(tmpFilePath, (err?: PossibleError, type?: string) => {
                    if (err) {
                        log.error({ err, imageurl, tmpFilePath }, 'Failed to get file type');
                    }

                    next(err, tmpFilePath, type);
                });
            },
        ], (err?: PossibleError, tmpFilePath?: string, fileTypeExt?: string) => {

            if (tmpFilePath) {
                fs.unlink(tmpFilePath, logError);
            }

            if (err) {
                return reject(err);
            }

            const isOkay = (fileTypeExt === 'jpg') || (fileTypeExt === 'png');
            if (!isOkay) {
                return reject(new Error(ERROR_PREFIXES.BAD_TYPE + ' (' + fileTypeExt + '). ' +
                                        'Only jpg and png images are supported.'));
            }
            return resolve();
        });
    });
}






/**
 * Returns the type of the file at the specified location.
 */
function getFileTypeFromContents(filepath: string, callback: IFileTypeCallback): void {
    fileType.fromFile(filepath)
        .then((type) => {
            callback(undefined, type ? type.ext : 'unknown');
        })
        .catch(callback);
}


function logError(err: Error | null) {
    if (err) {
        log.error({ err }, 'Failure to delete a temp file');
    }
}
