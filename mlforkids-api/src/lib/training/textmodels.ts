// core dependencies
import { randomUUID } from 'node:crypto';
// local dependencies
import * as conversation from './conversation';
import * as textservice from './textservice';
import * as store from '../db/store';
import * as DbObjects from '../db/db-types';
import { TEXT_SERVICE_SCRATCHKEY_USERNAME } from '../db/objects';
import * as TrainingObjects from './training-types';
import * as ScratchTypes from '../scratchx/scratchx-types';
import * as notifications from '../notifications/slack';
import * as plaintext from '../utils/plaintext';
import * as env from '../utils/env';
import * as sessionusers from '../sessionusers';
import loggerSetup from '../utils/logger';

const log = loggerSetup();



export const ERROR_MESSAGES = {
    UNKNOWN : 'Failed to train machine learning model',
    MODEL_NOT_FOUND : 'Your machine learning model could not be found on the training server.',
    TEXT_TOO_LONG : 'text cannot be longer than 2048 characters',
    TEXT_NOT_PLAIN : 'Text to classify must be plain text',
    SERVICE_ERROR : 'The cloud service that runs your machine learning model reported an unexpected error',
    SERVICE_BUSY : 'The machine learning server is busy training other models. Please wait a minute and try again.',
    TRAINING_TOO_LARGE : 'Your training data is too big to train a machine learning model. Try using fewer or shorter examples.',
    TOO_MANY_MODELS : 'You have too many machine learning models. Please delete a text project model you no longer need and try again.',
};

// longest text that can be classified
const MAX_TEXT_LENGTH = 2048;




// -----------------------------------------------------------------------------
//
// Training
//
// -----------------------------------------------------------------------------


export async function trainClassifier(
    project: DbObjects.Project,
): Promise<TrainingObjects.TextClassifier>
{
    const training = await getTraining(project);

    return trainClassifierForProject(project, training);
}


export async function trainClassifierForProject(
    project: DbObjects.Project | DbObjects.LocalProject,
    training: TrainingObjects.ConversationTrainingData,
): Promise<TrainingObjects.TextClassifier>
{
    const tenantPolicy = await store.getClassTenant(project.classid);

    const existingWorkspaces = await store.getTextClassifiers(project.id);
    if (existingWorkspaces.length > 0) {
        return retrainModel(project, tenantPolicy, existingWorkspaces[0], training);
    }
    else {
        return createNewModel(project, tenantPolicy, training);
    }
}


// error thrown by the store if a class has no Watson Assistant credentials
const NO_CREDENTIALS_ERROR = 'Unexpected response when retrieving service credentials';


async function chooseServiceForNewModel(tenantPolicy: DbObjects.ClassTenant): Promise<TrainingObjects.BluemixTextServiceType>
{
    if (tenantPolicy.id === sessionusers.CLASS_NAME) {
        return 'conv';
    }

    if (tenantPolicy.tenantType !== DbObjects.ClassTenantType.UnManaged) {
        return 'conv';
    }

    if (await hasWatsonAssistantCredentials(tenantPolicy)) {
        return 'conv';
    }

    if (env.isTextServiceConfigured()) {
        return 'txt';
    }

    // the class has no way to train a text model
    throw new Error(NO_CREDENTIALS_ERROR);
}

async function hasWatsonAssistantCredentials(tenantPolicy: DbObjects.ClassTenant): Promise<boolean>
{
    try {
        const credentials = await store.getBluemixCredentials(tenantPolicy, 'conv');
        return credentials.length > 0;
    }
    catch (err) {
        if (err.message === NO_CREDENTIALS_ERROR) {
            return false;
        }
        throw err;
    }
}


async function createNewModel(
    project: DbObjects.Project | DbObjects.LocalProject,
    tenantPolicy: DbObjects.ClassTenant,
    training: TrainingObjects.ConversationTrainingData,
): Promise<TrainingObjects.TextClassifier>
{
    const servicetype = await chooseServiceForNewModel(tenantPolicy);
    switch (servicetype) {
    case 'conv':
        return createNewWatsonAssistantModel(project, tenantPolicy, training);
    case 'txt':
        return createNewTextServiceModel(project, tenantPolicy, training);
    }
}


