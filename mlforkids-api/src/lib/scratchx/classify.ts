// external dependencies
import * as _ from 'lodash';
// local dependencies
import * as store from '../db/store';
import * as conversation from '../training/conversation';
import * as Types from '../db/db-types';
import * as TrainingTypes from '../training/training-types';
import loggerSetup from '../utils/logger';

const log = loggerSetup();



function chooseLabelsAtRandom(project: Types.Project | Types.LocalProject): TrainingTypes.Classification[] {
    const confidence = Math.round((1 / project.labels.length) * 100);
    return _.shuffle(project.labels).map((label) => {
        return {
            class_name : label,
            confidence,
            random : true,
            classifierTimestamp : new Date(),
        };
    });
}


const TABS_OR_NEWLINES = /\r?\n|\r|\t/gm;

async function classifyText(key: Types.ScratchKey, text: string): Promise<TrainingTypes.Classification[]> {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Missing data');
    }

    if (key.classifierid && key.credentials) {
        // text coming from Scratch sometimes includes new lines
        //  (mainly when retrieved from the Twitter extension)
        //  so to make life easier for those students we'll clean
        //  up the text for them
        text = text.replace(TABS_OR_NEWLINES, ' ');

        // submit the text to the classifier
        const resp = await conversation.testClassifier(
            key.credentials, key.classifierid, key.updated,
            key.projectid, text);
        return resp;
    }
    else {
        // we don't have a Conversation workspace yet, so we resort to random
        let project: Types.Project | Types.LocalProject | undefined = await store.getProject(key.projectid);
        if (!project) {
            project = await store.getLocalProject(key.projectid);
        }
        if (!project) {
            throw new Error('Project not found');
        }
        return chooseLabelsAtRandom(project);
    }
}


async function classifyNumbers(key: Types.ScratchKey): Promise<TrainingTypes.Classification[]> {
    log.error({ key }, 'Unexpected attempt to test browser-hosted model');
    const err: any = new Error('Classification for this project is only available in the browser');
    err.statusCode = 400;
    throw err;
}

async function classifySound(key: Types.ScratchKey): Promise<TrainingTypes.Classification[]> {
    log.error({ key }, 'Unexpected attempt to test sound model');
    const err: any = new Error('Sound classification is only available in the browser');
    err.statusCode = 400;
    throw err;
}

async function classifyImageTfjs(key: Types.ScratchKey): Promise<TrainingTypes.Classification[]> {
    log.warn({ key }, 'Unexpected attempt to test browser-hosted model');
    const err: any = new Error('Classification for this project is only available in the browser');
    err.statusCode = 400;
    throw err;
}




export function classify(scratchKey: Types.ScratchKey, data: any): Promise<TrainingTypes.Classification[]> {
    switch (scratchKey.type) {
    case 'text':
        return classifyText(scratchKey, data as string);
    case 'numbers':
        return classifyNumbers(scratchKey);
    case 'sounds':
        return classifySound(scratchKey);
    case 'imgtfjs':
    case 'images':
        return classifyImageTfjs(scratchKey);
    }
}
