// external dependencies
import * as _ from 'lodash';
import * as httpstatus from 'http-status';
// local dependencies
import * as store from '../db/store';
import * as nlc from '../training/nlc';
import * as Types from '../db/db-types';
import * as TrainingTypes from '../training/training-types';
import loggerSetup from '../utils/logger';


const log = loggerSetup();





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
        try {
            const resp = await nlc.testClassifier(key.credentials, key.classifierid, text);
            return resp;
        }
        catch (err) {
            if (err.error &&
                err.error.code === httpstatus.CONFLICT &&
                err.error.error === 'Classifier not ready')
            {
                // the NLC classifier is still training, so we fall-back to random
                const project = await store.getProject(key.projectid);
                return chooseLabelsAtRandom(project);
            }
            else {
                log.error({ err }, 'Unexpected NLC error');
                throw err;
            }
        }
    }
    else {
        // we don't have an NLC classifier yet, so we resort to random
        const project = await store.getProject(key.projectid);
        return chooseLabelsAtRandom(project);
    }
}



async function classifyNumbers(key: Types.ScratchKey, numbers: number[]): Promise<TrainingTypes.Classification[]> {
    if (!numbers || numbers.length === 0) {
        throw new Error('Missing data');
    }
    const project = await store.getProject(key.projectid);
    if (numbers.length !== project.fields.length) {
        throw new Error('Missing data');
    }

    return chooseLabelsAtRandom(project);
}






export function classify(scratchKey: Types.ScratchKey, data: string): Promise<TrainingTypes.Classification[]> {
    if (scratchKey.type === 'text') {
        return classifyText(scratchKey, data);
    }
    else if (scratchKey.type === 'numbers') {
        return classifyNumbers(scratchKey, JSON.parse(data) as number[]);
    }
    else {
        throw new Error('Not implemented yet');
    }
}
