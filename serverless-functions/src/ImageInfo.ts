/* tslint:disable:no-console */
// external dependencies
import readChunk from 'read-chunk';
import * as fileType from 'file-type';


export type IFileTypeCallback = (err?: Error | null, filetype?: string) => void;

/**
 * Read the start of the specified image file, and uses that to
 * return a guess at the image file type.
 *
 * @param filepath - location of the image file on local disk
 * @param callback
 */
export default function main(filepath: string, callback: IFileTypeCallback): void {
    readChunk(filepath, 0, 4100)
        .then((buffer) => {
            const type = fileType(buffer);
            callback(undefined, type ? type.ext : 'unknown');
        })
        .catch((err) => {
            console.log('imageinfo', err);
            callback(undefined, 'png');
        });
}
