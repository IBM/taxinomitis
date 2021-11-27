import * as TrainingTypes from '../../lib/training/training-types';
import * as DbTypes from '../../lib/db/db-types';
import * as DbObjects from '../../lib/db/objects';

export const creds: TrainingTypes.BluemixCredentials = {
    id : '123',
    username : 'useruseruseruseruseruseruseruseruser',
    password : 'passpasspass',
    servicetype : 'conv',
    url : 'http://conversation.service',
    classid : 'classid',
    credstype : 'conv_lite',
};

export function getBluemixCredentials(tenant: DbTypes.ClassTenant, service: TrainingTypes.BluemixServiceType)
    : Promise<TrainingTypes.BluemixCredentials[]>
{
    if (service === 'conv'){
        return new Promise((resolve) => resolve([ creds ]));
    }
    return new Promise((resolve) => resolve([ ]));
}
export function getBluemixCredentialsById(classid: DbTypes.ClassTenantType, id: string): Promise<TrainingTypes.BluemixCredentials> {
    return new Promise((resolve, reject) => {
        if (id === '123') {
            return resolve(creds);
        }
        else {
            return reject(new Error('Unexpected response when retrieving service credentials'));
        }
    });
}

const NUM_TRAINING_PER_LABEL: { [label: string]: number } = {
    temperature : 18,
    conditions : 16,
};
const NUM_IMAGES_TRAINING_PER_LABEL: { [label: string]: number } = {
    rock : 12, paper : 11,
};
const NUM_IMAGES_TRAINING_TINY: { [label: string]: number } = {
    rock : 2, paper : 3,
};
const NUM_IMAGES_TRAINING_MASSIVE: { [label: string]: number } = {
    rock : 20000, paper : 25000,
};

export function countTrainingByLabel(project: DbTypes.Project): Promise<{}> {
    if (project.id === 'projectbob' || project.id === 'existingprojectid') {
        return new Promise((resolve) => resolve(NUM_TRAINING_PER_LABEL));
    }
    else if (project.id === 'projectbobvis' || project.id === 'projectbobvislim') {
        return new Promise((resolve) => resolve(NUM_IMAGES_TRAINING_PER_LABEL));
    }
    else if (project.id === 'tinyvis') {
        return new Promise((resolve) => resolve(NUM_IMAGES_TRAINING_TINY));
    }
    else if (project.id === 'massivevis') {
        return new Promise((resolve) => resolve(NUM_IMAGES_TRAINING_MASSIVE));
    }
    else {
        return new Promise((resolve) => resolve({}));
    }
}

export function getUniqueTrainingTextsByLabel(projectid: string, label: string, options: DbTypes.PagingOptions)
    : Promise<string[]>
{
    const start = options.start;
    const limit = options.limit;
    const end = Math.min(start + limit, NUM_TRAINING_PER_LABEL[label]);

    const training: string[] = [];

    for (let idx = start; idx < end; idx++) {
        training.push('sample text ' + idx);
    }

    return new Promise((resolve) => resolve(training));
}

export function getImageTrainingByLabel(projectid: string, label: string, options: DbTypes.PagingOptions)
    : Promise<DbTypes.ImageTraining[]>
{
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
    else {
        throw new Error('Unexpected project id');
    }

    const training: DbTypes.ImageTraining[] = [];

    for (let idx = start; idx < end; idx++) {
        const item: DbTypes.ImageTraining = {
            imageurl : 'http://some-website.com/' + label + '-' + idx + '.jpg',
        } as DbTypes.ImageTraining;
        training.push(item);
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
    return Promise.resolve();
}

export function getConversationWorkspaces(projectid: string): Promise<TrainingTypes.ConversationWorkspace[]>
{
    return new Promise((resolve) => {
        if (projectid === 'existingprojectid') {
            return resolve([
                {
                    id : 'existingworkspacedbid',
                    workspace_id : 'existing-classifier',
                    credentialsid : '123',
                    url : 'http://conversation.service/v1/workspaces/existing-classifier',
                    name : 'existing',
                    language : 'de',
                    created : new Date(),
                    expiry : new Date(),
                },
            ]);
        }
        resolve([]);
    });
}
export function getImageClassifiers()
{
    return Promise.resolve([]);
}

export function deleteConversationWorkspace()
{
    return Promise.resolve();
}
export function deleteImageClassifier()
{
    return Promise.resolve();
}

export function storeOrUpdateScratchKey(): Promise<string>
{
    return Promise.resolve('');
}
export function updateScratchKeyTimestamp()
{
    return Promise.resolve();
}
export function resetExpiredScratchKey()
{
    return Promise.resolve();
}

export function getClassTenant(classid: string): Promise<DbTypes.ClassTenant>
{
    const placeholder: DbTypes.ClassTenant = {
        id : classid,
        supportedProjectTypes : [ 'text', 'images' ],
        maxUsers : 8,
        maxProjectsPerUser : 3,
        textClassifierExpiry : 2,
        tenantType : DbTypes.ClassTenantType.UnManaged,
    };
    return Promise.resolve(placeholder);
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
            language : 'en',
            labels : ['temperature', 'conditions'],
            numfields : 0,
            isCrowdSourced : false,
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
            language : 'en',
            labels : ['rock', 'paper'],
            numfields : 0,
            isCrowdSourced : false,
        }));
    }
    else if (projectid === 'existingprojectid') {
        return new Promise((resolve) => resolve({
            id : projectid,
            name : 'existing',
            userid : 'userid',
            classid : 'classid',
            type : 'text',
            language : 'de',
            labels : ['temperature', 'conditions'],
            numfields : 0,
            isCrowdSourced : false,
        }));
    }

    throw new Error('Unexpected project id');
}
