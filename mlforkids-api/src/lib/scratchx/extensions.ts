// external dependencies
import * as Mustache from 'mustache';
// local dependencies
import * as scratchtfjs from './scratchtfjs';
import * as Types from '../db/db-types';
import * as fileutils from '../utils/fileutils';
import * as sound from '../training/sound';
import * as env from '../utils/env';

// mustache has an unbounded cache which appears like a memory leak
//  as all Scratch extensions ever generated are kept in memory
// doing this disables the cache to avoid the memory leak
// cf. https://github.com/janl/mustache.js/blob/master/CHANGELOG.md#400--16-january-2020
// @ts-ignore
Mustache.templateCache = undefined;



const ROOT_URL = process.env[env.AUTH0_CALLBACK_URL];

function escapeProjectName(name: string, version: 2 | 3): string {
    if (version === 3) {
        // Scratch 3 needs HTML encoding (e.g. '&lt;') as special
        //  characters (e.g. '<') will prevent extensions from
        //  loading
        return name.replace(/[&<>]/g, ' ')
                    .replace(/[']/g, '\\\'');
    }
    else {
        // Scratch 2 displays the string as-is
        return name.replace(/'/g, '\\\'');
    }
}

async function getTextExtension(scratchkey: Types.ScratchKey, project: Types.Project, version: 2 | 3): Promise<string> {
    const template: string = await fileutils.read(
        version === 3 ? './resources/scratch3-text-classify.js' :
                        './resources/scratchx-text-classify.js');

    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        projectid : project.id.replace(/-/g, ''),

        statusurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/status',
        classifyurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/classify',
        storeurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/train',
        modelurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/models',

        projectname : escapeProjectName(scratchkey.name, version),
        labels : project.labels.map((name, idx) => {
            return { name, idx };
        }),

        firstlabel : project.labels.length > 0 ? project.labels[0] : '',
    });
    return rendered;
}

async function getImagesExtension(scratchkey: Types.ScratchKey, project: Types.Project,
                                  version: 2 | 3): Promise<string>
{
    const template: string = await fileutils.read(
        version === 3 ? './resources/scratch3-images-classify.js' :
                        './resources/scratchx-images-classify.js');

    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        projectid : project.id.replace(/-/g, ''),

        statusurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/status',
        classifyurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/classify',
        storeurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/train',

        projectname : escapeProjectName(scratchkey.name, version),
        labels : project.labels.map((name, idx) => {
            return { name, idx };
        }),

        firstlabel : project.labels.length > 0 ? project.labels[0] : '',
    });
    return rendered;
}

async function getImagesTfjsExtension(scratchkey: Types.ScratchKey, project: Types.Project): Promise<string>
{
    const template: string = await fileutils.read('./resources/scratch3-imgtfjs-classify.js');

    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        projectid : project.id.replace(/-/g, ''),

        statusurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/status',
        classifyurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/classify',
        storeurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/train',

        projectname : escapeProjectName(scratchkey.name, 3),
        labels : project.labels.map((name, idx) => {
            return { name, idx };
        }),

        firstlabel : project.labels.length > 0 ? project.labels[0] : '',
    });
    return rendered;
}

async function getNumbersExtension(scratchkey: Types.ScratchKey, project: Types.Project,
                                   version: 2 | 3): Promise<string>
{
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

    const template: string = await fileutils.read(
        version === 3 ? './resources/scratch3-numbers-classify.js' :
                        './resources/scratchx-numbers-classify.js');

    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        projectid : project.id.replace(/-/g, ''),

        statusurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/status',
        classifyurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/classify',
        storeurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/train',
        modelurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/models',

        projectname : escapeProjectName(scratchkey.name, version),

        labels : project.labels.map((name, idx) => {
            return { name, idx };
        }),

        firstlabel : project.labels.length > 0 ? project.labels[0] : '',

        fields : project.fields ? project.fields.map((field, idx) => {
            return {
                name : field.name,
                type : field.type,
                multichoice : field.type === 'multichoice',
                typeformat : field.type === 'number' ? '%n' : '%s',
                idx,
                menu : field.type === 'multichoice' ? field.choices : [],
                default : field.type === 'multichoice' ?
                            ((field.choices && field.choices.length > 0) ? field.choices[0] : '') :
                            0,
            };
        }) : [],

        choices : allChoices.map((name, idx) => {
            return { name, idx };
        }),
    });
    return rendered;
}


async function getSoundExtension(scratchkey: Types.ScratchKey, project: Types.Project,
                                 version: 2 | 3): Promise<string>
{
    const template: string = await fileutils.read(
        version === 3 ? './resources/scratch3-sound-classify.js' :
                        './resources/scratchx-sound-classify.js');

    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        projectid : project.id.replace(/-/g, ''),

        storeurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/train',

        projectname : escapeProjectName(scratchkey.name, version),
        labels : project.labels.filter((name) => name !== sound.BACKGROUND_NOISE).map((name, idx) => {
            return { name, idx };
        }),

        firstlabel : project.labels.length > 0 ? project.labels[0] : '',
    });
    return rendered;
}




export function getScratchxExtension(
    scratchkey: Types.ScratchKey,
    project: Types.Project,
    version: 2 | 3,
): Promise<string>
{
    switch (scratchkey.type) {
    case 'text':
        return getTextExtension(scratchkey, project, version);
    case 'images':
        return getImagesExtension(scratchkey, project, version);
    case 'imgtfjs':
        return getImagesTfjsExtension(scratchkey, project);
    case 'numbers':
        return getNumbersExtension(scratchkey, project, version);
    case 'sounds':
        return getSoundExtension(scratchkey, project, version);
    }
}




export async function getScratchTfjsExtension(scratchkey: string): Promise<string> {
    const modelinfo = await scratchtfjs.getModelInfoFromScratchKey(scratchkey);
    const metadata = await scratchtfjs.getMetadata(modelinfo);

    if (metadata && metadata.packageName === '@teachablemachine/pose') {
        modelinfo.modeltype = 'teachablemachinepose';
    }

    const template: string = await fileutils.read('./resources/scratch3-tfjs-classify.js');

    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        projectid   : modelinfo.id,
        projectname : metadata && metadata.modelName ? escapeProjectName(metadata.modelName, 3) : 'ML model',
        labels      : metadata && metadata.labels ? metadata.labels.map((name, idx) => {
            return { name, idx };
        }) : [],
        haslabels   : metadata && metadata.labels && metadata.labels.length > 0,
        modelurl    : scratchtfjs.getModelJsonUrl(modelinfo),
        modeltype   : modelinfo.modeltype,
    });
    return rendered;
}