async function createNewWatsonAssistantModel(
    project: DbObjects.Project | DbObjects.LocalProject,
    tenantPolicy: DbObjects.ClassTenant,
    training: TrainingObjects.ConversationTrainingData,
): Promise<TrainingObjects.TextClassifier>
{
    const { workspace, credentials } = await conversation.createModel(project, tenantPolicy, training);

    try {
        await store.storeTextClassifier(project, workspace);
        await store.storeOrUpdateScratchKey(project, credentials, workspace.workspace_id, workspace.created);
    }
    catch (err) {
        log.error({ err, project, credentials : credentials.id }, 'Failed to store new text model');
        notifyStoreFailure(project, err);
        throw err;
    }

    return workspace;
}


async function createNewTextServiceModel(
    project: DbObjects.Project | DbObjects.LocalProject,
    tenantPolicy: DbObjects.ClassTenant,
    training: TrainingObjects.ConversationTrainingData,
): Promise<TrainingObjects.TextClassifier>
{
    const numModels = await store.countTextServiceModelsByUser(project.userid);
    if (numModels >= tenantPolicy.maxProjectsPerUser) {
        throw new Error(ERROR_MESSAGES.TOO_MANY_MODELS);
    }

    const trained = await textservice.train(training);

    const now = new Date();
    const model: TrainingObjects.TextClassifier = {
        id : randomUUID(),
        workspace_id : trained.modelid,
        credentialsid : '',
        servicetype : 'txt',
        url : '',
        name : training.name,
        language : training.language,
        created : now,
        updated : now,
        expiry : getTextServiceModelExpiry(tenantPolicy, now),
        status : 'Available',
    };

    try {
        await store.storeTextServiceModel(project, model, trained.head, now);
        await store.storeOrUpdateScratchKey(project, getTextServiceScratchKeyCredentials(project),
                                            model.workspace_id, now);
    }
    catch (err) {
        log.error({ err, project : project.id, model : model.id }, 'Failed to store new text model');
        notifyStoreFailure(project, err);
        throw err;
    }

    return model;
}


function notifyStoreFailure(project: DbObjects.Project | DbObjects.LocalProject, err: Error): void
{
    notifications.notify('Unexpected failure to train text classifier' +
                         ' for project : ' + project.id +
                         ' in class : ' + project.classid + ' : ' +
                         err.message, notifications.SLACK_CHANNELS.TRAINING_ERRORS);
}


function getTextServiceModelExpiry(tenantPolicy: DbObjects.ClassTenant, trained: Date): Date
{
    const expiry = new Date(trained.getTime());
    expiry.setHours(expiry.getHours() + tenantPolicy.textClassifierExpiry);
    return expiry;
}


/**
 * Scratch keys for text service models don't store any credentials,
 *  as they come from env vars. Instead, the username is used as a
 *  marker for the service type.
 */
function getTextServiceScratchKeyCredentials(project: DbObjects.Project | DbObjects.LocalProject): TrainingObjects.BluemixCredentials
{
    return {
        id : '',
        servicetype : 'txt',
        url : '',
        username : TEXT_SERVICE_SCRATCHKEY_USERNAME,
        password : '',
        classid : project.classid,
        credstype : 'unknown',
    };
}


async function retrainModel(
    project: DbObjects.Project | DbObjects.LocalProject,
    tenantPolicy: DbObjects.ClassTenant,
    existing: TrainingObjects.TextClassifier,
    training: TrainingObjects.ConversationTrainingData,
): Promise<TrainingObjects.TextClassifier>
{
    switch (existing.servicetype) {
    case 'conv':
        return retrainWatsonAssistantModel(project, tenantPolicy, existing, training);
    case 'txt':
        return retrainTextServiceModel(project, tenantPolicy, existing, training);
    }
}


