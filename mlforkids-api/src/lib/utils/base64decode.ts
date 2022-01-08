// core dependencies
import * as fs from 'fs';
// external dependencies
import * as tmp from 'tmp';
import loggerSetup from './logger';

const log = loggerSetup();



type IDecodeCallback = (err?: Error | null, decodedFilePath?: string) => void;


function decodeJpg(base64data: string, callback: IDecodeCallback): void {
    tmp.file({
        keep : true,
        discardDescriptor : true,
        prefix : 'b64-',
        postfix : '.jpg',
    }, (err, filepath) =>
    {
        if (err) {
            return callback(err);
        }
        return fs.writeFile(filepath, base64data, 'base64', ((writeerr) => {
            callback(writeerr, filepath);
        }));
    });
}



export function run(base64data: string): Promise<string> {
    return new Promise((resolve, reject) => {
        decodeJpg(base64data, (err, filepath) => {
            if (err) {
                log.error({ err, filepath }, 'Failed to decode data');
                return reject(err);
            }
            if (!filepath) {
                log.error('Failed to receive base64 data');
                return reject(new Error('Failed to decode image data'));
            }
            return resolve(filepath);
        });
    });
}
