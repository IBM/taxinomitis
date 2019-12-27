// core dependencies
import * as fs from 'fs';
import * as path from 'path';
// external dependencies
import * as tmp from 'tmp';
import * as async from 'async';
import * as archiver from 'archiver';
import * as fileType from 'file-type';
import readChunk from 'read-chunk';
import * as request from 'request';
// local dependencies
import * as download from './download';
import * as objectstore from '../objectstore';
import * as visrec from '../training/visualrecognition';
import * as notifications from '../notifications/slack';
import * as openwhisk from './openwhisk';
import loggerSetup from './logger';

const log = loggerSetup();



export interface RetrieveFromStorage {
    readonly type: 'retrieve';
    readonly spec: ObjectStorageSpec;
}
interface ObjectStorageSpec {
    readonly objectid: string;
    readonly projectid: string;
    readonly userid: string;
    readonly classid: string;
}
export interface DownloadFromWeb {
    readonly type: 'download';
    readonly url: string;
    readonly imageid: string;
}

export type ImageDownload = RetrieveFromStorage | DownloadFromWeb;

type PossibleError = Error | null;


type IFileTypeCallback = (err?: PossibleError, filetype?: string) => void;
type IErrCallback = (err?: PossibleError) => void;
type IRenameCallback = (err?: PossibleError, renamedPath?: string) => void;
type IDownloadCallback = (err?: PossibleError, downloadedFilePath?: string) => void;
type IDownloadAllCallback = (err?: PossibleError, downloadedFilePaths?: string[]) => void;
type IZippedCallback = (err?: PossibleError, downloadedFilePaths?: string[],
                        zipPath?: string, zipSize?: number) => void;
type IZipCallback = (err?: PossibleError, zipPath?: string, zipSize?: number) => void;
type ICreateZipCallback = (err?: PossibleError, zipPath?: string) => void;


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
        return location.spec.objectid;
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

