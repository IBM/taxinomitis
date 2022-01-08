// local dependencies
import * as store from '../db/store';
import * as Types from '../db/db-types';
import * as ScratchTypes from './scratchx-types';
import * as TrainingTypes from '../training/training-types';





async function createTextKey(project: Types.Project): Promise<ScratchTypes.Key> {
    const textClassifiers = await store.getConversationWorkspaces(project.id);

    if (textClassifiers.length === 0) {
        const id = await store.storeUntrainedScratchKey(project);
        return { id };
    }
    else {
        const classifier = textClassifiers[0];
        const model = classifier.workspace_id;
        const tenant = await store.getClassTenant(project.classid);

        const credentials = await store.getBluemixCredentialsById(tenant.tenantType,
                                                                  classifier.credentialsid);

        const id = await store.storeOrUpdateScratchKey(project,
            credentials, classifier.workspace_id, classifier.created);

        return { id, model };
    }
}


async function createImagesKey(project: Types.Project): Promise<ScratchTypes.Key> {
    const id = await store.storeUntrainedScratchKey(project);
    return { id };
}


async function createNumbersKey(project: Types.Project): Promise<ScratchTypes.Key> {
    const numClassifiers = await store.getNumbersClassifiers(project.id);

    if (numClassifiers.length === 0) {
        const id = await store.storeUntrainedScratchKey(project);
        return { id };
    }
    else {
        const credentials: TrainingTypes.BluemixCredentials = {
            servicetype: 'num',
            id: 'NOTUSED',
            url: 'tenantid=' + project.classid + '&' +
                'studentid=' + project.userid + '&' +
                'projectid=' + project.id,
            username: project.userid,
            password: project.classid,
            classid : project.classid,
            credstype : 'unknown',
        };

        const classifier = numClassifiers[0];

        const id = await store.storeOrUpdateScratchKey(
            project,
            credentials,
            project.id,
            classifier.created);

        return { id, model : project.id };
    }
}


async function createSoundKey(project: Types.Project): Promise<ScratchTypes.Key> {
    const id = await store.storeUntrainedScratchKey(project);
    return { id };
}
async function createImagesTfjsKey(project: Types.Project): Promise<ScratchTypes.Key> {
    const id = await store.storeUntrainedScratchKey(project);
    return { id };
}




export async function createKey(projectid: string): Promise<ScratchTypes.Key>
{
    const project = await store.getProject(projectid);

    if (!project) {
        throw new Error('Project not found');
    }

    switch (project.type) {
    case 'text':
        return createTextKey(project);
    case 'images':
        return createImagesKey(project);
    case 'numbers':
        return createNumbersKey(project);
    case 'sounds':
        return createSoundKey(project);
    case 'imgtfjs':
        return createImagesTfjsKey(project);
    }
}
