// external dependencies
import * as httpStatus from 'http-status';
import { v1 as uuid } from 'uuid';
import * as _ from 'lodash';
// local dependencies
import * as store from '../db/store';
import * as iam from '../iam';
import * as DbObjects from '../db/db-types';
import * as TrainingObjects from './training-types';
import * as notifications from '../notifications/slack';
import * as request from '../utils/request';
import loggerSetup from '../utils/logger';

const log = loggerSetup();



export const ERROR_MESSAGES = {
    UNKNOWN : 'Failed to train machine learning model',
    INSUFFICIENT_API_KEYS : 'Your class already has created their maximum allowed number of models. ' +
                            'Please let your teacher or group leader know that ' +
                            'their "Watson Assistant API keys have no more skills available"',
    POOL_EXHAUSTED : 'Your class is sharing Watson Assistant "API keys" with many other schools, and ' +
                            'unfortunately there are currently none available. ' +
                            'Please let your teacher or group leader know that you will have to train ' +
                            'your machine learning model later',
    API_KEY_RATE_LIMIT : 'Your class is making too many requests to create machine learning models ' +
                         'at too fast a rate. ' +
                         'Please stop now and let your teacher or group leader know that ' +
                         '"the Watson Assistant service is currently rate limiting their API key"',
    MODEL_NOT_FOUND : 'Your machine learning model could not be found on the training server.',
    TEXT_TOO_LONG : 'text cannot be longer than 2048 characters',
    SERVICE_ERROR : 'The Watson Assistant service that runs your machine learning model reported an unexpected error',
    SKILL_IN_USE : 'Machine Learning for Kids is not allowed to delete this Watson Assistant workspace because ' +
                   'it is being used. Please delete it from IBM Cloud.',
};


export async function trainClassifier(
    project: DbObjects.Project,
): Promise<TrainingObjects.ConversationWorkspace>
{
    let workspace: TrainingObjects.ConversationWorkspace;

    const training = await getTraining(project);

    // determine when the Conversation workspace should be deleted
    const tenantPolicy = await store.getClassTenant(project.classid);

    const existingWorkspaces = await store.getConversationWorkspaces(project.id);
    if (existingWorkspaces.length > 0) {
        workspace = existingWorkspaces[0];

        const credentials = await store.getBluemixCredentialsById(tenantPolicy.tenantType, workspace.credentialsid);

        workspace = await updateWorkspace(project, credentials, workspace, training, tenantPolicy);
    }
    else {
        let credentials;
        if (tenantPolicy.tenantType === DbObjects.ClassTenantType.ManagedPool) {
            credentials = await store.getBluemixCredentialsPoolBatch('conv');
        }
        else {
            credentials = await store.getBluemixCredentials(tenantPolicy, 'conv');
        }

        workspace = await createWorkspace(project, credentials, training, tenantPolicy);
    }

    return workspace;
}





