// core dependencies
import * as http from 'http';
import * as fs from 'fs';
// external dependencies
import * as request from 'request';
import * as fileType from 'file-type';
import * as readChunk from 'read-chunk';
import * as tmp from 'tmp';
import * as async from 'async';
import loggerSetup from '../utils/logger';

const log = loggerSetup();



type IFileTypeCallback = (err: Error, filetype?: string) => void;
type IErrCallback = (err: Error) => void;



export function verifyImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
        async.waterfall([
            (next) => {
                // work out where to download the file to
                tmp.file({ keep : true }, (err, tmppath) => {
                    next(err, tmppath);
                });
            },
            (tmpFilePath, next) => {
                // download the file to the temp location on disk
                download(url, tmpFilePath, (err) => {
                    next(err, tmpFilePath);
                });
            },
            (tmpFilePath, next) => {
                getFileTypeFromContents(tmpFilePath, (err, type) => {
                    next(err, type, tmpFilePath);
                });
            },
            (fileTypeExt, tmpFilePath, next) => {
                fs.unlink(tmpFilePath, logError);
                next(null, fileTypeExt);
            },
        ], (err, fileTypeExt: string) => {
            if (err) {
                return reject(err);
            }
            const isOkay = (fileTypeExt === 'jpg') || (fileTypeExt === 'png');
            if (!isOkay) {
                return reject(new Error('Unsupported file type (' + fileTypeExt + '). ' +
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
    readChunk(filepath, 0, 4100)
        .then((buffer) => {
            const type = fileType(buffer);
            callback(null, type ? type.ext : 'unknown');
        })
        .catch(callback);
}


/**
 * Downloads a file from the specified URL to the specified location on disk.
 *
 * @param url  - downloads from
 * @param targetFilePath  - writes to
 */
function download(url: string, targetFilePath: string, callback: IErrCallback): void {
    try {
        request.get({ url, timeout : 5000 })
            .on('error', () => {
                callback(new Error('Unable to download image from ' + url));
            })
            .on('end', callback)
            .pipe(fs.createWriteStream(targetFilePath));
    }
    catch (err) {
        callback(new Error('Unable to download image from ' + url));
    }
}


function logError(err: NodeJS.ErrnoException) {
    log.error({ err }, 'Core error');
}
