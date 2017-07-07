// external dependencies
import * as request from 'request-promise';
import * as httpStatus from 'http-status';
// local dependencies
import * as store from '../db/store';
import * as DbObjects from '../db/db-types';
import * as TrainingObjects from './training-types';
import loggerSetup from '../utils/logger';

const log = loggerSetup();




export async function trainClassifier(
    userid: string, classid: string, project: DbObjects.Project,
): Promise<TrainingObjects.ConversationWorkspace>
{
    let workspace: TrainingObjects.ConversationWorkspace;

    const training = await getTraining(project);

    const existingWorkspaces = await store.getConversationWorkspaces(project.id);
    if (existingWorkspaces.length > 0) {
        workspace = existingWorkspaces[0];

        const credentials = await store.getBluemixCredentialsById(workspace.credentialsid);

        workspace = await updateWorkspace(project, credentials, workspace, training);
    }
    else {
        const credentials = await store.getBluemixCredentials(classid, 'conv');

        workspace = await createWorkspace(project, credentials, userid, classid, training);
    }

    return workspace;
}





async function createWorkspace(
    project: DbObjects.Project,
    credentialsPool: TrainingObjects.BluemixCredentials[],
    userid: string, classid: string,
    training: TrainingObjects.ConversationTrainingData,
): Promise<TrainingObjects.ConversationWorkspace>
{
    let workspace;

    for (const credentials of credentialsPool) {
        try {
            const url = credentials.url + '/v1/workspaces';
            workspace = await submitTrainingToConversation(project, credentials, url, training);

            await store.storeConversationWorkspace(
                credentials,
                userid, classid, project.id,
                workspace);

            await store.storeOrUpdateScratchKey(project.id, 'text',
                userid, classid,
                credentials, workspace.workspace_id);

            return workspace;
        }
        catch (err) {
            // If we couldn't create a workspace because we've used up the
            //  number of workspaces allowed with these creds, then swallow
            //  the error so we can try the next set of creds in the pool
            // Otherwise - rethrow it so we can bug out.
            if (err.error.startsWith('Maximum workspaces limit exceeded') === false)
            {
                throw err;
            }
        }
    }

    // if we're here, it means we don't have room for any new workspaces
    //  with the available credentials
    throw new Error('Your class already has created their maximum allowed number of models');
}


function updateWorkspace(
    project: DbObjects.Project,
    credentials: TrainingObjects.BluemixCredentials,
    workspace: TrainingObjects.ConversationWorkspace,
    training: TrainingObjects.ConversationTrainingData,
): Promise<TrainingObjects.ConversationWorkspace>
{
    const url = credentials.url + '/v1/workspaces/' + workspace.workspace_id;
    return submitTrainingToConversation(project, credentials, url, training);
}




/**
 * Deletes a conversation workspace.
 *  This deletes both the classifier from Bluemix, and the record of it
 *  stored in the app's database.
 *
 * @param userid - ID of the user that has collected the training data
 * @param classid - the tenant that the user is a member of
 * @param projectid - the ID for the project with the training data
 */
export async function deleteClassifier(
    userid: string, classid: string, projectid: string,
    classifier: TrainingObjects.ConversationWorkspace,
): Promise<void>
{
    const credentials = await store.getBluemixCredentialsById(classifier.credentialsid);

    await deleteClassifierFromBluemix(credentials, classifier.workspace_id);

    await store.deleteConversationWorkspace(projectid, userid, classid, classifier.workspace_id);
}

async function deleteClassifierFromBluemix(
    credentials: TrainingObjects.BluemixCredentials,
    classifierId: string,
): Promise<void>
{
    const req = {
        auth : {
            user : credentials.username,
            pass : credentials.password,
        },
        qs : {
            version : '2017-05-26',
        },
    };

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
 * @returns the same set of workspaces, with the status and udpated timestamp
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
                const creds = await store.getBluemixCredentialsById(workspace.credentialsid);
                credentialsCacheById[workspace.credentialsid] = creds;
            }
            return getStatus(credentialsCacheById[workspace.credentialsid], workspace);
        }),
    );
}



export function getStatus(
    credentials: TrainingObjects.BluemixCredentials,
    workspace: TrainingObjects.ConversationWorkspace,
): PromiseLike<TrainingObjects.ConversationWorkspace>
{
    return request.get(workspace.url, {
        auth : {
            user : credentials.username,
            pass : credentials.password,
        },
        qs : {
            version : '2017-05-26',
        },
        json : true,
    })
    .then((body) => {
        workspace.status = body.status;
        workspace.updated = new Date(body.updated);
        return workspace;
    })
    .catch((err) => {
        log.error({ err }, 'Failed to get status');
        workspace.status = 'Non Existent';
        return workspace;
    });
}


async function getTraining(project: DbObjects.Project): Promise<TrainingObjects.ConversationTrainingData> {
    const counts = await store.countTextTrainingByLabel(project.id);

    const intents: TrainingObjects.ConversationIntent[] = [];
    for (const label of project.labels) {
        const training = await store.getTextTrainingByLabel(project.id, label, {
            start : 0, limit : counts[label],
        });

        intents.push({
            intent : label,
            examples : training.map((item) => {
                return { text : item.textdata };
            }),
        });
    }

    return {
        name : project.name,
        language : 'en',
        intents,
        dialog_nodes : [],
        counterexamples: [],
        entities : [],
    };
}








async function submitTrainingToConversation(
    project: DbObjects.Project,
    credentials: TrainingObjects.BluemixCredentials,
    url: string,
    training: TrainingObjects.ConversationTrainingData,
): Promise<TrainingObjects.ConversationWorkspace>
{
    const req = {
        auth : {
            user : credentials.username,
            pass : credentials.password,
        },
        qs : {
            version : '2017-05-26',
        },
        body : training,
        json : true,
        gzip : true,
    };

    try {
        const body = await request.post(url, req);

        return {
            name : body.name,
            language : body.language,
            created : new Date(body.created),
            updated : new Date(body.updated),
            workspace_id : body.workspace_id,
            credentialsid : credentials.id,
            status : body.status ? body.status : 'Training',
            url : credentials.url + '/v1/workspaces/' + body.workspace_id,
        };
    }
    catch (err) {
        log.error({ req, err }, 'Failed to train workspace');

        // The full error object will include the Conversation request with the
        //  URL and credentials we used for it. So we don't want to return
        //  that - after logging, we create a new exception to throw, with
        //  just the bits that should be safe to share.
        const trainingError: any = new Error('Failed to train workspace');
        trainingError.error = err.error;

        throw trainingError;
    }
}


export async function testClassifier(
    credentials: TrainingObjects.BluemixCredentials,
    classifierId: string,
    text: string,
): Promise<TrainingObjects.Classification[]>
{
    const req = {
        auth : {
            user : credentials.username,
            pass : credentials.password,
        },
        qs : {
            version : '2017-05-26',
        },
        body : {
            input : {
                text,
            },
        },
        json : true,
    };

    const body = await request.post(credentials.url + '/v1/workspaces/' + classifierId + '/message', req);
    return body.intents.map((item) => {
        return { class_name : item.intent, confidence : Math.round(item.confidence * 100) };
    });
}