async function createWorkspace(
    project: DbObjects.Project,
    credentialsPool: TrainingObjects.BluemixCredentials[],
    training: TrainingObjects.ConversationTrainingData,
    tenantPolicy: DbObjects.ClassTenant,
): Promise<TrainingObjects.ConversationWorkspace>
{
    let workspace;

    const id: string = uuid();

    let finalError:string;
    let shuffledCredentialsPool: TrainingObjects.BluemixCredentials[];

    if (tenantPolicy.tenantType === DbObjects.ClassTenantType.ManagedPool) {
        // Unless we see a different error, if this doesn't work, the reason
        //  will be that we don't have room for any new workspaces with the
        //  available credentials
        finalError = ERROR_MESSAGES.POOL_EXHAUSTED;

        // don't shuffle the pool for managed requests, as this helps to
        //  reduce the number of service instances used
        shuffledCredentialsPool = credentialsPool;
    }
    else {
        // Unless we see a different error, if this doesn't work, the reason
        //  will be that we don't have room for any new workspaces with the
        //  available credentials
        finalError = ERROR_MESSAGES.INSUFFICIENT_API_KEYS;

        // shuffle the pool of credentials so the usage will be distributed
        //  across the set, rather than always directing training requests to
        //  the first creds in the pool
        shuffledCredentialsPool = _.shuffle(credentialsPool);
    }


    for (const credentials of shuffledCredentialsPool) {
        try {
            const url = credentials.url + '/v1/workspaces';
            workspace = await submitTrainingToConversation(
                project,
                credentials, url, training,
                id,
                tenantPolicy);

            await store.storeConversationWorkspace(credentials, project, workspace);

            await store.storeOrUpdateScratchKey(project,
                credentials, workspace.workspace_id, workspace.created);

            return workspace;
        }
        catch (err) {
            if (err.error &&
                err.error.error &&
                err.error.error.startsWith('Maximum workspaces limit exceeded'))
            {
                // We couldn't create a workspace because we've used up the
                //  number of workspaces allowed with these creds.
                // So we'll swallow the error so we can try the next set of
                //  creds in the pool
                finalError = tenantPolicy.tenantType === DbObjects.ClassTenantType.ManagedPool ?
                    ERROR_MESSAGES.POOL_EXHAUSTED :
                    ERROR_MESSAGES.INSUFFICIENT_API_KEYS;
            }
            else if (err.statusCode === httpStatus.TOO_MANY_REQUESTS ||
                     (err.error &&
                      err.error.error &&
                      err.error.error.startsWith('Rate limit exceeded')))
            {
                // The class is probably using a Lite plan API key and between
                //  them are hammering the Train Model button too fast
                // So we'll swallow the error so we can try the next set of
                //  creds in the pool
                finalError = ERROR_MESSAGES.API_KEY_RATE_LIMIT;
            }
            else if (err.statusCode === httpStatus.UNAUTHORIZED || err.statusCode === httpStatus.FORBIDDEN)
            {
                // The API credentials were rejected.
                // The teacher/group leader needs to fix this.
                log.warn({ err, project, credentials }, 'Watson Assistant credentials rejected');
                throw err;
            }
            else {
                // Otherwise - rethrow it so we can bug out.
                log.error({ err, project, credentials : credentials.id }, 'Unhandled Conversation exception');

                // This shouldn't happen.
                // It probably needs more immediate attention, so notify the Slack bot
                notifications.notify('Unexpected failure to train text classifier' +
                                    ' for project : ' + project.id +
                                    ' in class : ' + project.classid + ' : ' +
                                    err.message, notifications.SLACK_CHANNELS.TRAINING_ERRORS);

                throw err;
            }
        }
    }


    //
    // If we're here, either:
    //  1) there were no credentials, so we never entered the for loop above, so we use
    //      the default finalError
    //  2) every attempt to train a model failed, but with an exception that was swallowed
    //      above, with finalError being set with the reason
    //

    // is it worth notifying the Slack bot of this failure?
    let notifySlackBot = false;
    switch (finalError) {
    case ERROR_MESSAGES.POOL_EXHAUSTED:
        // managedpool is full - that should never happen!
        notifySlackBot = true;
        break;
    case ERROR_MESSAGES.API_KEY_RATE_LIMIT:
        // teacher is probably exceeding Lite plan limits - user error
        if (tenantPolicy.tenantType === DbObjects.ClassTenantType.ManagedPool) {
            // shouldn't be possible with Plus plans used in the pool
            notifySlackBot = true;
        }
        break;
    case ERROR_MESSAGES.INSUFFICIENT_API_KEYS:
        // teacher hasn't provided API keys - user error
        break;
    default:
        // unexpected error type
        notifySlackBot = true;
    }

    if (notifySlackBot) {
        notifications.notify('Failed to train text classifier' +
                                ' for project : ' + project.id +
                                ' in class : ' + project.classid +
                                ' because:\n' + finalError,
                                notifications.SLACK_CHANNELS.TRAINING_ERRORS);
    }

    throw new Error(finalError);
}





async function updateWorkspace(
    project: DbObjects.Project,
    credentials: TrainingObjects.BluemixCredentials,
    workspace: TrainingObjects.ConversationWorkspace,
    training: TrainingObjects.ConversationTrainingData,
    tenantPolicy: DbObjects.ClassTenant,
): Promise<TrainingObjects.ConversationWorkspace>
{
    const url = credentials.url + '/v1/workspaces/' + workspace.workspace_id;

    try {
        const modified = await submitTrainingToConversation(
            project,
            credentials, url, training, workspace.id,
            tenantPolicy);

        await store.updateConversationWorkspaceExpiry(modified);

        const timestamp = modified.updated ? modified.updated : modified.created;
        await store.updateScratchKeyTimestamp(project, timestamp);

        return modified;
    }
    catch (err) {
        if (err.error &&
            err.error.error &&
            err.error.error.startsWith('Rate limit exceeded'))
        {
            // The class is probably using a Lite plan API key and between
            //  them are hammering the Train Model button too fast
            throw new Error(ERROR_MESSAGES.API_KEY_RATE_LIMIT);
        }
        else if (err.statusCode === httpStatus.NOT_FOUND) {
            // the Conversation workspace could not be found - it was likely
            //  deleted from outside of the tool

            // delete the DB reference
            store.deleteConversationWorkspace(workspace.id);

            // fail, so the user can try again and this time create a new workspace
            throw new Error(ERROR_MESSAGES.MODEL_NOT_FOUND);
        }
        else {
            // Otherwise - rethrow it so we can bug out.
            log.error({ err }, 'Unhandled Conversation exception');
            throw err;
        }
    }
}

