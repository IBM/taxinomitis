// core dependencies
import { randomUUID } from 'node:crypto';
// local dependencies
import * as conversation from './conversation';
import * as textservice from './textservice';
import * as textserviceusage from './textserviceusage';
import * as store from '../db/store';
import * as DbObjects from '../db/db-types';
import {
    TEXT_SERVICE_SCRATCHKEY_USERNAME,
    getTextServiceTrainingStatus, isAbandonedTextServiceTraining,
} from '../db/objects';
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
    INVALID_TRAINING : 'Your training data needs examples for at least two labels, and every label needs a different name.',
};

// longest text that can be classified
const MAX_TEXT_LENGTH = 2048;

// a text service training that started longer ago than this is
//  abandoned (e.g. the API instance running it crashed), so
//  it is reported as failed and the model can be trained again
export const ABANDON_TRAINING_AFTER_MS = 10 * 60 * 1000;

// how long a text service training keeps retrying for, from when
//  it was accepted - if the service hasn't managed it by then,
//  letting the student try again sooner would only add to the load
// it must be shorter than ABANDON_TRAINING_AFTER_MS by at least
//  textservice's training timeout, so that the last attempt finishes
//  before the training would be treated as abandoned
const TRAINING_RETRY_BUDGET_MS = 6 * 60 * 1000;

// how long to wait before each retry of a text service training,
//  unless the service says how long to wait (the last wait is
//  used for every retry after that)
const TRAINING_RETRY_BACKOFF_MS = [ 5000, 10000, 20000, 40000, 60000 ];




// -----------------------------------------------------------------------------
//
// Training
//
// -----------------------------------------------------------------------------


/**
 * @param client - where the request came from, for usage events
 */
export async function trainClassifier(
    project: DbObjects.Project,
    client?: DbObjects.TextServiceUsageClient,
): Promise<TrainingObjects.TextClassifier>
{
    const training = await getTraining(project);

    return trainClassifierForProject(project, training, client);
}


/**
 * @param client - where the request came from, for usage events
 */
export async function trainClassifierForProject(
    project: DbObjects.Project | DbObjects.LocalProject,
    training: TrainingObjects.ConversationTrainingData,
    client?: DbObjects.TextServiceUsageClient,
): Promise<TrainingObjects.TextClassifier>
{
    const request: TrainRequest = { received : Date.now(), client };

    const tenantPolicy = await store.getClassTenant(project.classid);

    const existingWorkspaces = await store.getTextClassifiers(project.id);
    if (existingWorkspaces.length > 0) {
        return retrainModel(project, tenantPolicy, existingWorkspaces[0], training, request);
    }
    else {
        return createNewModel(project, tenantPolicy, training, request);
    }
}


/**
 * A request to train a model, for usage events.
 */
interface TrainRequest {
    // when the request was received (ms since the epoch)
    readonly received: number;
    readonly client?: DbObjects.TextServiceUsageClient;
}


// the default size of training (in weighted characters, see
//  countWeightedCharacters) that is too large for the text service,
//  so is trained using Watson Assistant instead
// it can be changed using the TEXT_SERVICE_LARGE_THRESHOLD env var
//  e.g. lowered if the text service struggles with mid-sized training,
//  or set to 0 to send every new model to Watson Assistant
export const LARGE_TRAINING_THRESHOLD = 100000;

// how much each character counts towards the size of training, for
//  languages that the text service takes longer to train (languages
//  that aren't listed have a weight of 1)
const LANGUAGE_WEIGHTS: { readonly [language in DbObjects.TextProjectLanguage]?: number } = {
    'ko' : 3,
    'ja' : 3,
    'zh-cn' : 3,
    'zh-tw' : 3,
    'ar' : 1.5,
};


/**
 * The size of training. Its weighted chars (the number of characters
 *  in the examples, weighted by the language) decide if it is large.
 *
 * Characters are counted as Unicode code points, as the text
 *  service counts them.
 */
function getTrainingSize(training: TrainingObjects.ConversationTrainingData): DbObjects.TextServiceTrainingSize
{
    let examples = 0;
    let chars = 0;
    for (const intent of training.intents) {
        examples += intent.examples.length;
        for (const example of intent.examples) {
            chars += countCharacters(example.text);
        }
    }
    const weight = LANGUAGE_WEIGHTS[training.language as DbObjects.TextProjectLanguage] ?? 1;
    return { labels : training.intents.length, examples, chars, weightedchars : chars * weight };
}

function countCharacters(text: string): number
{
    return [ ...text ].length;
}

function getLargeTrainingThreshold(): number
{
    const configured = process.env[env.TEXT_SERVICE_LARGE_THRESHOLD];
    if (configured === undefined) {
        return LARGE_TRAINING_THRESHOLD;
    }
    if (/^\d+$/.test(configured.trim())) {
        return parseInt(configured, 10);
    }
    log.warn({ configured }, 'Invalid ' + env.TEXT_SERVICE_LARGE_THRESHOLD + ', using the default');
    return LARGE_TRAINING_THRESHOLD;
}

