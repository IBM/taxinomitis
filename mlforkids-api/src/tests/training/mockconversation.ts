// Mock responses from the Watson Assistant API, and the workspaces
//  that they describe, shared by the tests for the WA adapter
//  (conversation.ts) and the text models layer (textmodels.ts)

import { v1 as uuid } from 'uuid';
import * as assert from 'assert';

import * as conversation from '../../lib/training/conversation';
import * as TrainingTypes from '../../lib/training/training-types';

import loggerSetup from '../../lib/utils/logger';

const log = loggerSetup();



export const newClassifierDate = new Date();
newClassifierDate.setMilliseconds(0);
export const newExpiryDate = new Date();
newExpiryDate.setMilliseconds(0);
newExpiryDate.setHours(newClassifierDate.getHours() + 2);

export const mockConversation = {
    getClassifier : (url: string) => {
        const prom: unknown = new Promise((resolve, reject) => {
            switch (url) {
            case 'http://conversation.service/v1/workspaces/good':
                return resolve(goodClassifierStatus);
            case 'http://conversation.service/v1/workspaces/bad':
                return resolve(brokenClassifierStatus);
            case 'http://conversation.service/v1/workspaces/stillgoing':
                return resolve(trainingClassifierStatus);
            default:
                return reject({
                    error : 'Resource not found',
                });
            }
        });
        return prom as Promise<any>;
    },
    deleteClassifier : (url: string) => {
        const prom: unknown = new Promise((resolve, reject) => {
            switch (url) {
            case 'http://conversation.service/v1/workspaces/good':
                return resolve('');
            case 'http://conversation.service/v1/workspaces/bad':
                return resolve('');
            case 'http://conversation.service/v1/workspaces/stillgoing':
                return resolve('');
            default:
                return reject({ error : 'Resource not found' });
            }
        });
        return prom as Promise<any>;
    },
    createClassifier : (url: string, options: conversation.LegacyTrainingRequest) => {
        log.debug({ url, options }, 'mock create classifier');
        assert.strictEqual(options.headers['X-Watson-Learning-Opt-Out'], 'true');
        return new Promise((resolve, reject) => {
            if (options.body.name === 'Bob\'s text project') {

                resolve({
                    name : options.body.name,
                    created : newClassifierDate.toISOString(),
                    updated : newClassifierDate.toISOString(),
                    language : options.body.language,
                    metadata : null,
                    description : null,
                    workspace_id : '04f2d303-16fd-4f2e-80f4-2c66784cc0fe',
                });
            }
            else if (options.body.name === 'Coming Too Fast') {
                reject({
                    error : {
                        error : 'Rate limit exceeded',
                        code : 429,
                    },
                });
            }
            else if (options.body.name === 'Too Many Models') {
                reject({
                    error : {
                        error : 'Maximum workspaces limit exceeded. Limit = 5',
                        code : 400,
                    },
                });
            }
            else if (options.body.name === 'Watson Under Maintenance') {
                reject({
                    statusCode : 500,
                    error : {
                        error : 'Service is currently undergoing maintenance.',
                        code : 500,
                    },
                });
            }
            else if (options.body.name === 'existing' &&
                     url.endsWith('/existing-classifier'))
            {
                resolve({
                    name : options.body.name,
                    created : new Date().toISOString(),
                    updated : new Date().toISOString(),
                    language : options.body.language,
                    metadata : null,
                    description : null,
                    workspace_id : 'existing-classifier',
                });
            }
            else if (url.endsWith('/deleted-from-watson')) {
                reject({
                    statusCode : 404,
                    error : {
                        error : 'Resource not found',
                        code : 404,
                    },
                });
            }
            else if (url.endsWith('/existing-classifier-maintenance')) {
                reject({
                    statusCode : 500,
                    error : {
                        error : 'Service is currently undergoing maintenance.',
                        code : 500,
                    },
                });
            }
            else {
                reject({
                    error : {
                        error : 'Invalid Request Body',
                        errors : [
                            {
                                message : 'text cannot be longer than 1024 characters',
                                path : '.intents[0].examples[0].text',
                            },
                        ],
                    },
                });
            }
        });
    },
    testClassifier : (url: string, opts: conversation.LegacyTestRequest) => {
        assert.strictEqual(opts.headers['X-Watson-Learning-Opt-Out'], 'true');
        return new Promise((resolve, reject) => {
            switch (url) {
            case 'http://conversation.service/v1/workspaces/broken500/message':
                return reject({
                    statusCode : 500,
                    error : {
                        error : 'Classification Error: A runtime error occurred',
                        code : 500,
                    },
                });
            case 'http://conversation.service/v1/workspaces/toolong/message':
                return reject({
                    statusCode : 400,
                    error : {
                        error : 'Invalid Request Body',
                        code : 400,
                        errors : [
                            {
                                message : 'text cannot be longer than 2048 characters',
                                path : '.input.text',
                            },
                        ],
                    },
                });
            case 'http://conversation.service/v1/workspaces/good/message':
                return resolve({
                    intents : [
                        {
                            intent : 'temperature',
                            confidence : 0.9998201258549781,
                        },
                        {
                            intent : 'conditions',
                            confidence : 0.00017987414502176904,
                        },
                    ],
                    entities : [],
                    input : { text : opts.body.input.text },
                    output : {
                        text : [],
                        nodes_visited : [],
                        warning : 'No dialog node matched for the input at a root level. ' +
                                    '(and there is 1 more warning in the log)',
                        log_messages : [
                            {
                                level : 'warn',
                                msg : 'No dialog node matched for the input at a root level.',
                            },
                            {
                                level : 'warn',
                                msg : 'No dialog node condition matched to true in the last dialog round ' +
                                        '- context.nodes_visited is empty. ' +
                                        'Falling back to the root node in the next round.',
                            },
                        ],
                    },
                    context : {
                        conversation_id : uuid(),
                        system : {
                            dialog_stack : [
                                {
                                    dialog_node : 'root',
                                },
                            ],
                            dialog_turn_counter : 1,
                            dialog_request_counter : 1,
                        },
                    },
                });
            case 'http://conversation.service/v1/workspaces/bad/message':
                return resolve({
                    intents : [],
                    entities : [],
                    input : { text : opts.body.input.text },
                    output : {
                        text : [],
                        nodes_visited : [],
                        warning : 'No dialog node matched for the input at a root level. ' +
                                    '(and there is 1 more warning in the log)',
                        log_messages : [
                            {
                                level : 'warn',
                                msg : 'No dialog node matched for the input at a root level.',
                            },
                            {
                                level : 'warn',
                                msg : 'No dialog node condition matched to true in the last dialog round ' +
                                        '- context.nodes_visited is empty. ' +
                                        'Falling back to the root node in the next round.',
                            },
                        ],
                    },
                    context : {
                        conversation_id : uuid(),
                        system : {
                            dialog_stack : [
                                {
                                    dialog_node : 'root',
                                },
                            ],
                            dialog_turn_counter : 1,
                            dialog_request_counter : 1,
                        },
                    },
                });
            case 'http://conversation.service/v1/workspaces/stillgoing/message':
                return resolve({
                    intents : [],
                    entities : [],
                    input : { text : opts.body.input.text },
                    output : {
                        text : [],
                        nodes_visited : [],
                        warning : 'No dialog node matched for the input at a root level. ' +
                                    '(and there is 1 more warning in the log)',
                        log_messages : [
                            {
                                level : 'warn',
                                msg : 'No dialog node matched for the input at a root level.',
                            },
                            {
                                level : 'warn',
                                msg : 'No dialog node condition matched to true in the last dialog round ' +
                                        '- context.nodes_visited is empty. ' +
                                        'Falling back to the root node in the next round.',
                            },
                        ],
                    },
                    context : {
                        conversation_id : uuid(),
                        system : {
                            dialog_stack : [
                                {
                                    dialog_node : 'root',
                                },
                            ],
                            dialog_turn_counter : 1,
                            dialog_request_counter : 1,
                        },
                    },
                });
            }
        });
    },
};


