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
// @ts-expect-error workaround for mustache issue
Mustache.templateCache = undefined;



const ROOT_URL = process.env[env.AUTH0_CALLBACK_URL];

function escapeProjectName(name: string): string {
    // Scratch 3 needs HTML encoding (e.g. '&lt;') as special
    //  characters (e.g. '<') will prevent extensions from
    //  loading
    return name.replace(/[&<>"]/g, ' ')
               .replace(/[']/g, '\\\'');
}


async function getTextExtensionLocalData(scratchkey: Types.ScratchKey, project: Types.LocalProject, browserProjectId: string): Promise<string> {
    const template: string = await fileutils.read('./resources/scratch3-text-classify.js');

    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        projectid : browserProjectId.replace(/-/g, ''),

        statusurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/status',
        classifyurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/classify',
        modelurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/models',
        trainurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/local/models',

        projectname : escapeProjectName(scratchkey.name),
        labels : project.labels.map((name, idx) => {
            return { name, idx };
        }),

        firstlabel : project.labels.length > 0 ? project.labels[0] : '',
    });
    return rendered;
}


async function getTextExtension(scratchkey: Types.ScratchKey, project: Types.Project): Promise<string> {
    const template: string = await fileutils.read('./resources/scratch3-text-classify.js');

    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        projectid : project.id.replace(/-/g, ''),

        statusurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/status',
        classifyurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/classify',
        storeurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/train',
        modelurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/models',

        projectname : escapeProjectName(scratchkey.name),
        labels : project.labels.map((name, idx) => {
            return { name, idx };
        }),

        firstlabel : project.labels.length > 0 ? project.labels[0] : '',
    });
    return rendered;
}


async function getImagesTfjsExtensionLocalData(projectid: string, projectname: string, labels: string[]): Promise<string>
{
    const template: string = await fileutils.read('./resources/scratch3-imgtfjs-classify.js');

    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        projectid : projectid,

        projectname : escapeProjectName(projectname),
        labels : labels.map((name, idx) => {
            return { name, idx };
        }),

        firstlabel : labels.length > 0 ? labels[0] : '',
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

        projectname : escapeProjectName(scratchkey.name),
        labels : project.labels.map((name, idx) => {
            return { name, idx };
        }),

        firstlabel : project.labels.length > 0 ? project.labels[0] : '',
    });
    return rendered;
}

