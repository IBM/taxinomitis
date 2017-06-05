// external dependencies
import * as fs from 'fs';
import * as Mustache from 'mustache';
// local dependencies
import * as Types from '../db/db-types';


const ROOT_URL = 'http://' + process.env.HOST + ':' + process.env.PORT;


function readFile(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
        fs.readFile(path, 'utf8', (err, contents) => {
            if (err) {
                return reject(err);
            }
            return resolve(contents);
        });
    });
}


async function getTextExtension(scratchkey: Types.ScratchKey): Promise<string> {
    const template: string = await readFile('./resources/scratchx-text-classify.js');
    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        statusurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/status',
        classifyurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/classify',
        projectname : scratchkey.name,
    });
    return rendered;
}


export function getScratchxExtension(scratchkey: Types.ScratchKey): Promise<string> {
    if (scratchkey.type === 'text') {
        return getTextExtension(scratchkey);
    }
    else {
        throw new Error('Not implemented yet');
    }
}
