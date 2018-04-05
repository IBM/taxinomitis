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


type IFilePathCallback = (err?: Error, location?: string) => void;
type IFileTypeCallback = (err?: Error, filetype?: string) => void;
type IFilePathTypeCallback = (err?: Error, filetype?: string, location?: string) => void;
type IErrCallback = (err?: Error) => void;



export function verifyImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
        async.waterfall([
            (next: IFilePathCallback) => {
                // work out where to download the file to
                tmp.file({ keep : true, discardDescriptor : true, prefix : 'chk-' }, (err, tmppath) => {
                    next(err, tmppath);
                });
            },
            (tmpFilePath: string, next: IFilePathCallback) => {
                // download the file to the temp location on disk
                download(url, tmpFilePath, (err) => {
                    next(err, tmpFilePath);
                });
            },
            (tmpFilePath: string, next: IFilePathTypeCallback) => {
                getFileTypeFromContents(tmpFilePath, (err?: Error, type?: string) => {
                    next(err, type, tmpFilePath);
                });
            },
            (fileTypeExt: string, tmpFilePath: string, next: IFileTypeCallback) => {
                fs.unlink(tmpFilePath, logError);
                next(undefined, fileTypeExt);
            },
        ], (err?: Error, fileTypeExt?: string) => {
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
            callback(undefined, type ? type.ext : 'unknown');
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


function logError(err: Error) {
    if (err) {
        log.error({ err }, 'Core error');
    }
}