async function deleteClassifierUsingCredentials(classifier: TrainingObjects.ConversationWorkspace,
                                                credentials?: TrainingObjects.BluemixCredentials)
{
    if (credentials) {
        try {
            await deleteClassifierFromBluemix(credentials, classifier.workspace_id);
        }
        catch (err) {
            log.error({ err, classifier }, 'Unable to delete Conversation workspace');
        }
    }

    await store.deleteConversationWorkspace(classifier.id);
    await store.resetExpiredScratchKey(classifier.workspace_id, 'text');
}


async function deleteClassifierUnknownClass(classifier: TrainingObjects.ConversationWorkspace): Promise<void>
{
    return store.getCombinedBluemixCredentialsById(classifier.credentialsid)
        .then((creds) => {
            return deleteClassifierUsingCredentials(classifier, creds);
        })
        .catch((err) => {
            log.error({ err, classifier }, 'Could not find credentials to delete classifier from Bluemix');
            return deleteClassifierUsingCredentials(classifier);
        });
}



/**
 * Deletes a conversation workspace.
 *  This deletes both the classifier from Bluemix, and the record of it
 *  stored in the app's database.
 */
export function deleteClassifier(tenant: DbObjects.ClassTenant, classifier: TrainingObjects.ConversationWorkspace): Promise<void>
{
    let credentials: TrainingObjects.BluemixCredentials;

    return store.getBluemixCredentialsById(tenant.tenantType, classifier.credentialsid)
        .then((creds) => {
            credentials = creds;
            return deleteClassifierUsingCredentials(classifier, credentials);
        })
        .then(async () => {
            if (tenant.tenantType === DbObjects.ClassTenantType.ManagedPool) {
                // if this classifier was using credentials from the managed pool, then
                //  we move the last-fail timestamp back an hour to prioritse reusing
                //  these credentials for future model training requests
                await store.recordBluemixCredentialsPoolModelDeletion(credentials as TrainingObjects.BluemixCredentialsPool);
            }
        });
}


export async function deleteClassifierFromBluemix(
    credentials: TrainingObjects.BluemixCredentials,
    classifierId: string,
): Promise<void>
{
    const req = await createBaseRequest(credentials);

    try {
        const url = credentials.url + '/v1/workspaces/' + classifierId;
        await request.del(url, req);
    }
    catch (err) {
        if (err.statusCode === httpStatus.NOT_FOUND) {
            log.debug({ classifierId }, 'Attempted to delete non-existent workspace');
            return;
        }
        if (err.statusCode === httpStatus.BAD_REQUEST &&
            err.error.error &&
            err.error.error.includes('Cannot delete skill') &&
            err.error.error.includes('it is referenced by assistant'))
        {
            log.debug({ classifierId, err }, 'Attempted to delete workspace that is in use');

            const deletionError: any = new Error(ERROR_MESSAGES.SKILL_IN_USE);
            deletionError.error = err.error;
            deletionError.statusCode = err.statusCode;
            throw deletionError;
        }

        log.error({ err, credentials, classifierId }, 'Failed to delete model from Watson Assistant');
        notifications.notify('Unexpected failure to delete text classifier' +
                            ' with id : ' + classifierId +
                            ' using creds : ' + credentials.id + ' : ' +
                            err.message, notifications.SLACK_CHANNELS.TRAINING_ERRORS);

        throw err;
    }
}



/**
 * Updates the provided set of Conversation workspaces with the current status from
 *  Bluemix.
 *
 * @param classid - the tenant that the user is a member of
 * @param workspaces - set of workspaces to get status info for
 *
 * @returns the same set of workspaces, with the status and updated timestamp
 *  properties set using responses from the Bluemix REST API
 */
