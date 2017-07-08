// local dependencies
import * as Types from '../db/db-types';
import * as TrainingTypes from '../training/training-types';
import * as conversation from '../training/conversation';
import * as ScratchTypes from './scratchx-types';




export function getStatus(scratchKey: Types.ScratchKey): Promise<ScratchTypes.Status> {
    if (!scratchKey.classifierid) {
        return Promise.resolve({
            status : 0,
            msg : 'No models trained yet - only random answers can be chosen',
        });
    }

    if (scratchKey.type === 'text') {
        return getTextClassifierStatus(scratchKey);
    }
    else if (scratchKey.type === 'numbers') {
        return getNumbersClassifierStatus(scratchKey);
    }
    else {
        return Promise.resolve({ status : 0, msg : 'Not implemented yet' });
    }
}




async function getTextClassifierStatus(scratchKey: Types.ScratchKey): Promise<ScratchTypes.Status> {

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
        };
    }
    else if (classifierWithStatus.status === 'Training') {
        return {
            status : 1,
            msg : 'Model not ready yet',
        };
    }

    return {
        status : 0,
        msg : 'Model ' + classifierWithStatus.status,
    };
}





function getNumbersClassifierStatus(scratchKey: Types.ScratchKey): Promise<ScratchTypes.Status> {
    return Promise.resolve({ status : 2, msg : 'PLACEHOLDER for ' + scratchKey.name });
}
