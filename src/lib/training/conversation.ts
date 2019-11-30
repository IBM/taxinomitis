// external dependencies
import * as request from 'request-promise';
import * as httpStatus from 'http-status';
import * as uuid from 'uuid/v1';
import * as _ from 'lodash';
// local dependencies
import * as store from '../db/store';
import * as iam from '../iam';
import * as DbObjects from '../db/db-types';
import * as TrainingObjects from './training-types';
import * as notifications from '../notifications/slack';
import loggerSetup from '../utils/logger';

const log = loggerSetup();


export const ERROR_MESSAGES = {
    UNKNOWN : 'Failed to train machine learning model',
    INSUFFICIENT_API_KEYS : 'Your class already has created their maximum allowed number of models. ' +
                            'Please let your teacher or group leader know that ' +
                            'their "Watson Assistant API keys have no more workspaces available"',
    API_KEY_RATE_LIMIT : 'Your class is making too many requests to create machine learning models ' +
                         'at too fast a rate. ' +
                         'Please stop now and let your teacher or group leader know that ' +
                         '"the Watson Assistant service is currently rate limiting their API key"',
    MODEL_NOT_FOUND : 'Your machine learning model could not be found on the training server.',
    TEXT_TOO_LONG : 'text cannot be longer than 2048 characters',
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

        const credentials = await store.getBluemixCredentialsById(workspace.credentialsid);

        workspace = await updateWorkspace(project, credentials, workspace, training, tenantPolicy);
    }
    else {
        const credentials = await store.getBluemixCredentials(project.classid, 'conv');

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

    // Unless we see a different error, if this doesn't work, the reason
    //  will be that we don't have room for any new workspaces with the
    //  available credentials
    let finalError = ERROR_MESSAGES.INSUFFICIENT_API_KEYS;

    // shuffle the pool of credentials so the usage will be distributed
    //  across the set, rather than always directing training requests to
    //  the first creds in the pool
    const shuffledCredentialsPool = _.shuffle(credentialsPool);


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
                finalError = ERROR_MESSAGES.INSUFFICIENT_API_KEYS;
            }
            else if (err.error &&
                     err.error.error &&
                     err.error.error.startsWith('Rate limit exceeded'))
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
                const ignore = await store.isTenantDisruptive(project.classid);
                if (ignore === false) {
                    notifications.notify('Unexpected failure to train text classifier' +
                                        ' for project : ' + project.id +
                                        ' in class : ' + project.classid + ' : ' +
                                        err.message, notifications.SLACK_CHANNELS.TRAINING_ERRORS);
                }

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

    // This is a user-error, not indicative of an MLforKids failure.
    //  But notify the Slack bot anyway, as for now it is useful to be able to
    //  keep track of how frequently users are running into these resource limits.
    const ignoreErr = await store.isTenantDisruptive(project.classid);
    if (ignoreErr === false) {
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




/**
 * Deletes a conversation workspace.
 *  This deletes both the classifier from Bluemix, and the record of it
 *  stored in the app's database.
 */
export async function deleteClassifier(classifier: TrainingObjects.ConversationWorkspace): Promise<void>
{
    try {
        const credentials = await store.getBluemixCredentialsById(classifier.credentialsid);
        await deleteClassifierFromBluemix(credentials, classifier.workspace_id);
    }
    catch (err) {
        log.error({ err, classifier }, 'Unable to delete Conversation workspace');
    }

    await store.deleteConversationWorkspace(classifier.id);
    await store.resetExpiredScratchKey(classifier.workspace_id, 'text');
}


export async function deleteClassifierFromBluemix(
    credentials: TrainingObjects.BluemixCredentials,
    classifierId: string,
): Promise<void>
{
    const req = await createBaseRequest(credentials);

    try {
        const url = credentials.url + '/v1/workspaces/' + classifierId;
        await request.delete(url, req);
    }
    catch (err) {
        if (err.statusCode === httpStatus.NOT_FOUND) {
            log.debug({ classifierId }, 'Attempted to delete non-existent workspace');
            return;
        }
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
    classid: string,
    workspaces: TrainingObjects.ConversationWorkspace[],
): Promise<TrainingObjects.ConversationWorkspace[]>
{
    const credentialsCacheById: any = {};

    return Promise.all(
        workspaces.map(async (workspace) => {
            if (workspace.credentialsid in credentialsCacheById === false) {
                try {
                    const creds = await store.getBluemixCredentialsById(workspace.credentialsid);
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

        const body = await request.post(url, req);

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

        // record info about the new workspace
        // log.info({
        //     response : body,
        //     policy : tenantPolicy,
        //     expiry : modelAutoExpiryTime,
        //     workspace,
        // }, 'Trained Conversation workspace');

        return workspace;
    }
    catch (err) {
        log.warn({ req, err, project : project.id, credentials : credentials.id }, ERROR_MESSAGES.UNKNOWN);

        const ignoreErr = await store.isTenantDisruptive(project.classid);
        if (ignoreErr === false) {
            notifications.notify('Failed to train text classifier' +
                                 ' for project : ' + project.id +
                                 ' in class : ' + project.classid +
                                 ' using creds : ' + credentials.id +
                                 ' : ' + err.message,
                                 notifications.SLACK_CHANNELS.TRAINING_ERRORS);
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

    try {
        const body = await request.post(credentials.url + '/v1/workspaces/' + classifierId + '/message', req);
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
        'https://gateway.watsonplatform.net/assistant/api',
        'https://gateway-wdc.watsonplatform.net/assistant/api',
        'https://gateway-syd.watsonplatform.net/assistant/api',
        'https://gateway-fra.watsonplatform.net/assistant/api',
        'https://gateway-tok.watsonplatform.net/assistant/api',
        'https://gateway-lon.watsonplatform.net/assistant/api',
        'https://gateway-seo.watsonplatform.net/assistant/api',
        'https://gateway.watsonplatform.net/conversation/api',
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






export async function cleanupExpiredClassifiers(): Promise<void[]>
{
    log.info('Cleaning up expired Conversation workspaces');

    const expired: TrainingObjects.ConversationWorkspace[] = await store.getExpiredConversationWorkspaces();
    return Promise.all(expired.map(deleteClassifier));
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
