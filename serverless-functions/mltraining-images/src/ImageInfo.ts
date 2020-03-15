// external dependencies
import * as fileType from 'file-type';
import { log } from './Debug';


export type IFileTypeCallback = (err?: Error | null, filetype?: string) => void;

/**
 * Read the start of the specified image file, and uses that to
 * return a guess at the image file type.
 *
 * @param filepath - location of the image file on local disk
 * @param callback
 */
export default function main(filepath: string, callback: IFileTypeCallback): void {
    fileType.fromFile(filepath)
        .then((type) => {
            callback(undefined, type ? type.ext : 'unknown');
        })
        .catch((err) => {
            log('imageinfo', err);
            callback(undefined, 'png');
        });
}
