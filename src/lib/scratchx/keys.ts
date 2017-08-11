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

        const credentials = await store.getBluemixCredentialsById(classifier.credentialsid);

        const id = await store.storeOrUpdateScratchKey(project,
            credentials, classifier.workspace_id);

        return { id, model };
    }
}


async function createImagesKey(project: Types.Project): Promise<ScratchTypes.Key> {
    const imageClassifiers = await store.getImageClassifiers(project.id);

    if (imageClassifiers.length === 0) {
        const id = await store.storeUntrainedScratchKey(project);
        return { id };
    }
    else {
        const classifier = imageClassifiers[0];
        const model = classifier.classifierid;

        const credentials = await store.getBluemixCredentialsById(classifier.credentialsid);

        const id = await store.storeOrUpdateScratchKey(project,
            credentials, classifier.classifierid);

        return { id, model };
    }
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
        };

        const id = await store.storeOrUpdateScratchKey(
            project,
            credentials,
            project.id);

        return { id, model : project.id };
    }
}



export async function createKey(projectid: string): Promise<ScratchTypes.Key>
{
    const project = await store.getProject(projectid);

    switch (project.type) {
    case 'text':
        return createTextKey(project);
    case 'images':
        return createImagesKey(project);
    case 'numbers':
        return createNumbersKey(project);
    }
}
