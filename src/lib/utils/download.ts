// core dependencies
import * as fs from 'fs';
// external dependencies
import * as request from 'request';
import * as sharp from 'sharp';
import * as probe from 'probe-image-size';
// local dependencies
import loggerSetup from './logger';

const log = loggerSetup();



type IErrCallback = (err?: Error) => void;


// disable aggressive use of memory for caching
sharp.cache(false);



/**
 * Downloads a file from the specified URL to the specified location on disk.
 *
 * @param url  - downloads from
 * @param targetFilePath  - writes to
 */
export function file(url: string, targetFilePath: string, callback: IErrCallback): void {

    // local inner function used to avoid calling callback multiple times
    let resolved = false;
    function resolve(err?: Error) {
        if (resolved === false) {
            resolved = true;
            return callback(err);
        }
    }

    const writeStream = fs.createWriteStream(targetFilePath)
                            .on('error', resolve)
                            .on('finish', resolve);

    try {
        request.get({ url, timeout : 10000 })
            .on('error', () => {
                resolve(new Error('Unable to download image from ' + url));
            })
            .pipe(writeStream);
    }
    catch (err) {
        log.error({ err, url }, 'Failed to download');
        resolve(new Error('Unable to download image from ' + url));
    }
}




/**
 * Downloads a file from the specified URL to the specified location on disk.
 *
 * @param url  - downloads from
 * @param width - width (in pixels) to resize the image to
 * @param height - height (in pixels) to resize the image to
 * @param targetFilePath  - writes to
 */
export function resize(
    url: string,
    width: number, height: number,
    targetFilePath: string,
    callback: IErrCallback,
): void
{
    // local inner function used to avoid calling callback multiple times
    let resolved = false;
    function resolve(err?: Error) {
        if (resolved === false) {
            resolved = true;
            return callback(err);
        }
    }

    probe(url)
        .then((imageinfo: any) => {
            if (imageinfo.type !== 'jpg' && imageinfo.type !== 'jpeg' && imageinfo.type !== 'png') {
                log.error({ imageinfo, url }, 'Unexpected file type');
                throw new Error('Unsupported file type ' + imageinfo.type);
            }

            // skew, don't crop, when resizing
            const options = { fit : 'fill' } as sharp.ResizeOptions;

            const shrinkStream = sharp()
                                    // resize before writing to disk
                                    .resize(width, height, options)
                                    .on('error', resolve)
                                    // write to file using the same image
                                    //  format (i.e. jpg vs png) as the
                                    //  original
                                    .toFile(targetFilePath, resolve);

            request.get({ url, timeout : 10000 })
                .on('error', (err) => {
                    log.error({ err, url }, 'Download fail');
                    resolve(new Error('Unable to download image from ' + url));
                })
                .pipe(shrinkStream);
        })
        .catch ((err: any) => {
            log.error({ err, url }, 'Download fail');
            resolve(new Error('Unable to download image from ' + url));
        });
}