async function retrainTextServiceModel(
    project: DbObjects.Project | DbObjects.LocalProject,
    tenantPolicy: DbObjects.ClassTenant,
    existing: TrainingObjects.TextClassifier,
    training: TrainingObjects.ConversationTrainingData,
): Promise<TrainingObjects.TextClassifier>
{
    const trained = await textservice.train(training);

    const now = new Date();
    const model: TrainingObjects.TextClassifier = {
        ...existing,
        // the service returns a new model id every time
        workspace_id : trained.modelid,
        updated : now,
        expiry : getTextServiceModelExpiry(tenantPolicy, now),
        status : 'Available',
    };

    try {
        await store.updateTextServiceModel(project, model, trained.head, now);
        await store.storeOrUpdateScratchKey(project, getTextServiceScratchKeyCredentials(project),
                                            model.workspace_id, now);
    }
    catch (err) {
        log.error({ err, project : project.id, model : model.id }, 'Failed to store retrained text model');
        notifyStoreFailure(project, err);
        throw err;
    }

    return model;
}


async function retrainWatsonAssistantModel(
    project: DbObjects.Project | DbObjects.LocalProject,
    tenantPolicy: DbObjects.ClassTenant,
    existing: TrainingObjects.TextClassifier,
    training: TrainingObjects.ConversationTrainingData,
): Promise<TrainingObjects.TextClassifier>
{
    try {
        const { workspace } = await conversation.updateModel(project, tenantPolicy, existing, training);

        await store.updateTextClassifierExpiry(workspace);

        const timestamp = workspace.updated ? workspace.updated : workspace.created;
        await store.updateScratchKeyTimestamp(project, timestamp);

        return workspace;
    }
    catch (err) {
        if (err.message === ERROR_MESSAGES.MODEL_NOT_FOUND) {
            // the model could not be found - it was likely deleted
            //  from outside of the tool, so delete the DB reference
            //  so that the user can try again and this time create
            //  a new model
            try {
                await store.deleteTextClassifier(existing.id);
            }
            catch (deleteErr) {
                // still report the missing model to the user
                log.error({ err : deleteErr, workspace : existing }, 'Failed to delete record of missing model');
            }
        }
        throw err;
    }
}


/**
 * Training for a Scratch key for a cloud project, using the training
 *  stored in the DB - returns the response for the Scratch extension.
 */
export async function trainWithScratchKey(project: DbObjects.Project): Promise<ScratchTypes.Status>
{
    const model = await trainClassifier(project);
    return getScratchStatus(model.status);
}


/**
 * Training for a Scratch key for a local project, using the provided
 *  training data - returns the response for the Scratch extension.
 */
export async function trainLocalWithScratchKey(
    project: DbObjects.LocalProject,
    training: TrainingObjects.ConversationTrainingData,
): Promise<ScratchTypes.Status>
{
    const model = await trainClassifierForProject(project, training);
    return getScratchStatus(model.status);
}


function getScratchStatus(status: TrainingObjects.ClassifierStatus | undefined): ScratchTypes.Status
{
    if (status === 'Available') {
        return {
            status : 2,
            msg : 'Ready',
            type : 'text',
        };
    }
    else if (status === 'Training') {
        return {
            status : 1,
            msg : 'Model not ready yet',
            type : 'text',
        };
    }

    return {
        status : 0,
        msg : 'Model ' + status,
        type : 'text',
    };
}




// -----------------------------------------------------------------------------
//
// Deleting
//
// -----------------------------------------------------------------------------


/**
 * Deletes a text model.
 *  This deletes both the model from the service that hosts it, and the
 *  record of it stored in the app's database.
 */
export async function deleteClassifier(tenant: DbObjects.ClassTenant, classifier: TrainingObjects.TextClassifier): Promise<void>
{
    if (classifier.servicetype === 'conv') {
        await conversation.deleteModel(tenant, classifier);
    }
    // the text service doesn't store models, so text
    //  service models only need deleting from the DB
    await deleteModelRecords(classifier);
}


async function deleteModelRecords(classifier: TrainingObjects.TextClassifier): Promise<void>
{
    await store.deleteTextClassifier(classifier.id);
    await store.resetExpiredScratchKey(classifier.workspace_id, 'text');
}


async function deleteExpiredModel(classifier: TrainingObjects.TextClassifier): Promise<void>
{
    if (classifier.servicetype === 'conv') {
        await conversation.deleteModelUnknownClass(classifier);
    }
    await deleteModelRecords(classifier);
}


