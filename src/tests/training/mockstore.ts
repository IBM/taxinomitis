import * as TrainingTypes from '../../lib/training/training-types';
import * as DbTypes from '../../lib/db/db-types';
import * as DbObjects from '../../lib/db/objects';

export const creds: TrainingTypes.BluemixCredentials = {
    id : '123',
    username : 'user',
    password : 'pass',
    servicetype : 'nlc',
    url : 'http://nlc.service',
};

export function getBluemixCredentials() {
    return new Promise((resolve) => resolve(creds));
}
export function getServiceCredentials() {
    return new Promise((resolve) => resolve(creds));
}

const NUM_TRAINING = 347;

export function countTextTraining(): Promise<number> {
    return new Promise((resolve) => resolve(NUM_TRAINING));
}

export function getTextTraining(projectid: string, options: DbTypes.PagingOptions) {
    const start = options.start;
    const limit = options.limit;
    const end = Math.min(start + limit, NUM_TRAINING);

    const training: DbTypes.TextTraining[] = [];

    for (let idx = start; idx < end; idx++) {
        training.push({
            projectid,
            id : 'id' + idx,
            textdata : 'sample text ' + idx,
            label : 'sample label ' + (idx % 7),
        });
    }

    return new Promise((resolve) => resolve(training));
}

export function storeNLCClassifier(
    credentials: TrainingTypes.BluemixCredentials,
    userid: string, classid: string, projectid: string,
    classifier: TrainingTypes.NLCClassifier,
): Promise<TrainingTypes.NLCClassifier>
{
    return new Promise((resolve) => resolve(DbObjects.createNLCClassifier(
        classifier, credentials,
        userid, classid, projectid,
    )));
}

export function getNLCClassifiers()
{
    return new Promise((resolve) => resolve([]));
}

export function deleteNLCClassifier()
{
    return new Promise((resolve) => resolve());
}

export function storeOrUpdateScratchKey()
{
    return new Promise((resolve) => resolve());
}