async function getNumbersExtensionLocalData(userid: string, projectid: string, projectname: string, labels: string[], fields: Types.NumbersProjectFieldSummary[]): Promise<string>
{
    if (!userid || userid.length === 0) {
        throw new Error('Missing required userid');
    }

    const allChoices = [];
    for (const field of fields) {
        if (field.type === 'multichoice' && field.choices) {
            for (const choice of field.choices) {
                if (allChoices.indexOf(choice) === -1) {
                    allChoices.push(choice);
                }
            }
        }
    }

    const template: string = await fileutils.read('./resources/scratch3-numbers-classify.js');

    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        projectid : projectid,
        modelid : projectid,

        modelurl : ROOT_URL + '/api/scratch/' + userid + '-' + projectid + '/local/models',

        projectname : escapeProjectName(projectname),

        labels : labels.map((name, idx) => {
            return { name, idx };
        }),

        firstlabel : labels.length > 0 ? labels[0] : '',

        fields : fields ? fields.map((field, idx) => {
            return {
                name : field.name,
                type : field.type,
                multichoice : field.type === 'multichoice',
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

async function getNumbersExtension(scratchkey: Types.ScratchKey, project: Types.Project): Promise<string>
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

    const template: string = await fileutils.read('./resources/scratch3-numbers-classify.js');

    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        projectid : project.id.replace(/-/g, ''),
        modelid : project.id,

        storeurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/train',
        modelurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/models',

        projectname : escapeProjectName(scratchkey.name),

        labels : project.labels.map((name, idx) => {
            return { name, idx };
        }),

        firstlabel : project.labels.length > 0 ? project.labels[0] : '',

        fields : project.fields ? project.fields.map((field, idx) => {
            return {
                name : field.name,
                type : field.type,
                multichoice : field.type === 'multichoice',
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


async function getSoundExtensionLocalData(projectid: string, projectname: string, labels: string[]): Promise<string>
{
    const template: string = await fileutils.read('./resources/scratch3-sound-classify.js');

    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        projectid : projectid,

        projectname : escapeProjectName(projectname),
        labels : labels.filter((name) => name !== sound.BACKGROUND_NOISE).map((name, idx) => {
            return { name, idx };
        }),

        firstlabel : labels.length > 0 ? labels[0] : '',
    });
    return rendered;
}


async function getSoundExtension(scratchkey: Types.ScratchKey, project: Types.Project): Promise<string>
{
    const template: string = await fileutils.read('./resources/scratch3-sound-classify.js');

    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        projectid : project.id.replace(/-/g, ''),

        storeurl : ROOT_URL + '/api/scratch/' + scratchkey.id + '/train',

        projectname : escapeProjectName(scratchkey.name),
        labels : project.labels.filter((name) => name !== sound.BACKGROUND_NOISE).map((name, idx) => {
            return { name, idx };
        }),

        firstlabel : project.labels.length > 0 ? project.labels[0] : '',
    });
    return rendered;
}


async function getRegressionExtensionLocalData(projectid: string, projectname: string, columns: { label: string, output: boolean}[]): Promise<string>
{
    const template: string = await fileutils.read('./resources/scratch3-regression-classify.js');

    const inputColumns: { label: string, output: boolean}[] = [];
    const outputColumns: { label: string, output: boolean}[] = [];
    for (const column of columns) {
        if (column.output) {
            outputColumns.push(column);
        }
        else {
            inputColumns.push(column);
        }
    }

    Mustache.parse(template);
    const rendered = Mustache.render(template, {
        projectid : projectid,

        projectname : escapeProjectName(projectname),

        inputcolumns : inputColumns.map((col, idx) => {
            return {
                name : col.label,
                idx,
            };
        }),
        outputcolumns : outputColumns.map((col, idx) => {
            return {
                name : col.label,
                idx,
            };
        })
    });
    return rendered;
}




export function getScratchxExtension(
    scratchkey: Types.ScratchKey,
    project: Types.Project,
): Promise<string>
{
    switch (scratchkey.type) {
        case 'text':
            return getTextExtension(scratchkey, project);
        case 'imgtfjs':
            return getImagesTfjsExtension(scratchkey, project);
        case 'numbers':
            return getNumbersExtension(scratchkey, project);
        case 'sounds':
            return getSoundExtension(scratchkey, project);
        default:
            return Promise.resolve('');
    }
}

export function getHybridScratchxExtension(
    scratchkey: Types.ScratchKey,
    project: Types.LocalProject,
    localid: string,
): Promise<string>
{
    if (scratchkey.type !== 'text') {
        throw new Error('Unexpected Scratch key type');
    }

    return getTextExtensionLocalData(scratchkey, project, localid);
}


export function getScratchxExtensionLocalData(
    userid: string,
    projecttype: Types.LocalProjectTypeLabel,
    projectid: string,
    projectname: string,
    labels: string[],
    columns: { label: string, output: boolean}[],
    fields: Types.NumbersProjectFieldSummary[],
): Promise<string>
{
    switch (projecttype) {
        case 'imgtfjs':
            return getImagesTfjsExtensionLocalData(projectid, projectname, labels);
        case 'sounds':
            return getSoundExtensionLocalData(projectid, projectname, labels);
        case 'regression':
            return getRegressionExtensionLocalData(projectid, projectname, columns);
        case 'numbers':
            return getNumbersExtensionLocalData(userid, projectid, projectname, labels, fields);
        default:
            return Promise.resolve('');
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
        projectname : metadata && metadata.modelName ? escapeProjectName(metadata.modelName) : 'ML model',
        labels      : metadata && metadata.labels ? metadata.labels.map((name, idx) => {
            return { name, idx };
        }) : [],
        haslabels   : metadata && metadata.labels && metadata.labels.length > 0,
        modelurl    : scratchtfjs.getModelJsonUrl(modelinfo),
        modeltype   : modelinfo.modeltype,
    });
    return rendered;
}
