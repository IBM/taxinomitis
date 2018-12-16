// local dependencies
import * as Types from '../db/db-types';
import * as ScratchTypes from './scratchx-types';
import * as db from '../db/store';
import * as conversation from '../training/conversation';






export async function trainModel(scratchKey: Types.ScratchKey): Promise<ScratchTypes.Status> {
    if (scratchKey.type !== 'text') {
        return Promise.reject(new Error('Only text models can be trained using a Scratch key'));
    }

    try {
        const project = await db.getProject(scratchKey.projectid);
        if (!project) {
            return Promise.reject(new Error('Project not found'));
        }

        const model = await conversation.trainClassifier(project);
        if (model.status === 'Training') {
            return {
                status : 1,
                msg : 'Model not ready yet',
            };
        }
        else {
            return {
                status : 0,
                msg : 'Model ' + model.status,
            };
        }
    }
    catch (err) {
        return {
            status : 0,
            msg : 'Failed to train machine learning model',
        };
    }
}
