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


function escapeProjectName(name: string): string {
    return name.replace(/'/g, '\\\'');
}

async function getTextExtension(scratchkey: Types.ScratchKey, project: Types.Project): Promise<string> {
    const template: string = await readFile('./resources/scratchx-text-classify.js');
    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        statusurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/status',
        classifyurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/classify',
        storeurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/train',

        projectname : escapeProjectName(scratchkey.name),
        labels : project.labels.map((name, idx) => {
            return { name, idx };
        }),
    });
    return rendered;
}

async function getImagesExtension(scratchkey: Types.ScratchKey, project: Types.Project): Promise<string> {
    const template: string = await readFile('./resources/scratchx-images-classify.js');
    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        statusurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/status',
        classifyurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/classify',

        projectname : escapeProjectName(scratchkey.name),
        labels : project.labels.map((name, idx) => {
            return { name, idx };
        }),
    });
    return rendered;
}

async function getNumbersExtension(scratchkey: Types.ScratchKey, project: Types.Project): Promise<string> {
    const allChoices = [];
    if (project.fields) {
        for (const field of project.fields) {
            if (field.type === 'multichoice' && field.choices) {
                for (const choice of field.choices) {
                    if (allChoices.indexOf(choice) === -1) {
                        allChoices.push(choice);
                    }
                }
            }
        }
    }

    const template: string = await readFile('./resources/scratchx-numbers-classify.js');
    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        statusurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/status',
        classifyurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/classify',
        storeurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/train',

        projectname : escapeProjectName(scratchkey.name),

        labels : project.labels.map((name, idx) => {
            return { name, idx };
        }),

        fields : project.fields ? project.fields.map((field) => {
            return {
                name : field.name,
                typeformat : field.type === 'number' ? '%n' : '%s',
            };
        }) : [],

        choices : allChoices.map((name, idx) => {
            return { name, idx };
        }),
    });
    return rendered;
}



export function getScratchxExtension(scratchkey: Types.ScratchKey, project: Types.Project): Promise<string> {
    switch (scratchkey.type) {
    case 'text':
        return getTextExtension(scratchkey, project);
    case 'images':
        return getImagesExtension(scratchkey, project);
    case 'numbers':
        return getNumbersExtension(scratchkey, project);
    }
}
