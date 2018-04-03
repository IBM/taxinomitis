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


export const ERROR_MESSAGES = {
    UNKNOWN : 'Failed to train machine learning model',
    INSUFFICIENT_API_KEYS : 'Your class already has created their maximum allowed number of models. ' +
                            'Please let your teacher or group leader know that ' +
                            'their "Watson Visual Recognition API keys have no more classifiers available"',
    API_KEY_RATE_LIMIT : 'Your class is making too many requests to create machine learning models ' +
                         'at too fast a rate. ' +
                         'Please stop now and let your teacher or group leader know that ' +
                         '"the Watson Visual Recognition service is currently rate limiting their API key"',
};




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
    training: { [label: string]: string },
): Promise<TrainingObjects.VisualClassifier>
{
    let classifier: TrainingObjects.VisualClassifier;

    // Unless we see a different error, if this doesn't work, the reason
    //  will be that we don't have room for any new classifiers with the
    //  available credentials
    let finalError = ERROR_MESSAGES.INSUFFICIENT_API_KEYS;


    for (const credentials of credentialsPool) {
        try {
            const url = credentials.url + '/v3/classifiers';
            classifier = await submitTrainingToVisualRecognition(project, credentials, url, training);

            await store.storeImageClassifier(credentials, project, classifier);

            await store.storeOrUpdateScratchKey(project, credentials, classifier.classifierid);

            return classifier;
        }
        catch (err) {
            if (err.error &&
                err.error.error &&
                err.error.error.description &&
                err.error.error.description.indexOf('this plan instance can have only') >= 0 &&
                err.error.error.description.indexOf('already exist') >= 0)
            {
                // We couldn't create a classifier because we've used up the
                //  number of custom classifiers allowed with these creds.
                // So we'll swallow the error so we can try the next set of
                //  creds in the pool
                finalError = ERROR_MESSAGES.INSUFFICIENT_API_KEYS;
            }
            else if (err.error &&
                err.error.statusInfo &&
                err.error.statusInfo === 'Key is over transaction limit')
            {
                // The class is probably using a Lite plan API key and between
                //  them are hammering the Train Model button too fast
                // So we'll swallow the error so we can try the next set of
                //  creds in the pool
                finalError = ERROR_MESSAGES.API_KEY_RATE_LIMIT;
            }
            else {
                // Otherwise - rethrow it so we can bug out.
                log.error({ err, project }, 'Unhandled Visual Recognition exception');

                // This shouldn't happen.
                // It probably needs more immediate attention, so notify the Slack bot
                notifications.notify('Unexpected failure to train image classifier' +
                                     ' for project : ' + project.id +
                                     ' in class : ' + project.classid + ' : ' +
                                     err.message);

                throw err;
            }
        }
    }


    //
    // If we're here, either:
    //  1) there were no credentials, so we never entered the for loop above, so we use
    //      the default finalError
    //  2) every attempt to train a model failed, but with an exception that was swallowed
    //      above, with finalError being set with the reason
    //

    // This is a user-error, not indicative of an MLforKids failure.
    //  But notify the Slack bot anyway, as for now it is useful to be able to
    //  keep track of how frequently users are running into these resource limits.
    notifications.notify('Failed to train image classifier' +
                         ' for project : ' + project.id +
                         ' in class : ' + project.classid +
                         ' because:\n' + finalError);

    throw new Error(finalError);
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
 * Confirms that the provided locations should be usable by the Vision Recognition service.
 */
function validateRequest(locations: any[]): void {
    if (locations.length < 10) {
        throw new Error('Not enough images to train the classifier');
    }
    if (locations.length > 10000) {
        throw new Error('Number of images exceeds maximum (10000)');
    }
}



async function getTraining(project: DbObjects.Project): Promise<{ [label: string]: string }> {
    const counts = await store.countTrainingByLabel(project);

    const examples: { [label: string]: string } = {};

    for (const label of project.labels) {
        const training = await store.getImageTrainingByLabel(project.id, label, {
            start : 0, limit : counts[label],
        });

        const trainingLocations = training.map((trainingitem) => {
            if (trainingitem.isstored) {
                const fromStorage: downloadAndZip.ImageDownload = {
                    type : 'retrieve',
                    spec : {
                        imageid : trainingitem.id,
                        projectid : project.id,
                        userid : project.userid,
                        classid : project.classid,
                    },
                };
                return fromStorage;
            }
            else {
                const fromWeb: downloadAndZip.ImageDownload = {
                    type : 'download',
                    url: trainingitem.imageurl,
                };
                return fromWeb;
            }
        });
        validateRequest(trainingLocations);

        const trainingZip = await downloadAndZip.run(trainingLocations);
        examples[label] = trainingZip;
    }

    return examples;
}



function deleteTrainingFiles(training: { [label: string]: string }): void {
    const trainingKeys = Object.keys(training);
    for (const trainingKey of trainingKeys) {
        if (trainingKey !== 'name') {
            fs.unlink(training[trainingKey], (err?: Error) => {
                if (err) {
                    log.error({ err, trainingKey, path : training[trainingKey] }, 'Failed to delete training file');
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
    const req: VisualRecogApiRequestPayloadTestFileItem = {
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
                    owners : [ 'me' ],
                    classifier_ids : [ classifierid ],
                    threshold : 0.0,
                }),
                options : {
                    contentType : 'application/json',
                },
            },
        },
        json : true,
    };

    const body: VisualRecogApiResponsePayloadClassifyFile = await request.post(credentials.url + '/v3/classify', req);
    if (body.images &&
        body.images.length > 0 &&
        body.images[0].classifiers &&
        body.images[0].classifiers.length > 0 &&
        body.images[0].classifiers[0].classes)
    {
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
    const req: VisualRecogApiRequestPayloadTestUrlItem = {
        qs : {
            version : '2016-05-20',
            api_key : credentials.username + credentials.password,
            url : imageurl,
            classifier_ids : classifierid,
            threshold : 0.0,
        },
        headers : {
            'user-agent' : 'machinelearningforkids',
        },
        json : true,
    };

    const body: VisualRecogApiResponsePayloadClassification = await request.get(credentials.url + '/v3/classify', req);
    if (body.images &&
        body.images.length > 0 &&
        body.images[0].classifiers &&
        body.images[0].classifiers.length > 0 &&
        body.images[0].classifiers[0].classes)
    {
        return body.images[0].classifiers[0].classes.map((item) => {
            return { class_name : item.class, confidence : Math.round(item.score * 100) };
        }).sort(sortByConfidence);
    }
    else {
        log.error({ body }, 'Image was not classifiable');
        return [];
    }
}



function sortByConfidence(item1: TrainingObjects.Classification, item2: TrainingObjects.Classification): number {
    return item2.confidence - item1.confidence;
}




async function submitTrainingToVisualRecognition(
    project: DbObjects.Project,
    credentials: TrainingObjects.BluemixCredentials,
    url: string,
    training: { [label: string]: string },
): Promise<TrainingObjects.VisualClassifier>
{
    const trainingData: { [label: string]: fs.ReadStream | string } = {
        name : project.name,
    };
    for (const label of project.labels) {
        trainingData[label + '_positive_examples'] = fs.createReadStream(training[label]);
    }

    const req: VisualRecogApiRequestPayloadClassifierItem = {
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
        log.error({ url, req, err }, ERROR_MESSAGES.UNKNOWN);

        // The full error object will include the classifier request with the
        //  URL and credentials we used for it. So we don't want to return
        //  that - after logging, we create a new exception to throw, with
        //  just the bits that should be safe to share.
        const trainingError: any = new Error(ERROR_MESSAGES.UNKNOWN);
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

    const body: VisualRecogApiResponsePayloadClassifiers = await request.get(credentials.url + '/v3/classifiers', req);
    return body.classifiers.map((classifierinfo) => {
        const summary: TrainingObjects.ClassifierSummary = {
            id : classifierinfo.classifier_id,
            name : classifierinfo.name,
            type : 'visrec',
            credentials,
        };
        return summary;
    });
}






export async function cleanupExpiredClassifiers(): Promise<void[]>
{
    log.info('Cleaning up expired Visual Recognition classifiers');

    const expired: TrainingObjects.VisualClassifier[] = await store.getExpiredImageClassifiers();
    return Promise.all(expired.map(deleteClassifier));
}



export interface VisualRecogApiResponsePayloadClassifiers {
    readonly classifiers: VisualRecogApiResponsePayloadClassifier[];
}

export interface VisualRecogApiResponsePayloadClassifier {
    readonly classifier_id: string;
    readonly name: string;
    readonly owner: string;
    readonly status: string;
    readonly created: string;
    readonly classes: Array<{ class: string }>;
}

export interface VisualRecogApiRequestPayloadClassifierItem {
    readonly qs: {
        readonly version: '2016-05-20';
        readonly api_key: string;
    };
    readonly headers: {
        readonly 'user-agent': string;
    };
    readonly formData: TrainingData;
    readonly json: true;
    readonly timeout: number;
}

export interface VisualRecogApiRequestPayloadTestUrlItem {
    readonly qs: {
        readonly version: '2016-05-20';
        readonly api_key: string;
        readonly url: string;
        readonly classifier_ids: string;
        readonly threshold: number;
    };
    readonly headers: {
        readonly 'user-agent': string;
    };
    readonly json: true;
}

export interface VisualRecogApiRequestPayloadTestFileItem {
    readonly qs: {
        readonly version: '2016-05-20';
        readonly api_key: string;
    };
    readonly headers: {
        readonly 'user-agent': string;
    };
    readonly formData: {
        readonly images_file: fs.ReadStream,
        readonly parameters: {
            readonly value: string;
            readonly options: {
                readonly contentType: 'application/json';
            };
        };
    };
    readonly json: true;
}




interface TrainingData {
    [label: string]: fs.ReadStream | string;
}

export interface VisualRecogApiResponsePayloadClassification {
    readonly images: Array<{
        readonly classifiers: Array<{
            readonly classes: Array<{
                readonly class: string;
                readonly score: number;
            }>;
            readonly classifier_id: string;
            readonly name: string;
        }>;
        readonly resolved_url: string;
        readonly source_url: string;
    }>;
    readonly images_processed: number;
}

export interface VisualRecogApiResponsePayloadClassifyFile {
    readonly images: Array<{
        readonly classifiers: Array<{
            readonly classes: Array<{
                readonly class: string;
                readonly score: number;
            }>;
            readonly classifier_id: string;
            readonly name: string;
        }>;
        readonly image: string;
    }>;
    readonly images_processed: number;
}