export async function cleanupExpiredModels(): Promise<void[]>
{
    log.info('Cleaning up expired text models');
    const expired: TrainingObjects.TextClassifier[] = await store.getExpiredConversationWorkspaces();
    return Promise.all(expired.map(deleteExpiredModel));
}




// -----------------------------------------------------------------------------
//
// Status
//
// -----------------------------------------------------------------------------


/**
 * Updates the provided set of text models with their current status.
 *
 * @param tenant - the class that the models belong to
 * @param workspaces - set of models to get status info for
 *
 * @returns the same set of models, with the status and updated timestamp
 *  properties set using responses from the service that hosts them
 */
export function getModelStatuses(
    tenant: DbObjects.ClassTenant,
    workspaces: TrainingObjects.TextClassifier[],
): Promise<TrainingObjects.TextClassifier[]>
{
    const credentialsCacheById: { [id: string]: TrainingObjects.BluemixCredentials } = {};

    return Promise.all(
        workspaces.map(async (workspace) => {
            if (workspace.servicetype === 'txt') {
                return getTextServiceModelStatus(workspace);
            }

            if (workspace.credentialsid in credentialsCacheById === false) {
                try {
                    const creds = await conversation.getModelCredentials(tenant, workspace);
                    credentialsCacheById[workspace.credentialsid] = creds;
                }
                catch (err) {
                    log.error({ err }, 'Credentials for Conversation workspace are missing');
                    workspace.status = 'Unavailable';
                    return workspace;
                }
            }
            return conversation.getModelStatus(credentialsCacheById[workspace.credentialsid], workspace);
        }),
    );
}


async function getTextServiceModelStatus(model: TrainingObjects.TextClassifier): Promise<TrainingObjects.TextClassifier>
{
    const updated = await store.getTextClassifierHeadUpdated(model.id);
    if (updated) {
        model.status = 'Available';
        model.updated = updated;
    }
    else {
        model.status = 'Non Existent';
    }
    return model;
}


/**
 * Creates (or updates) the Scratch key for a text project, pointing it
 *  at the project's text model, if it has one.
 */
export async function createTextScratchKey(project: DbObjects.Project | DbObjects.LocalProject): Promise<ScratchTypes.Key>
{
    const textClassifiers = await store.getTextClassifiers(project.id);

    if (textClassifiers.length === 0) {
        const id = await store.storeUntrainedScratchKey(project);
        return { id };
    }
    else {
        const classifier = textClassifiers[0];
        const model = classifier.workspace_id;

        let credentials: TrainingObjects.BluemixCredentials;
        switch (classifier.servicetype) {
        case 'conv': {
            const tenant = await store.getClassTenant(project.classid);
            credentials = await conversation.getModelCredentials(tenant, classifier);
            break;
        }
        case 'txt':
            credentials = getTextServiceScratchKeyCredentials(project);
            break;
        }

        const id = await store.storeOrUpdateScratchKey(project,
            credentials, classifier.workspace_id, classifier.created);

        return { id, model };
    }
}


/**
 * Gets the status of the text model for a Scratch key - returns the
 *  response for the Scratch extension.
 */
export async function getScratchKeyStatus(scratchKey: DbObjects.ScratchKey): Promise<ScratchTypes.Status>
{
    const model = getScratchKeyModel(scratchKey);
    switch (model.servicetype) {
    case 'conv': {
        const classifierWithStatus = await conversation.getScratchKeyModelStatus(
            model.credentials, model.classifierid, scratchKey.name);
        return getScratchStatus(classifierWithStatus.status);
    }
    case 'txt': {
        let status: TrainingObjects.ClassifierStatus;
        try {
            const workspace = await getModelRecord(scratchKey.projectid, model.classifierid);
            const withStatus = await getTextServiceModelStatus(workspace);
            status = withStatus.status as TrainingObjects.ClassifierStatus;
        }
        catch (err) {
            if (err.message !== ERROR_MESSAGES.MODEL_NOT_FOUND) {
                throw err;
            }
            status = 'Non Existent';
        }
        return getScratchStatus(status);
    }
    }
}


/**
 * The model that a Scratch key is for.
 *
 * Keys for Watson Assistant models include the credentials needed
 *  to use the model. Keys for text service models don't, as every
 *  call goes to the local text service.
 */
