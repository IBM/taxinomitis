// local dependencies
import * as Types from '../db/db-types';
import * as ScratchTypes from './scratchx-types';
import * as db from '../db/store';
import * as conversation from '../training/conversation';
import * as numbers from '../training/numbers';





export async function trainModel(scratchKey: Types.ScratchKey): Promise<ScratchTypes.Status> {
    if (scratchKey.type !== 'text' && scratchKey.type !== 'numbers') {
        return Promise.reject(new Error('Only text or numbers models can be trained using a Scratch key'));
    }

    try {
        const project = await db.getProject(scratchKey.projectid);
        if (!project) {
            return Promise.reject(new Error('Project not found'));
        }

        if (project.type === 'text') {
            const model = await conversation.trainClassifier(project);
            if (model.status === 'Training') {
                return {
                    status : 1,
                    msg : 'Model not ready yet',
                    type : scratchKey.type,
                };
            }
            else {
                return {
                    status : 0,
                    msg : 'Model ' + model.status,
                    type : scratchKey.type,
                };
            }
        }
        else if (project.type === 'numbers') {
            const model = await numbers.trainClassifier(project);
            if (model.status === 'Available') {
                return {
                    status : 2,
                    msg : 'Ready',
                    type : scratchKey.type,
                };
            }
            else {
                return {
                    status : 0,
                    msg : 'Model Failed',
                    type : scratchKey.type,
                };
            }
        }
        else {
            return Promise.reject(new Error('Only text or numbers models can be trained using a Scratch key'));
        }
    }
    catch (err) {
        return {
            status : 0,
            msg : 'Failed to train machine learning model',
            type : scratchKey.type,
        };
    }
}