export function getClassifierStatuses(
    tenant: DbObjects.ClassTenant,
    workspaces: TrainingObjects.ConversationWorkspace[],
): Promise<TrainingObjects.ConversationWorkspace[]>
{
    const credentialsCacheById: any = {};

    return Promise.all(
        workspaces.map(async (workspace) => {
            if (workspace.credentialsid in credentialsCacheById === false) {
                try {
                    const creds = await store.getBluemixCredentialsById(tenant.tenantType, workspace.credentialsid);
                    credentialsCacheById[workspace.credentialsid] = creds;
                }
                catch (err) {
                    log.error({ err }, 'Credentials for Conversation workspace are missing');
                    workspace.status = 'Unavailable';
                    return workspace;
                }
            }
            return getStatus(credentialsCacheById[workspace.credentialsid], workspace);
        }),
    );
}



export async function getStatus(
    credentials: TrainingObjects.BluemixCredentials,
    workspace: TrainingObjects.ConversationWorkspace,
): Promise<TrainingObjects.ConversationWorkspace>
{
    let req: NewConvRequest | LegacyConvRequest;
    try {
        req = await createBaseRequest(credentials);
    }
    catch (err) {
        log.error({ err }, 'Failed to get auth token for querying model');
        workspace.status = 'Non Existent';
        return workspace;
    }

    return request.get(workspace.url, req)
        .then((body) => {
            workspace.status = body.status;
            workspace.updated = new Date(body.updated);
            return workspace;
        })
        .catch((err) => {
            log.warn({ err }, 'Failed to get status');
            workspace.status = 'Non Existent';
            return workspace;
        });
}