type ScratchKeyModel = {
    readonly servicetype: 'conv';
    readonly classifierid: string;
    readonly credentials: TrainingObjects.BluemixCredentials;
} | {
    readonly servicetype: 'txt';
    readonly classifierid: string;
};


function getScratchKeyModel(scratchKey: DbObjects.ScratchKey): ScratchKeyModel
{
    if (!scratchKey.credentials || !scratchKey.classifierid) {
        // callers check this before using a key to access a model
        throw new Error('Scratch key has no model');
    }
    if (scratchKey.credentials.servicetype === 'txt') {
        return {
            servicetype : 'txt',
            classifierid : scratchKey.classifierid,
        };
    }
    return {
        servicetype : 'conv',
        classifierid : scratchKey.classifierid,
        credentials : scratchKey.credentials,
    };
}




// -----------------------------------------------------------------------------
//
// Classifying
//
// -----------------------------------------------------------------------------


/**
 * Classifies text using the model with the provided id.
 *
 * Throws MODEL_NOT_FOUND if there is no record of the model.
 */
export async function classifyModel(
    tenant: DbObjects.ClassTenant,
    projectid: string, modelid: string, classifierTimestamp: Date,
    text: string,
): Promise<TrainingObjects.Classification[]>
{
    const workspace = await getModelRecord(projectid, modelid);

    switch (workspace.servicetype) {
    case 'conv': {
        const credentials = await conversation.getModelCredentials(tenant, workspace);
        return classify(projectid, classifierTimestamp, text,
            () => conversation.classify(credentials, modelid, classifierTimestamp, text));
    }
    case 'txt':
        return classify(projectid, classifierTimestamp, text,
            () => classifyWithTextServiceModel(workspace, classifierTimestamp, text));
    }
}


export async function classifyWithScratchKey(scratchKey: DbObjects.ScratchKey, text: string): Promise<TrainingObjects.Classification[]>
{
    const model = getScratchKeyModel(scratchKey);
    switch (model.servicetype) {
    case 'conv':
        return classify(scratchKey.projectid, scratchKey.updated, text,
            () => conversation.classify(model.credentials, model.classifierid, scratchKey.updated, text));
    case 'txt': {
        const workspace = await getModelRecord(scratchKey.projectid, model.classifierid);
        return classify(scratchKey.projectid, scratchKey.updated, text,
            () => classifyWithTextServiceModel(workspace, scratchKey.updated, text));
    }
    }
}


async function getModelRecord(projectid: string, modelid: string): Promise<TrainingObjects.TextClassifier>
{
    try {
        return await store.getTextClassifier(projectid, modelid);
    }
    catch (err) {
        if (err.message === 'Unexpected response when retrieving text classifier details') {
            // no record of the model - it was likely deleted (e.g. because
            //  it expired) while the user was trying to use it
            throw new Error(ERROR_MESSAGES.MODEL_NOT_FOUND);
        }
        throw err;
    }
}


function classifyWithTextServiceModel(
    workspace: TrainingObjects.TextClassifier,
    classifierTimestamp: Date,
    text: string,
): Promise<TrainingObjects.Classification[]>
{
    // the head is only read if the text service doesn't
    //  already have the model cached
    const getHead = async (): Promise<Buffer> => {
        const stored = await store.getTextClassifierHead(workspace.id);
        if (!stored) {
            throw new Error(ERROR_MESSAGES.MODEL_NOT_FOUND);
        }
        return stored.head;
    };

    return textservice.classify(workspace.workspace_id, classifierTimestamp, text, getHead);
}


/**
 * Checks the text, before classifying it using the provided function.
 */
async function classify(
    projectid: string,
    classifierTimestamp: Date,
    text: string,
    classifyUsingService: () => Promise<TrainingObjects.Classification[]>,
): Promise<TrainingObjects.Classification[]>
{
    if (!plaintext.isPlainText(text)) {
        throw new Error(ERROR_MESSAGES.TEXT_NOT_PLAIN);
    }
    if (text.length > MAX_TEXT_LENGTH) {
        throw new Error(ERROR_MESSAGES.TEXT_TOO_LONG);
    }

    const classifications = await classifyUsingService();
    if (classifications.length === 0) {
        const project = await store.getProject(projectid);
        if (project) {
            return [ chooseLabelAtRandom(project, classifierTimestamp) ];
        }
        else {
            return [];
        }
    }
    return classifications;
}


