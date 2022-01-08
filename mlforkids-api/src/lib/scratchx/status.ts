// local dependencies
import * as Types from '../db/db-types';
import * as TrainingTypes from '../training/training-types';
import * as conversation from '../training/conversation';
import * as ScratchTypes from './scratchx-types';
import loggerSetup from '../utils/logger';

const log = loggerSetup();




export function getStatus(scratchKey: Types.ScratchKey): Promise<ScratchTypes.Status> {
    if (!scratchKey.classifierid) {
        return Promise.resolve({
            status : scratchKey.type === 'numbers' ? 2 : 0,
            msg : 'No models trained yet - only random answers can be chosen',
            type : scratchKey.type,
        });
    }

    switch (scratchKey.type) {
    case 'text':
        return getTextClassifierStatus(scratchKey);
    case 'images':
        return getImageClassifierStatus();
    case 'numbers':
        return getNumbersClassifierStatus(scratchKey);
    case 'sounds':
        return getSoundClassifierStatus(scratchKey);
    case 'imgtfjs':
        return getImageTfjsClassifierStatus(scratchKey);
    }
}




async function getTextClassifierStatus(scratchKey: Types.ScratchKey): Promise<ScratchTypes.Status> {

    if (scratchKey.credentials && scratchKey.classifierid) {
        const credentials: TrainingTypes.BluemixCredentials = scratchKey.credentials;
        const classifier: TrainingTypes.ConversationWorkspace = {
            id : 'workspaceid',
            name: scratchKey.name,
            workspace_id: scratchKey.classifierid,
            credentialsid: credentials.id,
            created: new Date(),
            expiry: new Date(),
            language: 'en',
            url: scratchKey.credentials.url + '/v1/workspaces/' + scratchKey.classifierid,
        };

        const classifierWithStatus = await conversation.getStatus(credentials, classifier);
        if (classifierWithStatus.status === 'Available') {
            return {
                status : 2,
                msg : 'Ready',
                type : 'text',
            };
        }
        else if (classifierWithStatus.status === 'Training') {
            return {
                status : 1,
                msg : 'Model not ready yet',
                type : 'text',
            };
        }

        return {
            status : 0,
            msg : 'Model ' + classifierWithStatus.status,
            type : 'text',
        };
    }

    return {
        status : 0,
        msg : 'Classifier not found',
        type : 'text',
    };
}



function getImageClassifierStatus(): Promise<ScratchTypes.Status> {
    return Promise.resolve({ status : 0, msg : 'Classifier not found', type : 'images' });
}
function getNumbersClassifierStatus(scratchKey: Types.ScratchKey): Promise<ScratchTypes.Status> {
    return Promise.resolve({ status : 2, msg : 'Status for ' + scratchKey.name, type : 'numbers' });
}
function getSoundClassifierStatus(scratchKey: Types.ScratchKey): Promise<ScratchTypes.Status> {
    log.error({ scratchKey }, 'Unexpected attempt to get status of sound model');
    return Promise.resolve({ status : 0, msg : 'Classifier not found', type : 'sounds' });
}
function getImageTfjsClassifierStatus(scratchKey: Types.ScratchKey): Promise<ScratchTypes.Status> {
    log.error({ scratchKey }, 'Unexpected attempt to get status of browser model');
    return Promise.resolve({ status : 0, msg : 'Classifier not found', type : 'imgtfjs' });
}