function isLargeTraining(usage: TrainingUsage): boolean
{
    return usage.size.weightedchars >= getLargeTrainingThreshold();
}


// error thrown by the store if a class has no Watson Assistant credentials
const NO_CREDENTIALS_ERROR = 'Unexpected response when retrieving service credentials';


// where Watson Assistant credentials come from for a class's
//  own models (only large trainings use the large pool)
type ClassCredentialSource = Exclude<TrainingObjects.CredentialSource, 'large-pool'>;

/**
 * Where a new model is trained: the text service, or Watson
 *  Assistant using credentials from the given source.
 */
type NewModelService = {
    readonly servicetype: 'txt';
    readonly usage: TrainingUsage;
} | {
    readonly servicetype: 'conv';
    readonly source: ClassCredentialSource;
} | {
    // a class without keys, with a large training
    readonly servicetype: 'conv';
    readonly source: 'large-pool';
    readonly usage: TrainingUsage;
};


/**
 * Where the class's Watson Assistant credentials come from, or 'none'
 *  for a class that has to provide its own, but hasn't.
 */
async function getClassCredentialSource(tenantPolicy: DbObjects.ClassTenant): Promise<ClassCredentialSource | 'none'>
{
    if (tenantPolicy.id === sessionusers.CLASS_NAME) {
        return 'class';
    }

    switch (tenantPolicy.tenantType) {
    case DbObjects.ClassTenantType.ManagedPool:
        return 'managed-pool';
    case DbObjects.ClassTenantType.Managed:
        return 'class';
    case DbObjects.ClassTenantType.UnManaged:
        return await hasWatsonAssistantCredentials(tenantPolicy) ? 'class' : 'none';
    }
}


async function chooseServiceForNewModel(
    project: DbObjects.Project | DbObjects.LocalProject,
    tenantPolicy: DbObjects.ClassTenant,
    training: TrainingObjects.ConversationTrainingData,
    request: TrainRequest,
): Promise<NewModelService>
{
    const source = await getClassCredentialSource(tenantPolicy);
    if (source !== 'none') {
        return { servicetype : 'conv', source };
    }

    if (!env.isTextServiceConfigured()) {
        // the class has no way to train a text model
        throw new Error(NO_CREDENTIALS_ERROR);
    }

    // only worked out for classes without keys, as the
    //  size decides which service they use
    const usage = getTrainingUsage(project, tenantPolicy, training, request.client);

    // a class without keys shares the text service and the large pool,
    //  so every model it has counts towards the limit, whichever
    //  service it is from
    const numModels = await store.countTextModelsByUser(project.userid);
    if (numModels >= tenantPolicy.maxProjectsPerUser) {
        recordTrainAccept('limit', usage, request);
        throw new Error(ERROR_MESSAGES.TOO_MANY_MODELS);
    }

    if (isLargeTraining(usage)) {
        return { servicetype : 'conv', source : 'large-pool', usage };
    }
    return { servicetype : 'txt', usage };
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
    request: TrainRequest,
): Promise<TrainingObjects.TextClassifier>
{
    const service = await chooseServiceForNewModel(project, tenantPolicy, training, request);
    switch (service.servicetype) {
    case 'conv':
        if (service.source === 'large-pool') {
            return createNewLargeModel(project, tenantPolicy, training, service.usage, request);
        }
        return createNewWatsonAssistantModel(project, tenantPolicy, service.source, training);
    case 'txt':
        return createNewTextServiceModel(project, tenantPolicy, training, service.usage, request);
    }
}


/**
 * Creates a Watson Assistant model using the large pool, for a large
 *  training from a class that would otherwise use the text service.
 */
async function createNewLargeModel(
    project: DbObjects.Project | DbObjects.LocalProject,
    tenantPolicy: DbObjects.ClassTenant,
    training: TrainingObjects.ConversationTrainingData,
    usage: TrainingUsage,
    request: TrainRequest,
): Promise<TrainingObjects.TextClassifier>
{
    let modelid: string | undefined;
    try {
        const created = await trainUsingLargePool(usage,
            () => conversation.createModel(project, tenantPolicy, 'large-pool', training));
        const model = await storeNewWatsonAssistantModel(project, created);
        modelid = model.id;
        return model;
    }
    finally {
        recordTrainAccept('large', usage, request, modelid);
    }
}


async function createNewWatsonAssistantModel(
    project: DbObjects.Project | DbObjects.LocalProject,
    tenantPolicy: DbObjects.ClassTenant,
    source: TrainingObjects.CredentialSource,
    training: TrainingObjects.ConversationTrainingData,
): Promise<TrainingObjects.TextClassifier>
{
    const created = await conversation.createModel(project, tenantPolicy, source, training);
    return storeNewWatsonAssistantModel(project, created);
}