function chooseLabelAtRandom(project: DbObjects.Project, classifierTimestamp: Date): TrainingObjects.Classification {
    const randomIndex = Math.floor(Math.random() * project.labels.length);
    return {
        class_name : project.labels[randomIndex],
        confidence : 0,
        random : true,
        classifierTimestamp,
    };
}




// -----------------------------------------------------------------------------
//
// Training data
//
// -----------------------------------------------------------------------------


async function getTraining(project: DbObjects.Project): Promise<TrainingObjects.ConversationTrainingData> {
    const counts = await store.countTrainingByLabel(project);

    const intents: TrainingObjects.ConversationIntent[] = [];
    for (const label of project.labels) {

        if (label in counts && counts[label] > 0) {
            const training = await store.getUniqueTrainingTextsByLabel(project.id, label, {
                start : 0, limit : counts[label],
            });

            const intentTraining: TrainingObjects.ConversationIntent = {
                intent : label.replace(/\s/g, '_'),
                examples : [],
            };

            const duplicatesCheck: string[] = [];
            for (const text of training) {
                const caseInsensitiveText = normalizeText(text);

                if (!duplicatesCheck.includes(caseInsensitiveText)) {
                    intentTraining.examples.push({ text });
                    duplicatesCheck.push(caseInsensitiveText);
                }
            }

            intents.push(intentTraining);
        }
    }

    return {
        name : project.name,
        language : project.language ? project.language : 'en',
        intents,
        dialog_nodes : [],
        counterexamples: [],
        entities : [],
        metadata : {
            createdby : 'machinelearningforkids',
        },
    };
}


export function validateTraining(obj: TrainingObjects.ConversationTrainingData): boolean
{
    return obj &&
           !!obj.name &&
           obj.language &&
           obj.intents && Array.isArray(obj.intents) && obj.intents.every(validateIntent) &&
           obj.entities && Array.isArray(obj.entities) &&
           obj.dialog_nodes && Array.isArray(obj.dialog_nodes);
}

export function isPlainTextTraining(obj: TrainingObjects.ConversationTrainingData): boolean
{
    return obj.intents.every((intent) => {
        return intent.examples.every((example) => plaintext.isPlainText(example.text));
    });
}

export function sanitizeTraining(obj:TrainingObjects.ConversationTrainingData): TrainingObjects.ConversationTrainingData
{
    // https://cloud.ibm.com/apidocs/assistant-v1#createworkspace
    return {
        name : obj.name.replace(/[\t\n]/g, '_').substring(0, 64),
        language : obj.language,
        intents : obj.intents.map((origintent) => {
            const normalizedExamples: string[] = [];
            return {
                intent : origintent.intent.replace(/[^A-Za-z0-9_\-.]/g, '_').substring(0, 128),
                examples : origintent.examples
                            .map(example => example.text.replace(/[\t\n]/g, ' ').trim().substring(0, 1024).trim())
                            .filter(txt => txt.length > 0)
                            .filter((txt) => {
                                const normalized = normalizeText(txt);
                                if (normalizedExamples.includes(normalized)) {
                                    // already got something like this in the training - filter it out
                                    return false;
                                }
                                else {
                                    // record this example to prevent future duplicates being added
                                    normalizedExamples.push(normalized);
                                    return true;
                                }
                            })
                            .map((text) => { return {text} })
            };
        }),
        dialog_nodes : [],
        counterexamples : [],
        entities : [],
        metadata : {
            createdby: 'machinelearningforkids',
        }
    };
}

export function getLabelNamesFromTraining(obj: TrainingObjects.ConversationTrainingData): string[]
{
    return obj.intents.map((intentObj) => {
        return intentObj.intent;
    });
}

function validateIntent(obj: TrainingObjects.ConversationIntent): boolean
{
    return obj &&
           !!obj.intent &&
           obj.examples.every((example) => {
               return typeof example.text === 'string';
           });
}


export function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        // remove accents
        .replace(/[\u0300-\u036f]/g, '');
}
