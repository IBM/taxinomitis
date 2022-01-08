// external dependencies
import * as fs from 'fs';


export function read(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
        fs.readFile(path, 'utf8', (err, contents) => {
            if (err) {
                return reject(err);
            }
            return resolve(contents);
        });
    });
}

export function readBuffer(path: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (err, contents) => {
            if (err) {
                return reject(err);
            }
            return resolve(contents);
        });
    });
}

export function readJson(path: string): Promise<object>
{
    return read(path)
        .then((textdata) => {
            return JSON.parse(textdata);
        });
}
