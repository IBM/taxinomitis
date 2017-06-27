// local dependencies
import * as store from '../db/store';
import * as Types from '../db/db-types';
import * as ScratchTypes from './scratchx-types';






async function createTextKey(project: Types.Project): Promise<ScratchTypes.Key> {
    const nlcClassifiers = await store.getNLCClassifiers(project.id);

    if (nlcClassifiers.length === 0) {
        const id = await store.storeUntrainedScratchKey(
            project.id, project.name, project.type,
            project.userid, project.classid);
        return { id };
    }
    else {
        const classifier = nlcClassifiers[0];
        const model = classifier.classifierid;

        const credentials = await store.getServiceCredentials(
            project.id, project.classid, project.userid,
            'nlc', classifier.classifierid);

        const id = await store.storeOrUpdateScratchKey(
            project.id, project.type,
            project.userid, project.classid,
            credentials, classifier.classifierid);

        return { id, model };
    }
}

async function createNumbersKey(project: Types.Project): Promise<ScratchTypes.Key> {
    const id = await store.storeUntrainedScratchKey(
        project.id, project.name, project.type,
        project.userid, project.classid);
    return { id };
}



export async function createKey(projectid: string): Promise<ScratchTypes.Key>
{
    const project = await store.getProject(projectid);

    if (project.type === 'text') {
        return createTextKey(project);
    }
    else if (project.type === 'numbers') {
        return createNumbersKey(project);
    }
    else {
        throw new Error('Not implemented yet');
    }
}
