import { IErrCallback } from './Callbacks';

/**
 * Confirms that the size of the created zip file doesn't exceed
 * the service limits
 *
 * @param filesize - file size in bytes
 * @param callback
 */
export function validateZip(filesize: number, callback: IErrCallback): void {
    console.log('Created zip file for training Visual Recognition : bytes = ', filesize);
    if (filesize > 100000000) {
        return callback(new Error('Training data exceeds maximum limit (100 mb)'));
    }
    return callback(undefined);
}
