// local dependencies
import * as Types from '../db/db-types';
import * as textmodels from '../training/textmodels';
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
        return textmodels.getScratchKeyStatus(scratchKey);
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