async function storeNewWatsonAssistantModel(
    project: DbObjects.Project | DbObjects.LocalProject,
    { workspace, credentials }: conversation.WorkspaceWithCredentials,
): Promise<TrainingObjects.TextClassifier>
{
    try {
        await store.storeTextClassifier(project, workspace);
        await store.storeOrUpdateScratchKey(project, credentials, workspace.workspace_id, workspace.created);
    }
    catch (err) {
        log.error({ err, project, credentials : credentials.id }, 'Failed to store new text model');
        notifyWatsonStoreFailure(project, err);
        throw err;
    }

    return workspace;
}


async function createNewTextServiceModel(
    project: DbObjects.Project | DbObjects.LocalProject,
    tenantPolicy: DbObjects.ClassTenant,
    training: TrainingObjects.ConversationTrainingData,
    usage: TrainingUsage,
    request: TrainRequest,
): Promise<TrainingObjects.TextClassifier>
{
    const serviceTraining = getTextServiceTraining(training, usage, request);

    const now = new Date();
    const id = randomUUID();
    const model: TrainingObjects.TextClassifier = {
        id,
        // placeholder until the model is trained
        workspace_id : id,
        credentialsid : '',
        servicetype : 'txt',
        url : '',
        name : training.name,
        language : training.language,
        created : now,
        updated : now,
        expiry : getTextServiceModelExpiry(tenantPolicy, now),
        status : 'Training',
    };

    let outcome: 'created' | 'already-training';
    try {
        outcome = await store.createTextServiceTraining(project, model, now);
    }
    catch (err) {
        log.error({ err, project : project.id, model : model.id }, 'Failed to store new text model');
        notifyTextServiceStoreFailure(err);
        throw err;
    }

    if (outcome === 'already-training') {
        // a duplicate request, which arrived at the same time as the
        //  one that created the model
        const inProgress = await getTrainingInProgress(project);
        recordTrainAccept('duplicate', usage, request, inProgress.id);
        return inProgress;
    }

    await startTraining(project, model.id, now, serviceTraining, usage);
    recordTrainAccept('accepted', usage, request, model.id);
    return model;
}


/**
 * Returns the training to send to the text service, checked against
 *  what the service accepts, so that training it would reject is
 *  turned away while the student is waiting, rather than failing in
 *  the background with no explanation.
 *
 * Labels without any examples are left out (the service needs at least
 *  one example for every label). The training needs at least two labels
 *  left, with different names (label names are changed to be valid
 *  Watson Assistant intent names, so different labels can end up with
 *  the same name).
 *
 * Training from the site has already been checked by the UI, but
 *  training from a Scratch key hasn't.
 */
function getTextServiceTraining(
    training: TrainingObjects.ConversationTrainingData,
    usage: TrainingUsage,
    request: TrainRequest,
): TrainingObjects.ConversationTrainingData
{
    const intents = training.intents.filter((intent) => intent.examples.length > 0);
    const names = new Set(intents.map((intent) => intent.intent));
    if (intents.length < 2 || names.size !== intents.length) {
        recordTrainAccept('invalid', usage, request);
        throw new Error(ERROR_MESSAGES.INVALID_TRAINING);
    }
    return { ...training, intents };
}


/**
 * Returns a project's text service model, for a request that found
 *  that the model is already training.
 */
async function getTrainingInProgress(project: DbObjects.Project | DbObjects.LocalProject): Promise<TrainingObjects.TextClassifier>
{
    const models = await store.getTextClassifiers(project.id);
    const model = models.find((existing) => existing.servicetype === 'txt');
    if (!model) {
        // the model was deleted straight after the other request
        //  created it
        throw new Error(ERROR_MESSAGES.MODEL_NOT_FOUND);
    }
    return getTextServiceModelStatus(model);
}


/**
 * Starts a training that has been accepted, once the Scratch key
 *  points at the model's placeholder id.
 *
 * The training runs in the background, after the response has
 *  been returned.
 */
async function startTraining(
    project: DbObjects.Project | DbObjects.LocalProject,
    id: string, started: Date,
    training: TrainingObjects.ConversationTrainingData,
    usage: TrainingUsage,
): Promise<void>
{
    await storeScratchKeyPlaceholder(project, id, started);

    const job: TextServiceTrainingJob = {
        projectid : project.id, tenantPolicy : usage.tenantPolicy,
        id, started, training,
        usage,
        attempts : 0, ended : false,
    };
    const running: Promise<void> = runTraining(job)
        .catch((err) => {
            // not expected, as runTraining handles its own errors
            log.error({ err, model : id }, 'Unexpected failure in text model training');
        })
        .finally(() => {
            runningTrainings.delete(running);
        });
    runningTrainings.set(running, job);
}


/**
 * Points the Scratch key at the model's placeholder id, while
 *  the model is training.
 */
async function storeScratchKeyPlaceholder(
    project: DbObjects.Project | DbObjects.LocalProject,
    id: string, started: Date,
): Promise<void>
{
    try {
        await store.storeOrUpdateScratchKey(project, getTextServiceScratchKeyCredentials(project), id, started);
    }
    catch (err) {
        log.error({ err, project : project.id, model : id }, 'Failed to store Scratch key for text model');
        notifyTextServiceStoreFailure(err);
        // nothing will train the model, so record that the training
        //  failed, so that the student can try again
        await recordTrainingFailure(id, started);
        throw err;
    }
}