async function getTraining(project: DbObjects.Project): Promise<TrainingObjects.ConversationTrainingData> {
    const counts = await store.countTrainingByLabel(project);

    const intents: TrainingObjects.ConversationIntent[] = [];
    for (const label of project.labels) {

        if (label in counts && counts[label] > 0) {
            const training = await store.getUniqueTrainingTextsByLabel(project.id, label, {
                start : 0, limit : counts[label],
            });

            intents.push({
                intent : label.replace(/\s/g, '_'),
                examples : training.map((item) => {
                    return { text : item };
                }),
            });
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








async function submitTrainingToConversation(
    project: DbObjects.Project,
    credentials: TrainingObjects.BluemixCredentials,
    url: string,
    training: TrainingObjects.ConversationTrainingData,
    id: string,
    tenantPolicy: DbObjects.ClassTenant,
): Promise<TrainingObjects.ConversationWorkspace>
{
    let req: NewTrainingRequest | LegacyTrainingRequest | undefined;

    try {
        const basereq = await createBaseRequest(credentials);
        req = {
            ...basereq,
            body : training,
        };

        const body = await request.post(url, req, false);

        // check that we have timestamps, or create our own otherwise
        const created = body.created ? new Date(body.created) : new Date();
        const updated = body.updated ? new Date(body.updated) : new Date();

        // determine when the Conversation workspace should be deleted
        const modelAutoExpiryTime = new Date(updated.getTime());
        modelAutoExpiryTime.setHours(modelAutoExpiryTime.getHours() +
                                     tenantPolicy.textClassifierExpiry);

        const workspace: TrainingObjects.ConversationWorkspace = {
            id,
            name : body.name,
            language : body.language,
            created,
            updated,
            expiry : modelAutoExpiryTime,
            workspace_id : body.workspace_id,
            credentialsid : credentials.id,
            status : body.status ? body.status : 'Training',
            url : credentials.url + '/v1/workspaces/' + body.workspace_id,
        };

        return workspace;
    }
    catch (err) {
        log.warn({ req, err, project : project.id, credentials : credentials.id }, ERROR_MESSAGES.UNKNOWN);

        if (tenantPolicy.tenantType === DbObjects.ClassTenantType.ManagedPool) {
            await store.recordBluemixCredentialsPoolFailure(credentials as TrainingObjects.BluemixCredentialsPool);
        }

        // The full error object will include the Conversation request with the
        //  URL and credentials we used for it. So we don't want to return
        //  that - after logging, we create a new exception to throw, with
        //  just the bits that should be safe to share.
        const trainingError: any = new Error(ERROR_MESSAGES.UNKNOWN);
        trainingError.error = err.error;
        trainingError.statusCode = err.statusCode;

        throw trainingError;
    }
}




export async function testClassifier(
    credentials: TrainingObjects.BluemixCredentials,
    classifierId: string, classifierTimestamp: Date,
    projectid: string,
    text: string,
): Promise<TrainingObjects.Classification[]>
{
    try {
        const basereq = await createBaseRequest(credentials);
        const req = {
            ...basereq,
            body : {
                input : {
                    text,
                },
                alternate_intents : true,
            },
        };

        const body = await request.post(credentials.url + '/v1/workspaces/' + classifierId + '/message', req, true);
        if (body.intents.length === 0) {
            const project = await store.getProject(projectid);
            if (project) {
                return [ chooseLabelAtRandom(project, classifierTimestamp) ];
            }
            else {
                return [];
            }
        }

        return body.intents.map((item: ConversationApiResponsePayloadIntentItem) => {
            return {
                class_name : item.intent,
                confidence : Math.round(item.confidence * 100),
                classifierTimestamp,
            };
        });
    }
    catch (err) {
        if (err.statusCode === httpStatus.TOO_MANY_REQUESTS)
        {
            throw new Error(ERROR_MESSAGES.API_KEY_RATE_LIMIT);
        }
        if (err.statusCode === httpStatus.NOT_FOUND &&
            err.error && err.error.code && err.error.code === httpStatus.NOT_FOUND)
        {
            throw new Error(ERROR_MESSAGES.MODEL_NOT_FOUND);
        }
        if (err.statusCode === httpStatus.BAD_REQUEST &&
            err.error &&
            err.error.code && err.error.code === httpStatus.BAD_REQUEST &&
            err.error.errors && Array.isArray(err.error.errors) && err.error.errors.length > 0 &&
            err.error.errors[0].message === ERROR_MESSAGES.TEXT_TOO_LONG)
        {
            throw new Error(ERROR_MESSAGES.TEXT_TOO_LONG);
        }
        if (err.statusCode === httpStatus.SERVICE_UNAVAILABLE ||
            err.statusCode === httpStatus.BAD_GATEWAY)
        {
            throw new Error(ERROR_MESSAGES.SERVICE_ERROR);
        }

        log.error({ err, classifierId, credentials, projectid, text }, 'Failed to classify text');
        throw err;
    }
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



/**
 * An admin user has provided the credentials for a Watson Assistant service instance,
 *  but we don't know which IBM Cloud region the service instance is from. This function
 *  identifies the region (by trying the credentials in all known regions, and returning
 *  the URL for the region that the credentials were not rejected in).
 *
 * @returns url - Promise that resolves to the URL that accepted the credentials
 */
export async function identifyRegion(username: string, password: string): Promise<string>
{
    const testRequest = await createBaseRequest({
        username, password,
        servicetype: 'conv',

        // We don't know these values, but createBaseRequest is a private
        //  function that we know doesn't use them, so it's safe to fill
        //  these with any old junk.
        classid: 'placeholder',
        id: 'placeholder',
        url: 'unknown',
        credstype: 'unknown',
    });

    // as we don't care about the response (we're just checking the credentials)
    //  we try to keep the request as small as possible
    testRequest.qs.page_limit = 1;


    const POSSIBLE_URLS = [
        'https://api.us-south.assistant.watson.cloud.ibm.com',
        'https://api.us-east.assistant.watson.cloud.ibm.com',
        'https://api.eu-gb.assistant.watson.cloud.ibm.com',
        'https://api.eu-de.assistant.watson.cloud.ibm.com',
        'https://api.au-syd.assistant.watson.cloud.ibm.com',
        'https://api.jp-tok.assistant.watson.cloud.ibm.com',
        // 'https://api.kr-seo.assistant.watson.cloud.ibm.com',
    ];

    let lastErr: Error = new Error('Failed to verify credentials');

    for (const url of POSSIBLE_URLS) {
        try {
            log.debug({ url }, 'Testing Watson Assistant credentials');
            await request.get(url + '/v1/workspaces', testRequest);

            // if we're here, the credentials were accepted
            return url;
        }
        catch (err) {
            log.debug({ url, err }, 'Credentials rejected');
            lastErr = err;
        }
    }

    // if we're here, all URLs rejected the credentials
    throw lastErr;
}






export async function getTextClassifiers(
    credentials: TrainingObjects.BluemixCredentials,
): Promise<TrainingObjects.ClassifierSummary[]>
{
    const req =  await createBaseRequest(credentials);

    // to avoid repeated requests, we ask for *all* the classifiers!
    req.qs.page_limit = 100;

    try {
        const body = await request.get(credentials.url + '/v1/workspaces', req);
        return body.workspaces.map((workspaceinfo: ConversationApiResponsePayloadWorkspaceItem) => {
            return {
                id : workspaceinfo.workspace_id,
                name : workspaceinfo.name,
                type : 'conv',
                credentials,
            };
        });
    }
    catch (err) {
        if (err.response && err.response.body) {
            if (!err.response.body.statusCode && typeof err.response.body === 'object') {
                err.response.body.statusCode = err.response.body.code;
            }
            throw err.response.body;
        }
        else {
            throw err;
        }
    }
}




export async function testMultipleCredentials(creds: TrainingObjects.BluemixCredentials[]): Promise<boolean>
{
    let atLeastOneValidCredential = false;
    for (const nextcred of creds) {
        try {
            await getTextClassifiers(nextcred);
            atLeastOneValidCredential = true;
        }
        catch (err) {
            log.error({ nextcred, err }, 'Credentials test failed');
        }
    }
    return atLeastOneValidCredential;
}



export async function cleanupExpiredClassifiers(): Promise<void[]>
{
    log.info('Cleaning up expired Conversation workspaces');
    const expired: TrainingObjects.ConversationWorkspace[] = await store.getExpiredConversationWorkspaces();
    return Promise.all(expired.map(deleteClassifierUnknownClass));
}



/**
 * Identifies what type of credentials are provided, so that the right auth
 *  mechanism can be used.
 */
export function getType(credentials: TrainingObjects.BluemixCredentials): TrainingObjects.ConversationCredsType {
    if (credentials.username.length === 36 && credentials.password.length === 12) {
        return 'legacy';
    }
    return 'current';
}




async function createBaseRequest(credentials: TrainingObjects.BluemixCredentials)
    : Promise<LegacyConvRequest | NewConvRequest>
{
    if (getType(credentials) === 'legacy') {
        const req: LegacyConvRequest = {
            qs : {
                version: '2017-05-26',
            },
            auth : {
                user : credentials.username,
                pass : credentials.password,
            },
            headers: {
                'user-agent': 'machinelearningforkids',
                'X-Watson-Learning-Opt-Out': 'true',
            },
            json : true,
            gzip : true,
            timeout : 30000,
        };
        return Promise.resolve(req);
    }
    else {
        const authHeader = await iam.getAuthHeader(credentials.username + credentials.password);

        const req: NewConvRequest = {
            qs : {
                version: '2018-09-20',
                include_audit: true,
            },
            headers : {
                'user-agent': 'machinelearningforkids',
                'X-Watson-Learning-Opt-Out': 'true',
                'Authorization': authHeader,
            },
            json : true,
            gzip : true,
            timeout : 30000,
        };
        return req;
    }
}






interface ConversationApiResponsePayloadIntentItem {
    readonly intent: string;
    readonly confidence: number;
}
interface ConversationApiResponsePayloadWorkspaceItem {
    readonly workspace_id: string;
    readonly name: string;
}



interface ConversationRequestBase {
    readonly qs: {
        readonly version: string;
        page_limit?: number;
    };
    readonly headers: {
        readonly 'user-agent': 'machinelearningforkids';
        readonly 'X-Watson-Learning-Opt-Out': 'true';
    };
    readonly json: true;
    readonly gzip: true;
    readonly timeout: number;
}

interface LegacyConvRequest extends ConversationRequestBase {
    readonly qs: {
        readonly version: '2017-05-26';
        page_limit?: number;
    };
    readonly auth: {
        readonly user: string;
        readonly pass: string;
    };
}
interface NewConvRequest extends ConversationRequestBase {
    readonly qs: {
        readonly version: '2018-09-20';
        page_limit?: number;
        readonly include_audit: true;
    };
    readonly headers: {
        readonly 'user-agent': 'machinelearningforkids';
        readonly 'X-Watson-Learning-Opt-Out': 'true';
        readonly Authorization: string;
    };
}

interface TrainingRequest {
    readonly body: TrainingObjects.ConversationTrainingData;
}
interface TestRequest {
    readonly body: {
        readonly input: {
            readonly text: string;
        };
        readonly alternate_intents: boolean;
    };
}


export interface LegacyTrainingRequest extends TrainingRequest, LegacyConvRequest {}
export interface NewTrainingRequest extends TrainingRequest, NewConvRequest {}
export interface LegacyTestRequest extends TestRequest, LegacyConvRequest {}
export interface NewTestRequest extends TestRequest, NewConvRequest {}
