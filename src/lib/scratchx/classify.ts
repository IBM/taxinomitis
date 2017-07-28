// external dependencies
import * as _ from 'lodash';
import * as httpstatus from 'http-status';
// local dependencies
import * as store from '../db/store';
import * as conversation from '../training/conversation';
import * as visualrecog from '../training/visualrecognition';
import * as numberService from '../training/numbers';
import * as Types from '../db/db-types';
import * as TrainingTypes from '../training/training-types';
import * as base64decode from '../utils/base64decode';




function chooseLabelsAtRandom(project: Types.Project): TrainingTypes.Classification[] {
    const confidence = Math.round((1 / project.labels.length) * 100);
    return _.shuffle(project.labels).map((label) => {
        return { class_name : label, confidence, random : true };
    });
}


async function classifyText(key: Types.ScratchKey, text: string): Promise<TrainingTypes.Classification[]> {
    if (!text || text.trim().length === 0) {
        throw new Error('Missing data');
    }

    if (key.classifierid && key.credentials) {
        const resp = await conversation.testClassifier(key.credentials, key.classifierid, key.projectid, text);
        return resp;
    }
    else {
        // we don't have a Conversation workspace yet, so we resort to random
        const project = await store.getProject(key.projectid);
        return chooseLabelsAtRandom(project);
    }
}



async function classifyImage(key: Types.ScratchKey, base64imagedata: string): Promise<TrainingTypes.Classification[]> {
    if (!base64imagedata || base64imagedata.trim().length === 0) {
        throw new Error('Missing data');
    }

    if (key.classifierid && key.credentials) {
        const imagefile = await base64decode.run(base64imagedata);
        const resp = await visualrecog.testClassifierFile(key.credentials, key.classifierid, key.projectid, imagefile);
        return resp;
    }
    else {
        // we don't have a Conversation workspace yet, so we resort to random
        const project = await store.getProject(key.projectid);
        return chooseLabelsAtRandom(project);
    }
}



async function classifyNumbers(key: Types.ScratchKey, numbers: string[]): Promise<TrainingTypes.Classification[]> {
    if (!numbers || numbers.length === 0) {
        throw new Error('Missing data');
    }
    const project = await store.getProject(key.projectid);
    if (numbers.length !== project.fields.length) {
        throw new Error('Missing data');
    }

    if (key.classifierid && key.credentials) {
        const resp = await numberService.testClassifier(
            key.credentials.username,
            key.credentials.password,
            key.classifierid,
            numbers.map(parseFloat));
        return resp;
    }
    else {
        // we don't have a Conversation workspace yet, so we resort to random
        return chooseLabelsAtRandom(project);
    }
}






export function classify(scratchKey: Types.ScratchKey, data: any): Promise<TrainingTypes.Classification[]> {
    if (scratchKey.type === 'text') {
        return classifyText(scratchKey, data as string);
    }
    else if (scratchKey.type === 'images') {
        return classifyImage(scratchKey, data as string);
    }
    else if (scratchKey.type === 'numbers') {
        return classifyNumbers(scratchKey, data as string[]);
    }
    else {
        throw new Error('Not implemented yet');
    }
}
