// core dependencies
import * as fs from 'fs';
import * as path from 'path';
// external dependencies
import * as tmp from 'tmp';
import * as async from 'async';
import * as request from 'request';
import * as archiver from 'archiver';
import * as fileType from 'file-type';
import * as readChunk from 'read-chunk';
// local dependencies
import * as download from './download';
import * as imagestore from '../imagestore';
import * as notifications from '../notifications/slack';
import loggerSetup from './logger';

const log = loggerSetup();



export interface RetrieveFromStorage {
    readonly type: 'retrieve';
    readonly spec: ObjectStorageSpec;
}
interface ObjectStorageSpec {
    readonly imageid: string;
    readonly projectid: string;
    readonly userid: string;
    readonly classid: string;
}
export interface DownloadFromWeb {
    readonly type: 'download';
    readonly url: string;
}

export type ImageDownload = RetrieveFromStorage | DownloadFromWeb;




type IFileTypeCallback = (err?: Error, filetype?: string) => void;
type IErrCallback = (err?: Error) => void;
type IRenameCallback = (err?: Error, renamedPath?: string) => void;
type IDownloadCallback = (err?: Error, downloadedFilePath?: string) => void;
type IDownloadAllCallback = (err?: Error, downloadedFilePaths?: string[]) => void;
type IZippedCallback = (err?: Error, downloadedFilePaths?: string[], zipPath?: string, zipSize?: number) => void;
type IZipCallback = (err?: Error, zipPath?: string, zipSize?: number) => void;
type ICreateZipCallback = (err?: Error, zipPath?: string) => void;


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


function summary(location: ImageDownload): string {
    if (location.type === 'download') {
        return location.url;
    }
    else if (location.type === 'retrieve') {
        return location.spec.imageid;
    }
    else {
        return 'unknown';
    }
}

/**
 * Rename the provided file based on the contents.
 *
 * @param filepath - location of the file on disk
 * @param source - location the file was downloaded from
 */
function renameFileFromContents(filepath: string, source: ImageDownload, callback: IRenameCallback): void {
    async.waterfall([
        (next: IErrCallback) => {
            getFileTypeFromContents(filepath, next);
        },
        (filetype: string, next: IFileTypeCallback) => {
            if (filetype === 'jpg' || filetype === 'png') {
                return next(undefined, filetype);
            }
            fs.unlink(filepath, logError);
            next(new Error('Training data (' + summary(source) + ') has unsupported file type (' + filetype + ')'));
        },
        (filetype: string, next: IRenameCallback) => {
            const newFilePath = filepath + '.' + filetype;
            fs.rename(filepath, newFilePath, (err) => {
                next(err, newFilePath);
            });
        },
    ], callback);
}

function logError(err?: Error) {
    if (err) {
        log.error({ err }, 'Failed to delete file');
    }
}



/**
 * Retrieves a file from the S3 Object Storage to the specified location on disk.
 *
 * @param spec - elements of the key in object store
 * @param targetFilePath - writes to
 */
function retrieve(spec: ObjectStorageSpec, targetFilePath: string, callback: IErrCallback): void {
    imagestore.getImage(spec)
        .then((imagedata) => {
            fs.writeFile(targetFilePath, imagedata.body, callback);
        })
        .catch((err) => {
            log.error({ err }, 'Failed to retrieve image from storage');
            callback(err);
        });
}




function retrieveImage(location: ImageDownload, targetFilePath: string, callback: IErrCallback): void {
    if (location.type === 'download') {
        download.file(location.url, targetFilePath, callback);
    }
    else if (location.type === 'retrieve') {
        retrieve(location.spec, targetFilePath, callback);
    }
    else {
        throw new Error('Unsupported location type');
    }
}




/**
 * Downloads a file to the temp folder and renames it based on the file type.
 *  This is done based on the file contents, and is not dependent on any file
 *  extension in a URL.
 *
 * @param location - details of where to retrieve the image from
 */
