// external dependencies
import * as fs from 'fs';
import * as request from 'request-promise';
import * as httpStatus from 'http-status';
import * as uuid from 'uuid/v1';
// local dependencies
import * as store from '../db/store';
import * as DbObjects from '../db/db-types';
import * as TrainingObjects from './training-types';
import * as downloadAndZip from '../utils/downloadAndZip';
import * as notifications from '../notifications/slack';
import loggerSetup from '../utils/logger';

const log = loggerSetup();




export async function trainClassifier(
    project: DbObjects.Project,
): Promise<TrainingObjects.VisualClassifier>
{
    const training = await getTraining(project);

    try {
        const existingClassifiers = await store.getImageClassifiers(project.id);
        for (const existingClassifier of existingClassifiers) {
            await deleteClassifier(existingClassifier);
        }

        const credentials = await store.getBluemixCredentials(project.classid, 'visrec');
        const classifier = await createClassifier(project, credentials, training);

        return classifier;
    }
    finally {
        deleteTrainingFiles(training);
    }
}





async function createClassifier(
    project: DbObjects.Project,
    credentialsPool: TrainingObjects.BluemixCredentials[],
    training: object,
): Promise<TrainingObjects.VisualClassifier>
{
    let classifier: TrainingObjects.VisualClassifier;

    for (const credentials of credentialsPool) {
        try {
            const url = credentials.url + '/v3/classifiers';
            classifier = await submitTrainingToVisualRecognition(project, credentials, url, training);

            await store.storeImageClassifier(credentials, project, classifier);

            await store.storeOrUpdateScratchKey(project, credentials, classifier.classifierid);

            return classifier;
        }
        catch (err) {
            // If we couldn't create a classifier because we've used up the
            //  number of classifiers allowed with these creds, then swallow
            //  the error so we can try the next set of creds in the pool
            // Otherwise - rethrow it so we can bug out.
            if (!err.error || !err.error.error ||
                err.error.error.indexOf('this plan instance can have only') === -1 ||
                err.error.error.indexOf('already exist') === -1)
            {
                throw err;
            }
        }
    }

    // if we're here, it means we don't have room for any new classifiers
    //  with the available credentials
    throw new Error('Your class already has created their maximum allowed number of models');
}




/**
 * Updates the provided set of image classifiers with the current status from
 *  Bluemix.
 *
 * @param classid - the tenant that the user is a member of
 * @param classifiers - set of classifiers to get status info for
 *
 * @returns the same set of classifiers, with the status
 *  properties set using responses from the Bluemix REST API
 */
export function getClassifierStatuses(
    classid: string,
    classifiers: TrainingObjects.VisualClassifier[],
): Promise<TrainingObjects.VisualClassifier[]>
{
    const credentialsCacheById: any = {};

    return Promise.all(
        classifiers.map(async (classifier) => {
            if (classifier.credentialsid in credentialsCacheById === false) {
                const creds = await store.getBluemixCredentialsById(classifier.credentialsid);
                credentialsCacheById[classifier.credentialsid] = creds;
            }
            return getStatus(credentialsCacheById[classifier.credentialsid], classifier);
        }),
    );
}


export function getStatus(
    credentials: TrainingObjects.BluemixCredentials,
    classifier: TrainingObjects.VisualClassifier,
): PromiseLike<TrainingObjects.VisualClassifier>
{
    const req = {
        qs : {
            version : '2016-05-20',
            api_key : credentials.username + credentials.password,
        },
        headers : {
            'user-agent' : 'machinelearningforkids',
        },
        json : true,
        gzip : true,
    };
    return request.get(classifier.url, req)
        .then((body) => {
            classifier.status = body.status;
            return classifier;
        })
        .catch((err) => {
            log.error({ err }, 'Failed to get status');
            classifier.status = 'Non Existent';
            return classifier;
        });
}





/**
 * Confirms that the provided URLs should be usable by the Vision Recognition service.
 */
function validateRequest(urls: string[]): void {
    if (urls.length < 10) {
        throw new Error('Not enough images to train the classifier');
    }
    if (urls.length > 10000) {
        throw new Error('Number of images exceeds maximum (10000)');
    }
}



async function getTraining(project: DbObjects.Project): Promise<object> {
    const counts = await store.countTrainingByLabel('images', project.id);

    const examples = {
    };

    for (const label of project.labels) {
        const training = await store.getImageTrainingByLabel(project.id, label, {
            start : 0, limit : counts[label],
        });

        const trainingUrls = training.map((trainingitem) => trainingitem.imageurl);
        validateRequest(trainingUrls);

        const trainingZip = await downloadAndZip.run(trainingUrls);
        examples[label] = trainingZip;
    }

    return examples;
}



function deleteTrainingFiles(training) {
    const trainingKeys = Object.keys(training);
    for (const trainingKey of trainingKeys) {
        if (trainingKey !== 'name') {
            fs.unlink(training[trainingKey], (err) => {
                if (err) {
                    log.error({ err }, 'Failed to delete training file');
                }
            });
        }
    }
}





/**
 * Deletes an image classifier.
 *  This deletes both the classifier from Bluemix, and the record of it
 *  stored in the app's database.
 */
export async function deleteClassifier(classifier: TrainingObjects.VisualClassifier)
{
    try {
        const credentials = await store.getBluemixCredentialsById(classifier.credentialsid);
        await deleteClassifierFromBluemix(credentials, classifier.classifierid);
    }
    catch (err) {
        log.error({ err, classifier }, 'Unable to delete image classifier');
    }

    await store.deleteImageClassifier(classifier.id);
    await store.resetExpiredScratchKey(classifier.classifierid, 'images');
}