function notifyWatsonStoreFailure(project: DbObjects.Project | DbObjects.LocalProject, err: Error): void
{
    notifications.notify('Unexpected failure to train text classifier' +
                         ' for project : ' + project.id +
                         ' in class : ' + project.classid + ' : ' +
                         err.message, notifications.SLACK_CHANNELS.TRAINING_ERRORS);
}


function notifyTextServiceStoreFailure(err: Error): void
{
    notifications.notify('Unexpected failure to store a text model trained by mlforkids-text : ' +
                         err.message, notifications.SLACK_CHANNELS.TEXT_SERVICE);
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
    request: TrainRequest,
): Promise<TrainingObjects.TextClassifier>
{
    switch (existing.servicetype) {
    case 'conv':
        return retrainWatsonAssistantModel(project, tenantPolicy, existing, training, request);
    case 'txt':
        return retrainTextServiceModel(project, tenantPolicy, existing, training, request);
    }
}


async function retrainTextServiceModel(
    project: DbObjects.Project | DbObjects.LocalProject,
    tenantPolicy: DbObjects.ClassTenant,
    existing: TrainingObjects.TextClassifier,
    training: TrainingObjects.ConversationTrainingData,
    request: TrainRequest,
): Promise<TrainingObjects.TextClassifier>
{
    // the size decides if the model moves to Watson Assistant
    const usage = getTrainingUsage(project, tenantPolicy, training, request.client);
    // only checked if it stays on the text service, as Watson
    //  Assistant accepts training that the text service doesn't
    const serviceTraining = isLargeTraining(usage) ? training : getTextServiceTraining(training, usage, request);

    const now = new Date();
    const abandonIfStartedBefore = getAbandonIfStartedBefore(now);

    // only used to find out if an abandoned training is being replaced
    const previous = await store.getTextServiceTrainingState(existing.id);

    const started = await store.claimTextServiceTraining(existing.id, now, abandonIfStartedBefore);
    if (!started) {
        // a duplicate request, while the model is training
        const current = await store.getTextServiceTrainingState(existing.id);
        if (!current) {
            // the model was deleted after this request found it
            throw new Error(ERROR_MESSAGES.MODEL_NOT_FOUND);
        }
        recordTrainAccept('duplicate', usage, request, existing.id);
        return setTextServiceModelStatus(existing, current, abandonIfStartedBefore);
    }

    if (previous && previous.trainingstarted && isAbandonedTextServiceTraining(previous, abandonIfStartedBefore)) {
        reportAbandonedTraining(existing.id, previous.trainingstarted, usage);
    }

    try {
        // the old model's head has gone, so stop classifying with it
        await store.setTextServiceModelPlaceholder(existing.id);
    }
    catch (err) {
        log.error({ err, project : project.id, model : existing.id }, 'Failed to store placeholder for text model');
        notifyTextServiceStoreFailure(err);
        await recordTrainingFailure(existing.id, started);
        throw err;
    }

    if (isLargeTraining(usage)) {
        return moveToWatsonAssistant(project, tenantPolicy, existing, started, training, usage, request);
    }

    await startTraining(project, existing.id, started, serviceTraining, usage);
    recordTrainAccept('accepted', usage, request, existing.id);

    return {
        ...existing,
        workspace_id : existing.id,
        updated : started,
        status : 'Training',
    };
}


/**
 * Replaces a text service model with a Watson Assistant model, for
 *  training that has become too large for the text service. The
 *  project then stays on Watson Assistant.
 *
 * The text service model has been claimed for this training, so it
 *  is kept (with its placeholder id) while the Watson Assistant model
 *  is created, so that duplicate requests are told it is training.
 *  It is deleted even if the Watson Assistant model can't be created,
 *  so that a failed move leaves no model, as a failed retrain does.
 */
async function moveToWatsonAssistant(
    project: DbObjects.Project | DbObjects.LocalProject,
    tenantPolicy: DbObjects.ClassTenant,
    existing: TrainingObjects.TextClassifier,
    started: Date,
    training: TrainingObjects.ConversationTrainingData,
    usage: TrainingUsage,
    request: TrainRequest,
): Promise<TrainingObjects.TextClassifier>
{
    log.info({ project : project.id, model : existing.id }, 'Moving text model to Watson Assistant');

    let modelid: string | undefined;
    try {
        const model = await moveModel(project, tenantPolicy, existing, started, training, usage);
        modelid = model.id;
        return model;
    }
    finally {
        recordTrainAccept('move', usage, request, modelid);
    }
}

