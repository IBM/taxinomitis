// internal dependencies
import { IncomingHttpHeaders } from 'http';
import { IErrCallback } from './Callbacks';
import { BAD_REQUEST } from './StatusCodes';
import { log } from './Debug';


/**
 * Confirms that the size of the created zip file doesn't exceed
 * the service limits
 *
 * @param filesize - file size in bytes
 * @param callback
 */
export function validateZip(filesize: number, callback: IErrCallback): void {
    log('zip size', filesize);
    if (filesize > 100000000) {
        const badRequest = new Error('Training data exceeds maximum limit (100 mb)') as any;
        badRequest.statusCode = BAD_REQUEST;
        return callback(badRequest);
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
        log('download size', sizeStr);
        try {
            const sizeInt = parseInt(sizeStr, 10);
            if (sizeInt > 52428800) {
                return true;
            }
        }
        catch (err) {
            log('Unable to parse content-length header', sizeStr);
            log('downloadTooBig', err);
        }
    }

    // assume it's probably okay
    return false;
}
