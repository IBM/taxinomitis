import * as TrainingTypes from '../../lib/training/training-types';
import * as DbTypes from '../../lib/db/db-types';
import * as DbObjects from '../../lib/db/objects';

export const creds: TrainingTypes.BluemixCredentials = {
    id : '123',
    username : 'user',
    password : 'pass',
    servicetype : 'conv',
    url : 'http://conversation.service',
    classid : 'classid',
};

export function getBluemixCredentials() {
    return new Promise((resolve) => resolve([ creds ]));
}
export function getBluemixCredentialsById(id: string) {
    return new Promise((resolve, reject) => {
        if (id === '123') {
            return resolve(creds);
        }
        else {
            return reject(new Error('Unexpected response when retrieving service credentials'));
        }
    });
}

const NUM_TRAINING_PER_LABEL = {
    temperature : 18,
    conditions : 16,
};

export function countTrainingByLabel(): Promise<{}> {
    return new Promise((resolve) => resolve(NUM_TRAINING_PER_LABEL));
}

export function getUniqueTrainingTextsByLabel(projectid: string, label: string, options: DbTypes.PagingOptions) {
    const start = options.start;
    const limit = options.limit;
    const end = Math.min(start + limit, NUM_TRAINING_PER_LABEL[label]);

    const training: string[] = [];

    for (let idx = start; idx < end; idx++) {
        training.push('sample text ' + idx);
    }

    return new Promise((resolve) => resolve(training));
}

export function storeConversationWorkspace(
    credentials: TrainingTypes.BluemixCredentials,
    project: DbTypes.Project,
    classifier: TrainingTypes.ConversationWorkspace,
): Promise<TrainingTypes.ConversationWorkspace>
{
    return new Promise((resolve) => resolve(
        DbObjects.getWorkspaceFromDbRow(
            DbObjects.createConversationWorkspace(
                classifier, credentials, project,
            ),
        ),
    ));
}

export function updateConversationWorkspaceExpiry()
{
    return new Promise((resolve) => resolve());
}

export function getConversationWorkspaces()
{
    return new Promise((resolve) => resolve([]));
}

export function deleteConversationWorkspace()
{
    return new Promise((resolve) => resolve());
}

export function storeOrUpdateScratchKey()
{
    return new Promise((resolve) => resolve());
}
export function resetExpiredScratchKey()
{
    return new Promise((resolve) => resolve());
}

export function getClassTenant(classid: string)
{
    return new Promise((resolve) => resolve({
        id : classid,
        supportedProjectTypes : [ 'text' ],
        maxUsers : 8,
        maxProjectsPerUser : 3,
        textClassifierExpiry : 2,
    }));
}

export function getProject(projectid: string): Promise<DbTypes.Project>
{
    return new Promise((resolve) => resolve({
        id : projectid,
        name : 'projectname',
        userid : 'userid',
        classid : 'classid',
        type : 'text',
        fields : [],
        labels : ['temperature', 'conditions'],
    }));
}
