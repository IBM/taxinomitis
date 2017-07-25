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


type IFileTypeCallback = (err: Error, filetype?: string) => void;
type IErrCallback = (err: Error) => void;
type IRenameCallback = (err: Error, renamedPath?: string) => void;
type IDownloadCallback = (err: Error, downloadedFilePath?: string) => void;
type IDownloadAllCallback = (err: Error, downloadedFilePaths?: string[]) => void;
type IZipCallback = (err: Error, zipPath?: string, zipSize?: number) => void;
type ICreateZipCallback = (err: Error, zipPath?: string) => void;



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
 * Rename the provided file based on the contents.
 *
 * @param filepath - location of the file on disk
 * @param sourceurl - URL the file was downloaded from
 */
function renameFileFromContents(filepath: string, sourceurl: string, callback: IRenameCallback): void {
    async.waterfall([
        (next) => {
            getFileTypeFromContents(filepath, next);
        },
        (filetype, next) => {
            if (filetype === 'jpg' || filetype === 'png') {
                return next(null, filetype);
            }
            next(new Error('Training data (' + sourceurl + ') has supported file type (' + filetype + ')'));
        },
        (filetype, next) => {
            const newFilePath = filepath + '.' + filetype;
            fs.rename(filepath, newFilePath, (err) => {
                next(err, newFilePath);
            });
        },
    ], callback);
}


/**
 * Downloads a file from the specified URL to the specified location on disk.
 *
 * @param url  - downloads from
 * @param targetFilePath  - writes to
 */
function download(url: string, targetFilePath: string, callback: IErrCallback): void {
    request.get({ url, timeout : 5000 })
        .on('error', callback)
        .on('end', callback)
        .pipe(fs.createWriteStream(targetFilePath));
}


/**
 * Downloads a file to the temp folder and renames it based on the file type.
 *  This is done based on the file contents, and is not dependent on any file
 *  extension in the URL.
 *
 * @param url - URL to download the file from
 */
function downloadAndRename(url: string, callback: IDownloadCallback): void {
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
            // rename the file to give it the right extension
            renameFileFromContents(tmpFilePath, url, next);
        },
    ], callback);
}


/**
 * Download all of the files from the provided URLs to disk, and return
 *  the location of the downloaded files.
 */
function downloadAll(urls: string[], callback: IDownloadAllCallback): void {
    async.map(urls, downloadAndRename, callback);
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
    tmp.file({ keep : true, postfix : '.zip' }, (err, zipfilename) => {
        if (err) {
            return callback(err);
        }

        const outputStream = fs.createWriteStream(zipfilename);

        const archive = archiver('zip', { zlib : { level : 9 } });

        outputStream.on('close', () => {
            callback(null, zipfilename, archive.pointer());
        });

        outputStream.on('warning', callback);
        outputStream.on('error', callback);

        archive.pipe(outputStream);

        filepaths.forEach((filepath) => {
            archive.file(filepath, { name : path.basename(filepath) });
        });

        archive.finalize();
    });
}



/**
 * Confirms that the provided URLs should be usable by the Vision Recognition service.
 */
function validateRequest(urls: string[], callback: IErrCallback): void {
    if (urls.length < 10) {
        return callback(new Error('Not enough images to train the classifier'));
    }
    if (urls.length > 10000) {
        return callback(new Error('Number of images exceeds maximum (10000)'));
    }

    return callback(null);
}


/**
 * Confirms that the created zip file should be usable by the Vision Recognition service.
 */
function validateZip(filesize: number, callback: IErrCallback): void {
    if (filesize > 100000000) {
        return callback(new Error('Training data exceeds maximum limit (100 mb)'));
    }
    return callback(null);
}



/**
 * Downloads the files from the provided list of URLs, create a zip file,
 *  add all of the downloaded files to the zip file, and then delete the
 *  originals. Return the zip.
 */
function downloadAllIntoZip(urls: string[], callback: ICreateZipCallback): void {
    async.waterfall([
        (next) => {
            validateRequest(urls, next);
        },
        (next) => {
            downloadAll(urls, next);
        },
        (downloadedFilePaths: string[], next) => {
            createZip(downloadedFilePaths, (err, zippath: string, zipsize: number) => {
                next(err, downloadedFilePaths, zippath, zipsize);
            });
        },
        (downloadedFilePaths: string[], zipFilePath: string, zipFileSize: number, next) => {
            deleteFiles(downloadedFilePaths, (err) => {
                next(err, zipFilePath, zipFileSize);
            });
        },
        (zipFilePath: string, zipFileSize: number, next) => {
            validateZip(zipFileSize, (err) => {
                next(err, zipFilePath);
            });
        },
    ], callback);
}





export function run(urls: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        downloadAllIntoZip(urls, (err, zippath) => {
            if (err) {
                return reject(err);
            }
            return resolve(zippath);
        });
    });
}
