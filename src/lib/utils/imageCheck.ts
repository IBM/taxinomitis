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
                download(url, tmpFilePath, (err) => {
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


/**
 * Downloads a file from the specified URL to the specified location on disk.
 *
 * @param url  - downloads from
 * @param targetFilePath  - writes to
 */
function download(url: string, targetFilePath: string, callback: IErrCallback): void {
    let callbackCalled = false;

    // There have been very occasional crashes in production due to the callback
    //  function here being called multiple times.
    // I can't see why this might happen, so this function is a temporary way of
    //  1) preventing future crashes
    //  2) capturing what makes it happen - with a nudge via Slack so I don't miss it
    //
    // It is just a brute-force check to make sure we don't call callback twice.
    //  I hope that the next time this happens, the URL and/or file path gives me
    //  a clue as to why.
    //
    // Yeah, it's horrid. I know.
    function invokeCallbackSafely(reportFailure: boolean): void {
        if (callbackCalled) {
            log.error({ url, targetFilePath }, 'Attempt to call callbackfn multiple times');
            notifications.notify('imageCheck failure : ' + url);
        }
        else {
            callbackCalled = true;
            if (reportFailure) {
                callback(new Error('Unable to download image from ' + url));
            }
            else {
                callback();
            }
        }
    }


    try {
        request.get({ url, timeout : 5000 })
            .on('error', () => {
                invokeCallbackSafely(true);
            })
            .pipe(fs.createWriteStream(targetFilePath)
                    .on('finish', () => { invokeCallbackSafely(false); }));
    }
    catch (err) {
        invokeCallbackSafely(true);
    }
}


function logError(err: Error) {
    if (err) {
        log.error({ err }, 'Failure to delete a temp file');
    }
}
