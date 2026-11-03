// local dependencies
import * as Types from '../db/db-types';
import * as TrainingTypes from '../training/training-types';
import * as ScratchTypes from './scratchx-types';
import * as db from '../db/store';
import * as textmodels from '../training/textmodels';
import * as numbers from '../training/numbers';
import loggerSetup from '../utils/logger';

const log = loggerSetup();




// training errors that students can do something about, so
//  are returned to Scratch instead of a generic error
const TRAINING_ERRORS_TO_RETURN = [
    textmodels.ERROR_MESSAGES.SERVICE_BUSY,
    textmodels.ERROR_MESSAGES.TRAINING_TOO_LARGE,
    textmodels.ERROR_MESSAGES.TOO_MANY_MODELS,
];

function getTrainingFailureStatus(scratchKey: Types.ScratchKey, err: Error): ScratchTypes.Status {
    return {
        status : 0,
        msg : TRAINING_ERRORS_TO_RETURN.includes(err.message) ?
            err.message :
            'Failed to train machine learning model',
        type : scratchKey.type,
    };
}



export async function trainTextModelLocalProject(
    scratchKey: Types.ScratchKey,
    trainingData: TrainingTypes.ConversationTrainingData,
    client?: Types.TextServiceUsageClient,
): Promise<ScratchTypes.Status> {
    if (scratchKey.type !== 'text') {
        return Promise.reject(new Error('Only text models can be trained using a Scratch key'));
    }

    try {
        const project = await db.getLocalProject(scratchKey.projectid);
        if (!project) {
            return Promise.reject(new Error('Project not found'));
        }

        if (project.type === 'text') {
            const status = await textmodels.trainLocalWithScratchKey(project, trainingData, client);

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
        return getTrainingFailureStatus(scratchKey, err);
    }
}



export async function trainModel(
    scratchKey: Types.ScratchKey,
    client?: Types.TextServiceUsageClient,
): Promise<ScratchTypes.Status | numbers.NumbersApiResponsePayloadClassifierItem> {
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
            return await textmodels.trainWithScratchKey(project, client);
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
        return getTrainingFailureStatus(scratchKey, err);
    }
}