function logError(err?: Error | null) {
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
    objectstore.getImage(spec)
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
        download.resize(location.url,
            visrec.IMAGE_WIDTH_PIXELS, visrec.IMAGE_HEIGHT_PIXELS,
            targetFilePath,
            callback);
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
                if (err && err.message.startsWith(download.ERRORS.DOWNLOAD_FAIL)) {
                    const errWithLocation: any = err as unknown;
                    errWithLocation.location = location;
                    return callback(errWithLocation);
                }
                next(err, tmpFilePath);
            });
        },
        (tmpFilePath: string, next: IRenameCallback) => {
            // rename the file to give it the right extension
            renameFileFromContents(tmpFilePath, location, next);
        },
    ], (err?: PossibleError, downloadedPath?: string) => {
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
    async.mapLimit(locations, 2, downloadAndRename, callback);
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
            notifications.notify('downloadAndZip failure',
                                 notifications.SLACK_CHANNELS.CRITICAL_ERRORS);
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

        outputStream.on('warning', (warning) => {
            log.error({ warning }, 'Unexpected warning event from writable filestream');
            notifications.notify('outputStream warning',
                                 notifications.SLACK_CHANNELS.CRITICAL_ERRORS);
        });

        outputStream.on('error', (ziperr) => {
            log.error({ err: ziperr }, 'Failed to write to zip file');
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
    log.debug({ filesize }, 'Created zip file for training Visual Recognition');
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
            createZip(downloadedFilePaths, (err?: PossibleError, zippath?: string, zipsize?: number) => {
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


let execution: openwhisk.Execution = 'local';

function chooseExecutionEnvironment() {
    openwhisk.isOpenWhiskConfigured()
        .then((okayToUseOpenWhisk) => {
            if (okayToUseOpenWhisk) {
                execution = 'openwhisk';
            }
        });
}




function runLocally(locations: ImageDownload[]): Promise<string> {
    return new Promise((resolve, reject) => {
        downloadAllIntoZip(locations, (err, zippath) => {
            if (err) {
                if (!err.message.startsWith(download.ERRORS.DOWNLOAD_FAIL)) {
                    log.error({ err }, 'Failed to create training zip');
                }
                if (zippath && typeof zippath === 'string') {
                    deleteFailedTrainingFile(zippath);
                }
                return reject(err);
            }
            return resolve(zippath);
        });
    });
}



export async function runInServerless(locations: ImageDownload[]): Promise<string> {
    return new Promise((resolve, reject) => {
        tmp.file({ keep : true, postfix : '.zip' }, (tmperr?: Error, zipfile?: string) => {
            if (tmperr || !zipfile) {
                log.error({ err : tmperr }, 'Failed to get tmp file');
                return reject(tmperr);
            }

            const url = openwhisk.getUrl(openwhisk.FUNCTIONS.CREATE_ZIP);
            const headers = openwhisk.getHeaders();

            const serverlessRequest = {
                url,
                method : 'POST',
                json : true,
                headers : {
                    ...headers,
                    'User-Agent': 'machinelearningforkids.co.uk',
                    'Accept': 'application/zip',
                },
                body : {
                    locations,
                    imagestore : objectstore.getCredentials(),
                },
            };

            request.post(serverlessRequest)
            .on('error', (err) => {
                deleteFailedTrainingFile(zipfile);

                const customError = err as any;
                if (customError.rerun) {
                    log.error({ err, numlocations : locations.length },
                              'Unexpected failure to run CreateZip - running again locally');

                    return runLocally(locations)
                        .then((zippath) => {
                            return resolve(zippath);
                        })
                        .catch((localerr) => {
                            log.error({ err : localerr }, 'Failed to re-run locally');
                            return reject(localerr);
                        });
                }
                else {
                    if (!customError.logged) {
                        log.error({ err, numlocations : locations.length }, 'CreateZip failed');
                    }
                    return reject(err);
                }
            })
            .on('response', (resp) => {
                if (resp.statusCode !== 200) {
                    const errorInfo = {
                        numlocations : locations.length,
                        status : resp.statusCode,
                        errorobj : resp.headers['x-machinelearningforkids-error'],
                        body : resp.body,
                    };

                    log.error(errorInfo, 'Error response from OpenWhisk');

                    let functionError = new Error('Failed to create zip') as any;
                    const hdrs = resp.headers['x-machinelearningforkids-error'];
                    if (hdrs && typeof hdrs === 'string') {
                        // The serverless function CreateZip failed to create a zip
                        //  file, but this wasn't an expected failure - it has
                        //  returned an explanation for why. (e.g. one of the sites
                        //  hosting an image requested refused to allow it to be
                        //  downloaded).
                        //
                        // This means there is nothing left to do except to inform
                        //  the user that we can't create the training zip.
                        try {
                            const functionErrorInfo = JSON.parse(hdrs);
                            functionError = new Error(functionErrorInfo.error) as any;
                            functionError.location = functionErrorInfo.location;
                            functionError.logged = true;
                        }
                        catch (err) {
                            log.error({ err, hdrs }, 'Failed to parse function error');
                        }
                    }
                    else {
                        // An unexpected and unexplained failure to create a zip file.
                        //
                        // The most common reason for getting here is that the serverless function
                        //  CreateZip created a zip file that is larger than the 5mb response
                        //  payload limit that IBM Cloud Functions allows.
                        //
                        // This needs some significant redesign/restructuring to handle it, but
                        //  for now, we'll just workaround the problem by handling these
                        //  (fortunately rare) edge cases by building the zip outside of OpenWhisk.
                        functionError.rerun = true;
                    }

                    return resp.destroy(functionError);
                }
            })
            .pipe(fs.createWriteStream(zipfile))
            .on('finish', () => {
                return resolve(zipfile);
            });
        });
    });
}


function deleteFailedTrainingFile(location: string): void {
    fs.unlink(location, (err?: Error | null) => {
        if (err) {
            log.error({ err, location }, 'Failed to delete failed training file');
        }
    });
}



chooseExecutionEnvironment();

export function run(locations: ImageDownload[]): Promise<string> {
    if (execution === 'openwhisk') {
        return runInServerless(locations);
    }
    else {
        return runLocally(locations);
    }
}