export const goodClassifier: TrainingTypes.ConversationWorkspace = {
    id : uuid(),
    credentialsid : '123',
    name : 'good classifier',
    language : 'fr',
    created : new Date(),
    expiry : new Date(),
    url : 'http://conversation.service/v1/workspaces/good',
    workspace_id : 'good',
};
export const goodClassifierWithStatus = Object.assign({}, goodClassifier, {
    status : 'Available',
    updated : goodClassifier.created,
});

export const goodClassifierStatus = {
    name : goodClassifier.name,
    language : goodClassifier.language,
    metadata : null,
    description : null,
    workspace_id : 'good',
    status : 'Available',
    created : goodClassifier.created.toISOString(),
    updated : goodClassifier.created.toISOString(),
};



export const trainingClassifier: TrainingTypes.ConversationWorkspace = {
    id : uuid(),
    credentialsid : '123',
    name : 'try again later',
    language : 'fr',
    created : new Date(),
    expiry : new Date(),
    url : 'http://conversation.service/v1/workspaces/stillgoing',
    workspace_id : 'stillgoing',
};
export const trainingClassifierWithStatus = Object.assign({}, trainingClassifier, {
    status : 'Training',
    updated : trainingClassifier.created,
});

export const trainingClassifierStatus = {
    name : trainingClassifier.name,
    language : trainingClassifier.language,
    metadata : null,
    description : null,
    workspace_id : 'stillgoing',
    status : 'Training',
    created : trainingClassifier.created.toISOString(),
    updated : trainingClassifier.created.toISOString(),
};



export const brokenClassifier: TrainingTypes.ConversationWorkspace = {
    id : uuid(),
    credentialsid : '123',
    name : 'bad bad bad',
    language : 'fr',
    created : new Date(),
    expiry : new Date(),
    url : 'http://conversation.service/v1/workspaces/bad',
    workspace_id : 'bad',
};
export const brokenClassifierWithStatus = Object.assign({}, brokenClassifier, {
    status : 'Failed',
    updated : brokenClassifier.created,
});

export const brokenClassifierStatus = {
    name : brokenClassifier.name,
    language : brokenClassifier.language,
    metadata : null,
    description : null,
    workspace_id : 'bad',
    status : 'Failed',
    created : brokenClassifier.created.toISOString(),
    updated : brokenClassifier.created.toISOString(),
};


export const unknownClassifier: TrainingTypes.ConversationWorkspace = {
    id : uuid(),
    credentialsid : '123',
    name : 'not here any more',
    language : 'fr',
    created : new Date(),
    expiry : new Date(),
    url : 'http://conversation.service/v1/workspaces/deleted',
    workspace_id : 'deleted',
};
export const unknownClassifierWithStatus = Object.assign({}, unknownClassifier, {
    status : 'Non Existent',
});



export const existingClassifier: TrainingTypes.ConversationWorkspace = {
    id : 'existingworkspacedbid',
    credentialsid : '123',
    name : 'existing',
    language : 'de',
    created : new Date(),
    expiry : new Date(),
    url : 'http://conversation.service/v1/workspaces/existing-classifier',
    workspace_id : 'existing-classifier',
};