async function moveModel(
    project: DbObjects.Project | DbObjects.LocalProject,
    tenantPolicy: DbObjects.ClassTenant,
    existing: TrainingObjects.TextClassifier,
    started: Date,
    training: TrainingObjects.ConversationTrainingData,
    usage: TrainingUsage,
): Promise<TrainingObjects.TextClassifier>
{
    await storeScratchKeyPlaceholder(project, existing.id, started);

    const classSource = await getClassCredentialSource(tenantPolicy);
    const source = classSource === 'none' ? 'large-pool' : classSource;

    let created: conversation.WorkspaceWithCredentials | undefined;
    let createError: Error | undefined;
    try {
        const create = () => conversation.createModel(project, tenantPolicy, source, training);
        created = source === 'large-pool' ? await trainUsingLargePool(usage, create) : await create();
    }
    catch (err) {
        createError = err;
    }

    try {
        await deleteModelRecords({ ...existing, workspace_id : existing.id });
    }
    catch (err) {
        log.error({ err, project : project.id, model : existing.id }, 'Failed to delete text model moving to Watson Assistant');
        notifyTextServiceStoreFailure(err);
        // the student can try again straight away, instead of
        //  waiting for the training to be abandoned
        await recordTrainingFailure(existing.id, started);
        throw createError ?? err;
    }

    if (!created) {
        throw createError;
    }
    return storeNewWatsonAssistantModel(project, created);
}


