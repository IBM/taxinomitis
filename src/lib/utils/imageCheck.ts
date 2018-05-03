// core dependencies
import * as http from 'http';
import * as fs from 'fs';
// external dependencies
import * as request from 'request';
import * as fileType from 'file-type';
import * as readChunk from 'read-chunk';
import * as tmp from 'tmp';
import * as async from 'async';
// local dependencies
import * as download from './download';
import loggerSetup from '../utils/logger';
import * as notifications from '../notifications/slack';



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
                download.file(url, tmpFilePath, (err) => {
                    next(err, tmpFilePath);
                });
            },
            (tmpFilePath: string, next: IFilePathTypeCallback) => {
                // sniff the start of the file to work out the file type
                getFileTypeFromContents(tmpFilePath, (err?: Error, type?: string) => {
                    next(err, tmpFilePath, type);
                });
            },
        ], (err?: Error, tmpFilePath?: string, fileTypeExt?: string) => {

            if (tmpFilePath) {
                fs.unlink(tmpFilePath, logError);
            }

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


function logError(err: Error) {
    if (err) {
        log.error({ err }, 'Failure to delete a temp file');
    }
}
