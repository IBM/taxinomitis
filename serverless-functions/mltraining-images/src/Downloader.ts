// external dependencies
import * as fs from 'fs';
import * as path from 'path';
import * as async from 'async';
import * as tmp from 'tmp';
import * as archiver from 'archiver';
// internal dependencies
import { RetrieveFromStorage, DownloadFromWeb, ImageDownload } from './Requests';
import ImageStore from './ImageStore';
import ImageInfo from './ImageInfo';
import { runResizeFunction } from './OpenWhisk';
import { IFileTypeCallback } from './ImageInfo';
import { validateZip } from './Rules';
import { log } from './Debug';
import { IErrCallback, IRenameCallback, IDownloadAllCallback,
         IDownloadCallback, IZipCallback, ICreateZipCallback,
         IZipDataCallback } from './Callbacks';




let imagestore: ImageStore;



function logError(err?: Error | null) {
    if (err) {
        log('Failed to delete file', err);
    }
}


function renameFileFromContents(filepath: string, source: RetrieveFromStorage, callback: IRenameCallback): void {
    async.waterfall([
        (next: IErrCallback) => {
            ImageInfo(filepath, next);
        },
        (filetype: string, next: IFileTypeCallback) => {
            if (filetype === 'jpg' || filetype === 'png') {
                return next(undefined, filetype);
            }
            next(new Error('Training data (' + source.spec.objectid +
                           ') has unsupported file type (' + filetype + ')'));
        },
        (filetype: string, next: IRenameCallback) => {
            const newFilePath = filepath + '.' + filetype;
            fs.rename(filepath, newFilePath, (err) => {
                next(err, newFilePath);
            });
        },
    ], callback);
}


function getHostFromUrl(urlstr: string): string {
    try {
        const urlobj = new URL(urlstr);
        return urlobj.host;
    }
    catch (err) {
        log(err);
        return urlstr;
    }
}


function downloadImage(location: DownloadFromWeb, callback: IDownloadCallback): void {
    async.waterfall([
        (next: IDownloadCallback) => {
            // work out where to download the file to
            tmp.file({ keep : true, discardDescriptor : true, prefix : 'dl-', postfix : '.png' }, (err, tmppath) => {
                next(err, tmppath);
            });
        },
        (tmpFilePath: string, next: IDownloadCallback) => {
            runResizeFunction({ url : location.url })
                .then((response) => {
                    if (response.statusCode !== 200) {
                        const errWithLocation: any = new Error(response.body.error) as unknown;
                        errWithLocation.location = location;
                        errWithLocation.statusCode = response.statusCode;
                        return next(errWithLocation, tmpFilePath);
                    }
                    fs.writeFile(tmpFilePath, response.body, 'base64', (err) => {
                        next(err, tmpFilePath);
                    });
                }).catch((err) => {
                    log('Failed to resize image', err, location);

                    const errWithLocation: any = new Error('Unable to download image from ' +
                                                           getHostFromUrl(location.url)) as unknown;
                    errWithLocation.location = location;
                    errWithLocation.statusCode = 500;
                    return next(errWithLocation, tmpFilePath);
                });
        },
    ], (err?: Error | null, downloadedPath?: string) => {
        if (err) {
            // console.log('Failed to download', err, location);
        }
        callback(err, downloadedPath);
    });
}


function retrieveImage(location: RetrieveFromStorage, callback: IDownloadCallback): void {
    async.waterfall([
        (next: IDownloadCallback) => {
            // work out where to download the file to
            tmp.file({ keep : true, discardDescriptor : true, prefix : 'dl-' }, (err, tmppath) => {
                next(err, tmppath);
            });
        },
        (tmpFilePath: string, next: IDownloadCallback) => {
            // download the file to the temp location on disk
            imagestore.download(location.spec, tmpFilePath)
                .then(() => {
                    next(undefined, tmpFilePath);
                })
                .catch((err) => {
                    next(err, tmpFilePath);
                });
        },
        (tmpFilePath: string, next: IRenameCallback) => {
            // rename the file to give it the right extension
            renameFileFromContents(tmpFilePath, location, next);
        },
    ], (err?: Error | null, downloadedPath?: string) => {
        callback(err, downloadedPath);
    });
}



function fetchAllImages(locations: ImageDownload[], callback: IDownloadAllCallback): void {
    async.map(locations, (location: ImageDownload, next: IDownloadCallback) => {
        if (location.type === 'download') {
            downloadImage(location, next);
        }
        else if (location.type === 'retrieve') {
            retrieveImage(location, next);
        }
        else {
            next(new Error('Unrecognized image type'));
        }
    }, callback);
}



function createZip(filepaths: string[], callback: IZipCallback): void {

    tmp.file({ keep : true, postfix : '.zip' }, (err, zipfilename) => {
        if (err) {
            log('Failure to create zip file', err, filepaths);
            return callback(err);
        }

        const outputStream = fs.createWriteStream(zipfilename);

        const archive = archiver('zip', { zlib : { level : 9 } });

        outputStream.on('close', () => {
            callback(undefined, zipfilename, archive.pointer());
        });

        outputStream.on('warning', (warning) => {
            log('Unexpected warning event from writable filestream', warning);
        });

        outputStream.on('error', (ziperr) => {
            log('Failed to write to zip file', ziperr);
            callback(ziperr);
        });

        archive.pipe(outputStream);

        filepaths.forEach((filepath) => {
            archive.file(filepath, { name : path.basename(filepath) });
        });

        archive.finalize();
    });
}




/**
 * Downloads the images specified, writes them to a zip file, and returns
 * the contents of that zip file.
 *
 * @param store - cloud object storage to retrieve images from
 * @param locations - list of images to download and add to the zip
 * @returns base64-encoded representation of a zip file containing the images
 */
export function run(store: ImageStore, locations: ImageDownload[]): Promise<string> {
    imagestore = store;

    return new Promise((resolve, reject) => {
        async.waterfall([
            //
            // download all of the image files
            //  to local disk
            //
            (next: IDownloadAllCallback) => {
                log('fetching images');
                fetchAllImages(locations, next);
            },
            //
            // create a zip file with the contents
            //  of all of the local downloaded files
            //
            (downloadedFilePaths: string[], next: IZipCallback) => {
                log('creating zip');
                createZip(downloadedFilePaths, (err?: Error | null, zippath?: string, zipsize?: number) => {
                    next(err, zippath, zipsize);
                });
            },
            //
            // check the zip file is fit for use
            //
            (zipFilePath: string, zipFileSize: number, next: ICreateZipCallback) => {
                log('checking zip');
                validateZip(zipFileSize, (err) => {
                    next(err, zipFilePath);
                });
            },
            //
            // read the final zip file data,
            //  base-64 encoded so it is ready to
            //  be returned
            //
            (zipFilePath: string, next: IZipDataCallback) => {
                log('reading zip');
                fs.readFile(zipFilePath, 'base64', (err?: Error | null, zipdata?: string) => {
                    next(err, zipFilePath, zipdata);
                });
            },
        ],
        // @ts-ignore
        (err, zippath, zipdata) => {
            log('DONE', zippath);
            if (err) {
                return reject(err);
            }
            return resolve(zipdata);
        });
    });
}

