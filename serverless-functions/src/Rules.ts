import { IncomingHttpHeaders } from 'http';
import { IErrCallback } from './Callbacks';

/**
 * Confirms that the size of the created zip file doesn't exceed
 * the service limits
 *
 * @param filesize - file size in bytes
 * @param callback
 */
export function validateZip(filesize: number, callback: IErrCallback): void {
    if (filesize > 100000000) {
        return callback(new Error('Training data exceeds maximum limit (100 mb)'));
    }
    return callback(undefined);
}


/**
 * Checks if the response headers for an image download suggest the
 * image will be too big to resize
 *
 * @returns true - if the headers suggest the image is too big
 */
export function downloadTooBig(headers: IncomingHttpHeaders): boolean {
    if (headers['content-length']) {
        const sizeStr = headers['content-length'];
        try {
            const sizeInt = parseInt(sizeStr, 10);
            if (sizeInt > 52428800) {
                return true;
            }
        }
        catch (err) {
            console.log('Unable to parse content-length header', sizeStr);
            console.log('downloadTooBig', err);
        }
    }

    // assume it's probably okay
    return false;
}