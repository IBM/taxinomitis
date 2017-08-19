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

export const credsForVisRec: TrainingTypes.BluemixCredentials = {
    id : '456',
    username : 'user',
    password : 'pass',
    servicetype : 'visrec',
    url : 'http://visual.recognition.service',
    classid : 'classid',
};

export function getBluemixCredentials(classid: string, service: TrainingTypes.BluemixServiceType) {
    if (service === 'conv'){
        return new Promise((resolve) => resolve([ creds ]));
    }
    else if (service === 'visrec') {
        return new Promise((resolve) => resolve([ credsForVisRec ]));
    }
    return new Promise((resolve) => resolve([ ]));
}
export function getBluemixCredentialsById(id: string) {
    return new Promise((resolve, reject) => {
        if (id === '123') {
            return resolve(creds);
        }
        else if (id === '456') {
            return resolve(credsForVisRec);
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
const NUM_IMAGES_TRAINING_PER_LABEL = {
    rock : 12, paper : 11,
};
const NUM_IMAGES_TRAINING_TINY = {
    rock : 2, paper : 3,
};
const NUM_IMAGES_TRAINING_MASSIVE = {
    rock : 20000, paper : 25000,
};

export function countTrainingByLabel(type: DbTypes.ProjectTypeLabel, projectid: string): Promise<{}> {
    if (projectid === 'projectbob') {
        return new Promise((resolve) => resolve(NUM_TRAINING_PER_LABEL));
    }
    else if (projectid === 'projectbobvis' || projectid === 'projectbobvislim') {
        return new Promise((resolve) => resolve(NUM_IMAGES_TRAINING_PER_LABEL));
    }
    else if (projectid === 'tinyvis') {
        return new Promise((resolve) => resolve(NUM_IMAGES_TRAINING_TINY));
    }
    else if (projectid === 'massivevis') {
        return new Promise((resolve) => resolve(NUM_IMAGES_TRAINING_MASSIVE));
    }
    else {
        return new Promise((resolve) => resolve({}));
    }
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

export function getImageTrainingByLabel(projectid: string, label: string, options: DbTypes.PagingOptions) {
    const start = options.start;
    const limit = options.limit;
    let end: number;
    if (projectid === 'projectbobvis' || projectid === 'projectbobvislim') {
        end = Math.min(start + limit, NUM_IMAGES_TRAINING_PER_LABEL[label]);
    }
    else if (projectid === 'tinyvis') {
        end = Math.min(start + limit, NUM_IMAGES_TRAINING_TINY[label]);
    }
    else if (projectid === 'massivevis') {
        end = Math.min(start + limit, NUM_IMAGES_TRAINING_MASSIVE[label]);
    }

    const training = [];

    for (let idx = start; idx < end; idx++) {
        training.push({ imageurl : 'http://some-website.com/' + label + '-' + idx + '.jpg' });
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

export function storeImageClassifier(
    credentials: TrainingTypes.BluemixCredentials,
    project: DbTypes.Project,
    classifier: TrainingTypes.VisualClassifier,
): Promise<TrainingTypes.VisualClassifier>
{
    return new Promise((resolve) => resolve(
        DbObjects.createVisualClassifier(
            classifier, credentials, project,
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
export function getImageClassifiers()
{
    return new Promise((resolve) => resolve([]));
}

export function deleteConversationWorkspace()
{
    return new Promise((resolve) => resolve());
}
export function deleteImageClassifier()
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
        supportedProjectTypes : [ 'text', 'images' ],
        maxUsers : 8,
        maxProjectsPerUser : 3,
        textClassifierExpiry : 2,
        imageClassifierExpiry : 3,
    }));
}

export function getProject(projectid: string): Promise<DbTypes.Project>
{
    if (projectid === 'projectbob') {
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
    else if (projectid === 'projectbobvis' ||
             projectid === 'projectbobvislim' ||
             projectid === 'tinyvis' ||
             projectid === 'massivevis')
    {
        return new Promise((resolve) => resolve({
            id : projectid,
            name : 'projectname',
            userid : 'userid',
            classid : 'classid',
            type : 'images',
            fields : [],
            labels : ['rock', 'paper'],
        }));
    }
}
