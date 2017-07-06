import * as TrainingTypes from '../../lib/training/training-types';
import * as DbTypes from '../../lib/db/db-types';
import * as DbObjects from '../../lib/db/objects';

export const creds: TrainingTypes.BluemixCredentials = {
    id : '123',
    username : 'user',
    password : 'pass',
    servicetype : 'conv',
    url : 'http://conversation.service',
};

export function getBluemixCredentials() {
    return new Promise((resolve) => resolve(creds));
}
export function getServiceCredentials() {
    return new Promise((resolve) => resolve(creds));
}

const NUM_TRAINING_PER_LABEL = {
    temperature : 18,
    conditions : 16,
};

export function countTextTrainingByLabel(): Promise<{}> {
    return new Promise((resolve) => resolve(NUM_TRAINING_PER_LABEL));
}

export function getTextTrainingByLabel(projectid: string, label: string, options: DbTypes.PagingOptions) {
    const start = options.start;
    const limit = options.limit;
    const end = Math.min(start + limit, NUM_TRAINING_PER_LABEL[label]);

    const training: DbTypes.TextTraining[] = [];

    for (let idx = start; idx < end; idx++) {
        training.push({
            projectid,
            id : 'id' + idx,
            textdata : 'sample text ' + idx,
            label,
        });
    }

    return new Promise((resolve) => resolve(training));
}

export function storeConversationWorkspace(
    credentials: TrainingTypes.BluemixCredentials,
    userid: string, classid: string, projectid: string,
    classifier: TrainingTypes.ConversationWorkspace,
): Promise<TrainingTypes.ConversationWorkspace>
{
    return new Promise((resolve) => resolve(
        DbObjects.getWorkspaceFromDbRow(
            DbObjects.createConversationWorkspace(
                classifier, credentials,
                userid, classid, projectid,
            ),
        ),
    ));
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