async function deleteClassifierFromBluemix(
    credentials: TrainingObjects.BluemixCredentials,
    classifierId: string,
): Promise<void>
{
    const req = {
        qs : {
            version : '2016-05-20',
            api_key : credentials.username + credentials.password,
        },
        headers : {
            'user-agent' : 'machinelearningforkids',
        },
        timeout : 120000,
    };

    try {
        const url = credentials.url + '/v3/classifiers/' + classifierId;
        await request.delete(url, req);
    }
    catch (err) {
        if (err.statusCode === httpStatus.NOT_FOUND) {
            log.debug({ classifierId }, 'Attempted to delete non-existent classifier');
            return;
        }
        throw err;
    }
}






export async function testClassifierFile(
    credentials: TrainingObjects.BluemixCredentials,
    classifierid: string,
    projectid: string,
    imagefilepath: string,
): Promise<TrainingObjects.Classification[]>
{
    const req = {
        qs : {
            version : '2016-05-20',
            api_key : credentials.username + credentials.password,
        },
        headers : {
            'user-agent' : 'machinelearningforkids',
        },
        formData : {
            images_file : fs.createReadStream(imagefilepath),
            parameters : {
                value : JSON.stringify({
                    owners : 'me',
                    classifier_ids : classifierid,
                    threshold : 0.0,
                }),
                options : {
                    contentType : 'application/json',
                },
            },
        },
        json : true,
    };

    const body = await request.post(credentials.url + '/v3/classify', req);
    if (body.images && body.images.length > 0) {
        return body.images[0].classifiers[0].classes.map((item) => {
            return { class_name : item.class, confidence : Math.round(item.score * 100) };
        }).sort(sortByConfidence);
    }
    else {
        log.error({ body }, 'Image was not classifiable');
        return [];
    }
}

export async function testClassifierURL(
    credentials: TrainingObjects.BluemixCredentials,
    classifierid: string,
    projectid: string,
    imageurl: string,
): Promise<TrainingObjects.Classification[]>
{
    const req = {
        qs : {
            version : '2016-05-20',
            api_key : credentials.username + credentials.password,
            url : imageurl,
            owners : 'me',
            classifier_ids : classifierid,
            threshold : 0.0,
        },
        headers : {
            'user-agent' : 'machinelearningforkids',
        },
        json : true,
    };

    const body = await request.get(credentials.url + '/v3/classify', req);
    return body.images[0].classifiers[0].classes.map((item) => {
        return { class_name : item.class, confidence : Math.round(item.score * 100) };
    }).sort(sortByConfidence);
}



function sortByConfidence(item1: TrainingObjects.Classification, item2: TrainingObjects.Classification): number {
    return item2.confidence - item1.confidence;
}



async function submitTrainingToVisualRecognition(
    project: DbObjects.Project,
    credentials: TrainingObjects.BluemixCredentials,
    url: string,
    training: object,
): Promise<TrainingObjects.VisualClassifier>
{
    const trainingData = {
        name : project.name,
    };
    for (const label of project.labels) {
        trainingData[label + '_positive_examples'] = fs.createReadStream(training[label]);
    }

    const req = {
        qs : {
            version : '2016-05-20',
            api_key : credentials.username + credentials.password,
        },
        headers : {
            'user-agent' : 'machinelearningforkids',
        },
        formData : trainingData,
        json : true,
        timeout : 180000,
    };

    try {
        const body = await request.post(url, req);

        // determine when the classifier should be deleted
        const tenantPolicy = await store.getClassTenant(project.classid);
        const modelAutoExpiryTime = new Date(body.created);
        modelAutoExpiryTime.setHours(modelAutoExpiryTime.getHours() +
                                     tenantPolicy.imageClassifierExpiry);

        return {
            id : uuid(),
            name : body.name,
            classifierid : body.classifier_id,
            created : new Date(body.created),
            expiry : modelAutoExpiryTime,
            credentialsid : credentials.id,
            status : body.status ? body.status : 'training',
            url : credentials.url + '/v3/classifiers/' + body.classifier_id,
        };
    }
    catch (err) {
        log.error({ url, req, err }, 'Failed to train classifier');
        notifications.notify('Failed to train image classifier : ' + err.message);

        // The full error object will include the classifier request with the
        //  URL and credentials we used for it. So we don't want to return
        //  that - after logging, we create a new exception to throw, with
        //  just the bits that should be safe to share.
        const trainingError: any = new Error('Failed to train classifier');
        trainingError.error = err.error;
        trainingError.statusCode = err.statusCode;

        throw trainingError;
    }
}





export async function getImageClassifiers(
    credentials: TrainingObjects.BluemixCredentials,
): Promise<TrainingObjects.ClassifierSummary[]>
{
    const req = {
        qs : {
            version : '2016-05-20',
            api_key : credentials.username + credentials.password,
        },
        headers : {
            'user-agent' : 'machinelearningforkids',
        },
        json : true,
    };

    const body = await request.get(credentials.url + '/v3/classifiers', req);
    return body.classifiers.map((classifierinfo) => {
        return {
            id : classifierinfo.classifier_id,
            name : classifierinfo.name,
            type : 'visrec',
            credentials,
        };
    });
}






export async function cleanupExpiredClassifiers(): Promise<void[]>
{
    log.info('Cleaning up expired Visual Recognition classifiers');

    const expired: TrainingObjects.VisualClassifier[] = await store.getExpiredImageClassifiers();
    return Promise.all(expired.map(deleteClassifier));
}
