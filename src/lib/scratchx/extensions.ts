// external dependencies
import * as fs from 'fs';
import * as Mustache from 'mustache';
// local dependencies
import * as Types from '../db/db-types';


const ROOT_URL = process.env.AUTH0_CALLBACK_URL;


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


async function getTextExtension(scratchkey: Types.ScratchKey, project: Types.Project): Promise<string> {
    const template: string = await readFile('./resources/scratchx-text-classify.js');
    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        statusurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/status',
        classifyurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/classify',
        storeurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/train',

        projectname : scratchkey.name,
        labels : project.labels.map((name, idx) => {
            return { name, idx };
        }),
    });
    return rendered;
}

async function getNumbersExtension(scratchkey: Types.ScratchKey, project: Types.Project): Promise<string> {
    const template: string = await readFile('./resources/scratchx-numbers-classify.js');
    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        statusurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/status',
        classifyurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/classify',
        storeurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/train',

        projectname : scratchkey.name,
        labels : project.labels.map((name, idx) => {
            return { name, idx };
        }),
        fields : project.fields,
    });
    return rendered;
}



export function getScratchxExtension(scratchkey: Types.ScratchKey, project: Types.Project): Promise<string> {
    if (scratchkey.type === 'text') {
        return getTextExtension(scratchkey, project);
    }
    else if (scratchkey.type === 'numbers') {
        return getNumbersExtension(scratchkey, project);
    }
    else {
        throw new Error('Not implemented yet');
    }
}
