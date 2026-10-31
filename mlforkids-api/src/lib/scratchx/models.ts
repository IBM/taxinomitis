// local dependencies
import * as Types from '../db/db-types';
import * as TrainingTypes from '../training/training-types';
import * as ScratchTypes from './scratchx-types';
import * as db from '../db/store';
import * as textmodels from '../training/textmodels';
import * as numbers from '../training/numbers';
import loggerSetup from '../utils/logger';

const log = loggerSetup();




export async function trainTextModelLocalProject(scratchKey: Types.ScratchKey, trainingData: TrainingTypes.ConversationTrainingData): Promise<ScratchTypes.Status> {
    if (scratchKey.type !== 'text') {
        return Promise.reject(new Error('Only text models can be trained using a Scratch key'));
    }

    try {
        const project = await db.getLocalProject(scratchKey.projectid);
        if (!project) {
            return Promise.reject(new Error('Project not found'));
        }

        if (project.type === 'text') {
            const status = await textmodels.trainLocalWithScratchKey(project, trainingData);

            // lazily (after returning response to the user) update
            //  the expiry date and labels for the project
            project.labels = textmodels.getLabelNamesFromTraining(trainingData);
            db.updateLocalProject(project);

            return status;
        }
        else {
            return Promise.reject(new Error('Only text models can be trained using a Scratch key'));
        }
    }
    catch (err) {
        log.error({ err, scratchKey }, 'Failed to train model');
        return {
            status : 0,
            msg : 'Failed to train machine learning model',
            type : scratchKey.type,
        };
    }
}



export async function trainModel(scratchKey: Types.ScratchKey): Promise<ScratchTypes.Status | numbers.NumbersApiResponsePayloadClassifierItem> {
    if (scratchKey.type !== 'text' && scratchKey.type !== 'numbers') {
        return Promise.reject(new Error('Only text or numbers models can be trained using a Scratch key'));
    }

    try {
        const project = await db.getProject(scratchKey.projectid);
        if (!project) {
            return Promise.reject(new Error('Project not found'));
        }

        if (project.type === 'text') {
            // awaited so that training errors are handled below
            return await textmodels.trainWithScratchKey(project);
        }
        else if (project.type === 'numbers') {
            return numbers.trainClassifierCloudProject(project);
        }
        else {
            return Promise.reject(new Error('Only text or numbers models can be trained using a Scratch key'));
        }
    }
    catch (err) {
        log.error({ err, scratchKey }, 'Failed to train model');
        return {
            status : 0,
            msg : 'Failed to train machine learning model',
            type : scratchKey.type,
        };
    }
}
