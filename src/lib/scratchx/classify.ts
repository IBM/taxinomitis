// external dependencies
import * as _ from 'lodash';
import * as fs from 'fs';
import * as httpStatus from 'http-status';
// local dependencies
import * as store from '../db/store';
import * as conversation from '../training/conversation';
import * as visualrecog from '../training/visualrecognition';
import * as numberService from '../training/numbers';
import * as Types from '../db/db-types';
import * as TrainingTypes from '../training/training-types';
import * as base64decode from '../utils/base64decode';
import loggerSetup from '../utils/logger';

const log = loggerSetup();



function chooseLabelsAtRandom(project: Types.Project): TrainingTypes.Classification[] {
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
        const project = await store.getProject(key.projectid);
        if (!project) {
            throw new Error('Project not found');
        }
        return chooseLabelsAtRandom(project);
    }
}



async function classifyImage(key: Types.ScratchKey, base64imagedata: string): Promise<TrainingTypes.Classification[]> {
    if (!base64imagedata || typeof base64imagedata !== 'string' || base64imagedata.trim().length === 0) {
        log.warn({ base64imagedata, type : typeof base64imagedata, func : 'classifyImage' }, 'Missing data');
        throw new Error('Missing data');
    }

    if (key.classifierid && key.credentials) {
        const imagefile = await base64decode.run(base64imagedata);

        try {
            const resp = await visualrecog.testClassifierFile(key.credentials,
                                                              key.classifierid,
                                                              key.updated,
                                                              key.projectid,
                                                              imagefile);

            if (resp.length > 0) {
                return resp;
            }
        }
        finally {
            fs.unlink(imagefile, logError);
        }
    }

    // we don't have an image classifier yet, or we didn't get any useful
    //  output from the image classifier.
    // Either way, we resort to random
    const project = await store.getProject(key.projectid);
    if (!project) {
        throw new Error('Project not found');
    }
    return chooseLabelsAtRandom(project);
}


function logError(err?: Error | null) {
    if (err) {
        log.error({ err }, 'Error when deleting image file');
    }
}

/**
 * Parses the provided string as a number if it can be.
 *  If that fails (returns NaN), it returns the original string.
 */
function safeParseFloat(str: string): any {
    const val = parseFloat(str);
    return isNaN(val) ? str : val;
}



async function classifyNumbers(key: Types.ScratchKey, numbers: string[]): Promise<TrainingTypes.Classification[]> {
    if (!numbers || numbers.length === 0 || !Array.isArray(numbers)) {
        throw new Error('Missing data');
    }
    const project = await store.getProject(key.projectid);
    if (!project) {
        throw new Error('Project not found');
    }
    if (numbers.length !== project.numfields) {
        throw new Error('Missing data');
    }

    try {
        if (key.classifierid && key.credentials) {
            const resp = await numberService.testClassifier(
                key.credentials.username,
                key.credentials.password,
                key.updated,
                key.classifierid,
                numbers.map(safeParseFloat));
            return resp;
        }
    }
    catch (err) {
        if (err.statusCode === httpStatus.BAD_REQUEST) {
            log.warn({ err, numbers }, 'Failed to test numbers classifier');
        }
        else {
            log.error({ err, numbers }, 'Failed to test numbers classifier');
        }
    }

    // we don't have a trained functional decision tree,
    //  so we resort to choosing random
    return chooseLabelsAtRandom(project);
}




async function classifySound(key: Types.ScratchKey): Promise<TrainingTypes.Classification[]> {
    log.error({ key }, 'Unexpected attempt to test sound model');
    const err: any = new Error('Sound classification is only available in the browser');
    err.statusCode = 400;
    throw err;
}





export function classify(scratchKey: Types.ScratchKey, data: any): Promise<TrainingTypes.Classification[]> {
    switch (scratchKey.type) {
    case 'text':
        return classifyText(scratchKey, data as string);
    case 'images':
        return classifyImage(scratchKey, data as string);
    case 'numbers':
        return classifyNumbers(scratchKey, data as string[]);
    case 'sounds':
        return classifySound(scratchKey);
    }
}