async function retrainWatsonAssistantModel(
    project: DbObjects.Project | DbObjects.LocalProject,
    tenantPolicy: DbObjects.ClassTenant,
    existing: TrainingObjects.TextClassifier,
    training: TrainingObjects.ConversationTrainingData,
    request: TrainRequest,
): Promise<TrainingObjects.TextClassifier>
{
    try {
        const credentials = await conversation.getModelCredentials(existing);
        const update = () => conversation.updateModel(project, tenantPolicy, credentials, existing, training);
        const { workspace } = credentials.source === 'large-pool' ?
            await trainUsingLargePool(getTrainingUsage(project, tenantPolicy, training, request.client), update) :
            await update();

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
export async function trainWithScratchKey(
    project: DbObjects.Project,
    client?: DbObjects.TextServiceUsageClient,
): Promise<ScratchTypes.Status>
{
    const model = await trainClassifier(project, client);
    return getScratchStatus(model.status);
}


/**
 * Training for a Scratch key for a local project, using the provided
 *  training data - returns the response for the Scratch extension.
 */
export async function trainLocalWithScratchKey(
    project: DbObjects.LocalProject,
    training: TrainingObjects.ConversationTrainingData,
    client?: DbObjects.TextServiceUsageClient,
): Promise<ScratchTypes.Status>
{
    const model = await trainClassifierForProject(project, training, client);
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
// Training in the background
//
// -----------------------------------------------------------------------------


/**
 * A text service training that has been accepted, and is running
 *  in the background on this instance.
 */
interface TextServiceTrainingJob {
    readonly projectid: string;
    readonly tenantPolicy: DbObjects.ClassTenant;
    // the model's id, which is also its placeholder model id
    readonly id: string;
    // identifies this training when storing the result, in case
    //  the model has been deleted or a newer training started
    readonly started: Date;
    readonly training: TrainingObjects.ConversationTrainingData;

    // for usage events
    readonly usage: TrainingUsage;
    // calls to the text service so far
    attempts: number;
    // set once the end of the training has been recorded, as a
    //  training failed at the shutdown cut-off keeps running
    ended: boolean;
}


// the trainings running on this instance, with their jobs, so
//  that a training can be recorded as failed at shutdown
const runningTrainings = new Map<Promise<void>, TextServiceTrainingJob>();

// set when this instance starts shutting down (see startShutdown),
//  after which trainings aren't retried
let shuttingDown = false;
// trainings recorded as failed because this instance is shutting down
let numFailedByShutdown = 0;


/**
 * Waits for every training running on this instance to end.
 */
export async function waitForTrainings(): Promise<void>
{
    await Promise.all([ ...runningTrainings.keys() ]);
}


/**
 * Stops trainings on this instance from being retried, as soon as the
 *  instance starts shutting down - before the HTTP server has finished
 *  closing, as that can take a while, and a retry started then might
 *  not finish before the instance stops.
 */
export function startShutdown(): void
{
    shuttingDown = true;
}


/**
 * Lets the trainings running on this instance finish, before the
 *  instance shuts down. Trainings still running at the cut-off are
 *  recorded as failed, so that students can try again straight
 *  away, instead of waiting for them to be abandoned.
 */
export async function stopTrainings(cutoff: Date): Promise<void>
{
    startShutdown();

    let cutoffTimer: NodeJS.Timeout | undefined;
    const reachedCutoff = new Promise<boolean>((resolve) => {
        cutoffTimer = setTimeout(() => resolve(true), Math.max(cutoff.getTime() - Date.now(), 0));
    });
    const finished = waitForTrainings().then(() => false);

    const cutoffWasReached = await Promise.race([ finished, reachedCutoff ]);
    clearTimeout(cutoffTimer);

    if (cutoffWasReached) {
        const unfinished = [ ...runningTrainings.values() ];
        log.error({ models : unfinished.map((training) => training.id) }, 'Text model trainings unfinished at shutdown');

        await Promise.all(unfinished.map(async (job) => {
            if (await recordFailureAtShutdown(job)) {
                recordTrainEnd(job, 'shutdown');
            }
            // otherwise it ended just now and recorded that itself, or
            //  the write failed and it will be found abandoned
        }));
    }

    if (numFailedByShutdown > 0) {
        notifyFailedByShutdown(numFailedByShutdown);
    }
}

export function resumeTrainingsForTests(): void
{
    shuttingDown = false;
    numFailedByShutdown = 0;
}

/**
 * Records that a training failed because this instance is shutting
 *  down, counting it for the shutdown alert.
 *
 * @returns true if the failure was recorded
 */
async function recordFailureAtShutdown(job: TextServiceTrainingJob): Promise<boolean>
{
    const recorded = await recordTrainingFailure(job.id, job.started);
    if (recorded) {
        numFailedByShutdown += 1;
    }
    return recorded;
}

function notifyFailedByShutdown(numFailed: number): void
{
    notifications.notify('An API instance shut down before ' + numFailed +
                         ' text model training(s) finished, so they were recorded as failed',
                         notifications.SLACK_CHANNELS.TEXT_SERVICE);
}


/**
 * Trains a model using the text service, retrying failures that
 *  could succeed if the training is sent again, and then stores
 *  the result.
 */
async function runTraining(job: TextServiceTrainingJob): Promise<void>
{
    const deadline = job.started.getTime() + TRAINING_RETRY_BUDGET_MS;

    for (let retries = 0; ; retries++) {
        job.attempts = retries + 1;
        const attemptStarted = Date.now();

        let trained: textservice.TrainedModel;
        try {
            trained = await textservice.train(job.training);
        }
        catch (err) {
            const isServiceError = err instanceof textservice.TextServiceTrainingError;
            recordTrainAttempt(job, isServiceError ? err.outcome : 'other', attemptStarted,
                               isServiceError ? err.retryAfterMs : undefined);

            const wait = getRetryWaitMs(err, retries);
            if (wait === undefined || Date.now() + wait > deadline) {
                await recordFailedTraining(job);
                return;
            }

            await pause(wait);

            if (shuttingDown) {
                // this instance is shutting down, so a retry might
                //  not finish before it stops
                log.info({ model : job.id }, 'Text model training not retried during shutdown');
                recordTrainEnd(job, await recordFailureAtShutdown(job) ? 'shutdown' : 'discarded');
                return;
            }

            if (!await store.getTextServiceTrainingState(job.id)) {
                // the model was deleted (cancelled by the student,
                //  or expired), so it no longer needs training
                log.info({ model : job.id }, 'Text model deleted during training');
                recordTrainEnd(job, 'discarded');
                return;
            }
            continue;
        }

        recordTrainAttempt(job, 'ok', attemptStarted);
        await storeTrainedModel(job, trained);
        return;
    }
}


/**
 * Records that a training failed, if it is still the model's current training.
 */
async function recordFailedTraining(job: TextServiceTrainingJob): Promise<void>
{
    recordTrainEnd(job, await recordTrainingFailure(job.id, job.started) ? 'failed' : 'discarded');
}


/**
 * How long to wait before retrying a failed training.
 *
 * @returns undefined if the training shouldn't be retried
 */
function getRetryWaitMs(err: any, retries: number): number | undefined
{
    if (!(err instanceof textservice.TextServiceTrainingError) || !err.retryable) {
        return undefined;
    }
    if (err.retryAfterMs !== undefined) {
        return err.retryAfterMs;
    }
    return TRAINING_RETRY_BACKOFF_MS[Math.min(retries, TRAINING_RETRY_BACKOFF_MS.length - 1)];
}


function pause(ms: number): Promise<void>
{
    return new Promise((resolve) => setTimeout(resolve, ms));
}


async function storeTrainedModel(job: TextServiceTrainingJob, trained: textservice.TrainedModel): Promise<void>
{
    const finished = new Date();
    let stored: boolean;
    try {
        stored = await store.finishTextServiceTraining(job.id, job.started, {
            modelid : trained.modelid,
            head : trained.head,
            finished,
            expiry : getTextServiceModelExpiry(job.tenantPolicy, finished),
        });
    }
    catch (err) {
        log.error({ err, project : job.projectid, model : job.id }, 'Failed to store trained text model');
        notifyTextServiceStoreFailure(err);
        await recordFailedTraining(job);
        return;
    }

    if (!stored) {
        // the model was deleted, or a newer training started
        //  after this one was abandoned
        log.info({ model : job.id }, 'Discarding text model training');
        recordTrainEnd(job, 'discarded');
        return;
    }

    recordTrainEnd(job, 'available');

    try {
        await store.replaceScratchKeyPlaceholder(job.projectid, job.id, trained.modelid, finished);
    }
    catch (err) {
        // the model is trained, so the training hasn't failed - the
        //  key is fixed the next time it is created or the model is
        //  trained, until then Scratch reports the model as missing
        log.error({ err, project : job.projectid, model : job.id }, 'Failed to update Scratch key for trained text model');
        notifyTextServiceStoreFailure(err);
    }
}


/**
 * Records that a training failed, if it is still the model's
 *  current training.
 *
 * @returns true if the failure was recorded
 */
async function recordTrainingFailure(id: string, started: Date): Promise<boolean>
{
    try {
        const recorded = await store.failTextServiceTraining(id, started, new Date());
        if (!recorded) {
            log.info({ model : id }, 'Discarding failed text model training');
        }
        return recorded;
    }
    catch (err) {
        // the training will be abandoned once it is
        //  older than the limit
        log.error({ err, model : id }, 'Failed to record failed text model training');
        return false;
    }
}


function getAbandonIfStartedBefore(now: Date): Date
{
    return new Date(now.getTime() - ABANDON_TRAINING_AFTER_MS);
}

/**
 * Reports a training that has been found to be abandoned.
 *
 * Only the request that found it first should report it, so that
 *  each abandoned training is only reported once.
 *
 * @param usage - the training replacing it, if known - only its project,
 *  class and language are recorded, as those are the same for the
 *  abandoned training, but its size and client aren't
 */
function reportAbandonedTraining(id: string, started: Date, usage?: TrainingUsage): void
{
    notifyAbandonedTraining(id);
    textserviceusage.record({
        recorded : new Date(),
        event : 'train-end',
        outcome : 'abandoned',
        projectid : usage?.projectid,
        modelid : id,
        tenanttype : usage?.tenantPolicy.tenantType,
        language : usage?.language,
        totalms : Date.now() - started.getTime(),
    });
}

function notifyAbandonedTraining(id: string): void
{
    // the model id is only logged, so that repeated alerts are
    //  the same, and are collapsed by the notifications module
    log.error({ model : id }, 'Text model training abandoned');
    notifications.notify('A text model training was abandoned (it did not finish within ' +
                         (ABANDON_TRAINING_AFTER_MS / 60000) + ' minutes)',
                         notifications.SLACK_CHANNELS.TEXT_SERVICE);
}



// -----------------------------------------------------------------------------
//
// Usage events
//
// -----------------------------------------------------------------------------


/**
 * What is recorded about a training in usage events. Only sizes
 *  are recorded, never the text or label names.
 */
interface TrainingUsage {
    readonly projectid: string;
    readonly tenantPolicy: DbObjects.ClassTenant;
    readonly language: string;
    readonly size: DbObjects.TextServiceTrainingSize;
    readonly client?: DbObjects.TextServiceUsageClient;
}

function getTrainingUsage(
    project: DbObjects.Project | DbObjects.LocalProject,
    tenantPolicy: DbObjects.ClassTenant,
    training: TrainingObjects.ConversationTrainingData,
    client?: DbObjects.TextServiceUsageClient,
): TrainingUsage
{
    return {
        projectid : project.id,
        tenantPolicy,
        language : training.language,
        size : getTrainingSize(training),
        client,
    };
}

function getTrainingEvent(
    event: DbObjects.TextServiceUsageEventType, outcome: string,
    usage: TrainingUsage,
): DbObjects.TextServiceUsageEvent
{
    return {
        recorded : new Date(),
        event,
        outcome,
        projectid : usage.projectid,
        tenanttype : usage.tenantPolicy.tenantType,
        language : usage.language,
        size : usage.size,
        client : usage.client,
    };
}


function recordTrainAccept(
    outcome: DbObjects.TextServiceTrainAcceptOutcome,
    usage: TrainingUsage, request: TrainRequest,
    modelid?: string,
): void
{
    textserviceusage.record({
        ...getTrainingEvent('train-accept', outcome, usage),
        modelid,
        durationms : Date.now() - request.received,
    });
}

function recordTrainAttempt(
    job: TextServiceTrainingJob,
    outcome: DbObjects.TextServiceTrainAttemptOutcome,
    attemptStarted: number,
    retryafterms?: number,
): void
{
    textserviceusage.record({
        ...getTrainingEvent('train-attempt', outcome, job.usage),
        modelid : job.id,
        durationms : Date.now() - attemptStarted,
        attempt : job.attempts,
        retryafterms,
    });
}

/**
 * Records how a training ended, unless that has already been recorded.
 */
function recordTrainEnd(job: TextServiceTrainingJob, outcome: DbObjects.TextServiceTrainEndOutcome): void
{
    if (job.ended) {
        return;
    }
    job.ended = true;

    textserviceusage.record({
        ...getTrainingEvent('train-end', outcome, job.usage),
        modelid : job.id,
        totalms : Date.now() - job.started.getTime(),
        attempt : job.attempts,
    });
}


/**
 * Trains a Watson Assistant model using the large pool, recording how it ends.
 */
async function trainUsingLargePool(
    usage: TrainingUsage,
    train: () => Promise<conversation.WorkspaceWithCredentials>,
): Promise<conversation.WorkspaceWithCredentials>
{
    const started = Date.now();
    const recordLargePool = (outcome: DbObjects.TextServiceLargePoolOutcome, modelid?: string) => {
        textserviceusage.record({
            ...getTrainingEvent('large-pool', outcome, usage),
            modelid,
            durationms : Date.now() - started,
        });
    };

    try {
        const trained = await train();
        recordLargePool('ok', trained.workspace.id);
        return trained;
    }
    catch (err) {
        recordLargePool(err.message === conversation.ERROR_MESSAGES.POOL_EXHAUSTED ? 'exhausted' : 'other');
        throw err;
    }
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
        await conversation.deleteModel(classifier);
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
                    const creds = await conversation.getModelCredentials(workspace);
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
    const state = await store.getTextServiceTrainingState(model.id);
    const abandonIfStartedBefore = getAbandonIfStartedBefore(new Date());
    if (state && state.trainingstarted && isAbandonedTextServiceTraining(state, abandonIfStartedBefore)) {
        // recording the failure means the training is only reported
        //  as abandoned once, however often its status is checked
        if (await recordTrainingFailure(model.id, state.trainingstarted)) {
            reportAbandonedTraining(model.id, state.trainingstarted);
        }
    }
    return setTextServiceModelStatus(model, state, abandonIfStartedBefore);
}


function setTextServiceModelStatus(
    model: TrainingObjects.TextClassifier,
    state: DbObjects.TextClassifierTrainingState | undefined,
    abandonIfStartedBefore: Date,
): TrainingObjects.TextClassifier
{
    model.status = getTextServiceTrainingStatus(state, abandonIfStartedBefore);
    if (state) {
        model.updated = model.status === 'Training' && state.trainingstarted ?
            state.trainingstarted :
            state.updated;
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
        case 'conv':
            credentials = await conversation.getModelCredentials(classifier);
            break;
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
    client?: DbObjects.TextServiceUsageClient,
): Promise<TrainingObjects.Classification[]>
{
    const workspace = await getModelRecord(projectid, modelid);

    switch (workspace.servicetype) {
    case 'conv': {
        const credentials = await conversation.getModelCredentials(workspace);
        return classify(projectid, classifierTimestamp, text,
            () => conversation.classify(credentials, modelid, classifierTimestamp, text));
    }
    case 'txt':
        return classify(projectid, classifierTimestamp, text,
            () => classifyWithTextServiceModel(projectid, workspace, classifierTimestamp, text, client));
    }
}


export async function classifyWithScratchKey(
    scratchKey: DbObjects.ScratchKey, text: string,
    client?: DbObjects.TextServiceUsageClient,
): Promise<TrainingObjects.Classification[]>
{
    const model = getScratchKeyModel(scratchKey);
    switch (model.servicetype) {
    case 'conv':
        return classify(scratchKey.projectid, scratchKey.updated, text,
            () => conversation.classify(model.credentials, model.classifierid, scratchKey.updated, text));
    case 'txt': {
        const workspace = await getModelRecord(scratchKey.projectid, model.classifierid);
        return classify(scratchKey.projectid, scratchKey.updated, text,
            () => classifyWithTextServiceModel(scratchKey.projectid, workspace, scratchKey.updated, text, client));
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


async function classifyWithTextServiceModel(
    projectid: string,
    workspace: TrainingObjects.TextClassifier,
    classifierTimestamp: Date,
    text: string,
    client?: DbObjects.TextServiceUsageClient,
): Promise<TrainingObjects.Classification[]>
{
    const started = Date.now();
    const recordClassify = (outcome: DbObjects.TextServiceClassifyOutcome, durationms?: number) => {
        textserviceusage.record({
            recorded : new Date(),
            event : 'classify',
            outcome,
            projectid,
            modelid : workspace.id,
            language : workspace.language,
            size : { chars : countCharacters(text) },
            durationms,
            client,
        });
    };

    if (workspace.workspace_id === workspace.id) {
        // a placeholder id, as the model is training (or the
        //  training failed), so there is no model to use - this
        //  gives a random answer, as Watson Assistant does while
        //  a model is training
        recordClassify('placeholder');
        return [];
    }

    // the head is only read if the text service doesn't
    //  already have the model cached
    const getHead = async (): Promise<Buffer> => {
        const stored = await store.getTextClassifierHead(workspace.id);
        if (!stored) {
            throw new Error(ERROR_MESSAGES.MODEL_NOT_FOUND);
        }
        return stored.head;
    };

    try {
        const result = await textservice.classify(workspace.workspace_id, classifierTimestamp, text, getHead);
        recordClassify(result.outcome, Date.now() - started);
        return result.classes;
    }
    catch (err) {
        recordClassify(err instanceof textservice.TextServiceClassifyError ? err.outcome : 'other', Date.now() - started);
        throw err;
    }
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