function downloadAndRename(location: ImageDownload, callback: IDownloadCallback): void {
    async.waterfall([
        (next: IDownloadCallback) => {
            // work out where to download the file to
            tmp.file({ keep : true, discardDescriptor : true, prefix : 'dl-' }, (err, tmppath) => {
                next(err, tmppath);
            });
        },
        (tmpFilePath: string, next: IDownloadCallback) => {
            // download the file to the temp location on disk
            retrieveImage(location, tmpFilePath, (err) => {
                next(err, tmpFilePath);
            });
        },
        (tmpFilePath: string, next: IRenameCallback) => {
            // rename the file to give it the right extension
            renameFileFromContents(tmpFilePath, location, next);
        },
    ], (err?: Error, downloadedPath?: string) => {
        if (err) {
            log.error({ err, location }, 'Failed to download');
        }
        callback(err, downloadedPath);
    });
}


/**
 * Download all of the files from the provided locations to disk, and return
 *  the location of the downloaded files.
 */
function downloadAll(locations: ImageDownload[], callback: IDownloadAllCallback): void {
    // @ts-ignore async.map types have a problem with this
    async.map(locations, downloadAndRename, callback);
}


/**
 * Deletes all of the specified files from disk.
 */
function deleteFiles(filepaths: string[], callback: IErrCallback): void {
    async.each(filepaths, fs.unlink, callback);
}




/**
 * Creates a zip file and add the contents of the specified files.
 */
function createZip(filepaths: string[], callback: IZipCallback): void {

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
    function invokeCallbackSafely(err?: Error, zipPath?: string, zipSize?: number): void {
        if (callbackCalled) {
            log.error({ filepaths }, 'Attempt to call callbackfn multiple times');
            notifications.notify('downloadAndZip failure');
        }
        else {
            callbackCalled = true;
            if (err) {
                callback(err);
            }
            else {
                callback(err, zipPath, zipSize);
            }
        }
    }


    tmp.file({ keep : true, postfix : '.zip' }, (err, zipfilename) => {
        if (err) {
            log.error({ err, filepaths }, 'Failure to create zip file');
            return invokeCallbackSafely(err);
        }

        const outputStream = fs.createWriteStream(zipfilename);

        const archive = archiver('zip', { zlib : { level : 9 } });

        outputStream.on('close', () => {
            invokeCallbackSafely(undefined, zipfilename, archive.pointer());
        });

        outputStream.on('warning', () => {
            log.error({ arguments }, 'Unexpected warning event from writable filestream');
            notifications.notify('outputStream warning');
        });

        outputStream.on('error', (ziperr) => {
            log.error({ err }, 'Failed to write to zip file');
            invokeCallbackSafely(ziperr);
        });

        archive.pipe(outputStream);

        filepaths.forEach((filepath) => {
            archive.file(filepath, { name : path.basename(filepath) });
        });

        archive.finalize();
    });
}




/**
 * Confirms that the created zip file should be usable by the Vision Recognition service.
 */
function validateZip(filesize: number, callback: IErrCallback): void {
    if (filesize > 100000000) {
        return callback(new Error('Training data exceeds maximum limit (100 mb)'));
    }
    return callback(undefined);
}



/**
 * Downloads the files from the provided list of locations, create a zip file,
 *  add all of the downloaded files to the zip file, and then delete the
 *  originals. Return the zip.
 */
function downloadAllIntoZip(locations: ImageDownload[], callback: ICreateZipCallback): void {
    async.waterfall([
        (next: IDownloadAllCallback) => {
            downloadAll(locations, next);
        },
        (downloadedFilePaths: string[], next: IZippedCallback) => {
            createZip(downloadedFilePaths, (err?: Error, zippath?: string, zipsize?: number) => {
                next(err, downloadedFilePaths, zippath, zipsize);
            });
        },
        (downloadedFilePaths: string[], zipFilePath: string, zipFileSize: number, next: IZipCallback) => {
            deleteFiles(downloadedFilePaths, (err) => {
                next(err, zipFilePath, zipFileSize);
            });
        },
        (zipFilePath: string, zipFileSize: number, next: ICreateZipCallback) => {
            validateZip(zipFileSize, (err) => {
                next(err, zipFilePath);
            });
        },
    ], callback);
}





export function run(locations: ImageDownload[]): Promise<string> {
    return new Promise((resolve, reject) => {
        downloadAllIntoZip(locations, (err, zippath) => {
            if (err) {
                log.error({ err }, 'Failed to create training zip');
                return reject(err);
            }
            return resolve(zippath);
        });
    });
}
