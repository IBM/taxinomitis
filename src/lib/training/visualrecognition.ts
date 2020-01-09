// external dependencies
import * as fs from 'fs';
import * as request from 'request-promise';
import * as httpStatus from 'http-status';
import * as uuid from 'uuid/v1';
// local dependencies
import * as store from '../db/store';
import * as DbObjects from '../db/db-types';
import * as TrainingObjects from './training-types';
import * as iam from '../iam';
import * as wikimedia from '../utils/wikimedia';
import * as downloadAndZip from '../utils/downloadAndZip';
import * as constants from '../utils/constants';
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
    NO_MODEL : 'Your machine learning model could not be found. Has it been deleted?',
};


/** The size of the largest file that we are willing to download for putting into a training zip. */
const MAX_IMAGE_FILE_SIZE_BYTES = 8388608;
export function getMaxImageFileSize(): number {
    return MAX_IMAGE_FILE_SIZE_BYTES;
}

//
// These dimensions are chosen because it's what the Visual Recognition service uses.
//  It will skew the aspect ratio of images that aren't already square - but that's
//  what the Visual Recognition service will do anyway.
// The benefit of doing the resizing locally (rather than uploading the images in their
//  original size and leaving the Visual Recognition service to resize it to these
//  dimensions) is that it dramatically reduces the disk overhead for running the
//  site. (Albeit at a increased cost in memory overhead)
//
/** The width that training files are resized to before putting into a training zip. */
export const IMAGE_WIDTH_PIXELS = 224;
/** The height that training files are resized to before putting into a training zip. */
export const IMAGE_HEIGHT_PIXELS = 224;



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
    let classifier: TrainingObjects.VisualClassifier | undefined;


    const tenantPolicy = await store.getClassTenant(project.classid);


    // Unless we see a different error, if this doesn't work, the reason
    //  will be that we don't have room for any new classifiers with the
    //  available credentials
    let finalError = ERROR_MESSAGES.INSUFFICIENT_API_KEYS;


    for (const credentials of credentialsPool) {
        try {
            const url = credentials.url + '/v3/classifiers';
            classifier = await submitTrainingToVisualRecognition(project, credentials, url, training, tenantPolicy);

            log.info({ classifier }, 'Created new classifier to store');

            await store.storeImageClassifier(credentials, project, classifier);

            await store.storeOrUpdateScratchKey(project, credentials, classifier.classifierid, classifier.created);

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
            else if ((err.error && err.error.code === 401 && err.error.error === 'Unauthorized') ||
                     (err.error && err.error.code === 403 && err.error.error === 'Forbidden'))
            {
                // there is a problem with their API key
                log.warn({ err, project, credentials : credentials.id },
                         'Credentials rejected');
                throw err;
            }
            else {
                // Otherwise - rethrow it so we can bug out.
                log.error({
                    err, project, classifier,
                    credentials : credentials.id,
                }, 'Unhandled Visual Recognition exception');

                // This shouldn't happen.
                // It probably needs more immediate attention, so notify the Slack bot
                let detail = '';
                if (err.error &&
                    err.error.error &&
                    err.error.error.description)
                {
                    detail = '\n' + err.error.error.description;
                }
                else if (err.error && err.error.error) {
                    detail = '\n' + err.error.error;
                }
                notifications.notify('Unexpected failure to train image classifier' +
                                     ' for project : ' + project.id +
                                     ' in class : ' + project.classid + ' : ' +
                                     err.message + detail,
                                     notifications.SLACK_CHANNELS.TRAINING_ERRORS);

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
                         ' because:\n' + finalError,
                         notifications.SLACK_CHANNELS.TRAINING_ERRORS);

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


export async function getStatus(
    credentials: TrainingObjects.BluemixCredentials,
    classifier: TrainingObjects.VisualClassifier,
): Promise<TrainingObjects.VisualClassifier>
{
    let req: NewVisRecRequest | LegacyVisRecRequest;
    try {
        req = await createBaseRequest(credentials);
    }
    catch (err) {
        log.error({ err }, 'Failed to get auth token for querying model');
        classifier.status = 'Non Existent';
        return classifier;
    }

    // GETs don't need as long a timeout as POSTs
    req.timeout = 30000;
    return request.get(classifier.url, req)
        .then((body) => {
            classifier.status = body.status;
            return classifier;
        })
        .catch((err) => {
            log.warn({ err }, 'Failed to get status');
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

    const trainingDataToFetch: { [label: string]: downloadAndZip.ImageDownload[] } = {};

    for (const label of project.labels) {

        if (label in counts && counts[label] > 0) {

            const training = await store.getImageTrainingByLabel(project.id, label, {
                start : 0, limit : counts[label],
            });

            const trainingLocations: downloadAndZip.ImageDownload[] = [];

            for (const trainingitem of training) {
                if (trainingitem.isstored) {
                    const fromStorage: downloadAndZip.ImageDownload = {
                        type : 'retrieve',
                        spec : {
                            objectid : trainingitem.id,
                            projectid : project.id,
                            userid : trainingitem.userid ? trainingitem.userid : project.userid,
                            classid : project.classid,
                        },
                    };
                    trainingLocations.push(fromStorage);
                }
                else {
                    const fromWeb = await getImageDownloadSpec(trainingitem.id, trainingitem.imageurl);
                    trainingLocations.push(fromWeb);
                }
            }

            validateRequest(trainingLocations);

            trainingDataToFetch[label] = trainingLocations;
        }
    }


    // create zip files for each of the training labels
    const zipPromises = Object.keys(trainingDataToFetch).map((label) => {
        return downloadAndZip.run(trainingDataToFetch[label])
            .then((trainingZip) => {
                examples[label] = trainingZip;
            });
    });
    await Promise.all(zipPromises);


    return examples;
}


async function getImageDownloadSpec(imageid: string, imageurl: string): Promise<downloadAndZip.ImageDownload> {
    if (wikimedia.isWikimedia(imageurl)) {
        try {
            const thumb = await wikimedia.getThumbnail(imageurl, 400);
            return {
                type : 'download',
                imageid,
                url : thumb,
            };
        }
        catch (err) {
            log.error({ err, imageid, imageurl }, 'getImageDownloadSpec fail');
            return {
                type : 'download',
                imageid,
                url : imageurl,
            };
        }
    }
    else {
        const fromWeb: downloadAndZip.DownloadFromWeb = {
            type : 'download',
            imageid,
            url : imageurl,
        };
        return Promise.resolve(fromWeb);
    }
}



function deleteTrainingFiles(training: { [label: string]: string }): void {
    const trainingKeys = Object.keys(training);
    for (const trainingKey of trainingKeys) {
        if (trainingKey !== 'name') {
            fs.unlink(training[trainingKey], (err?: Error | null) => {
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

        // in case it reappears later...
        deleteClassifierFromBluemixAgain(credentials, classifier.classifierid);
    }
    catch (err) {
        log.error({ err, classifier }, 'Unable to delete image classifier');
    }

    await store.deleteImageClassifier(classifier.id);
    await store.resetExpiredScratchKey(classifier.classifierid, 'images');

}



/**
 * A horrid kludgey workaround for some frustrating behaviour in the Visual
 *  Recognition API.
 *
 * When the service gets busy, this scenario starts becoming common:
 *
 *  1) user starts training classifier (attempt-1)
 *  2) user cancels the training by deleting the attempt-1 classifier
 *  3) cancelled/deleted classifier disappears from their list of classifiers
 *  4) this lets them start training a new classifier (attempt-2)
 *  5) a few minutes later, the attempt-1 classifier has finished training and
 *       appears in their list of classifiers as ready
 *
 * The user now has two classifiers: attempt-1 and attempt-2. Which is more than
 *  a free tier API key is allowed. The first attempt-1 classifier is divorced /
 *  orphaned from Machine Learning for Kids. And even if they delete the second
 *  attempt-2 classifier, they still are at their limit so they can't train any
 *  new classifiers.
 *
 * This results in an email to me asking why they're getting "You're not allowed
 *  to create any more classifiers" when they think they don't have any.
 *
 * So...
 *
 * When we cancel the training of a classifier, we'll wait fifteen minutes (assuming
 *  that most classifiers will complete within this time). And then we'll delete
 *  it again, so if it's reappeared, we'll be able to clean up before the user
 *  notices a problem.
 *
 * If the original cancellation/deletion works, this will fail with a 404-not-found
 *  so we need to swallow those, as it indicates things were actually working.
 *
 * (We could make this the responsibility of the pendingjobs class, but that only
 *  runs every 3 hours, and when this is a problem it normally inconveniences
 *  users within 3 hours. The risk of doing this is that if we restart before the
 *  15-minute timer fires, then we'll never do this cleanup - whereas pendingjobs
 *  does clear the outstanding work queue on restart).
 *
 * @param credentials
 * @param classifier
 * @param classifierid
 */
function deleteClassifierFromBluemixAgain(
    credentials: TrainingObjects.BluemixCredentials,
    classifierId: string,
): void
{
    setTimeout(() => {
        deleteClassifierFromBluemix(credentials, classifierId)
            .catch((err) => {
                log.error({ err }, 'Failed to delete Visual Recognition classifier');
                notifications.notify('Failed to delete Visual Recognition classifier ' +
                                     'after second attempt. \n' +
                                     'Class : ' + credentials.classid + '\n' +
                                     'Model : ' + classifierId + '\n' +
                                     'Creds : ' + credentials.id,
                                     notifications.SLACK_CHANNELS.TRAINING_ERRORS);
            });
    }, constants.FIFTEEN_MINUTES);
}




export async function deleteClassifierFromBluemix(
    credentials: TrainingObjects.BluemixCredentials,
    classifierId: string,
): Promise<void>
{
    const req = await createBaseRequest(credentials);

    try {
        const url = credentials.url + '/v3/classifiers/' + encodeURIComponent(classifierId);
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
    classifierid: string, classifierTimestamp: Date,
    projectid: string,
    imagefilepath: string,
): Promise<TrainingObjects.Classification[]>
{
    const basereq = await createBaseRequest(credentials);
    const testreq: TestFileRequest = {
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
    };
    const req: NewTestFileRequest | LegacyTestFileRequest = { ...basereq, ...testreq };
    const url = credentials.url + '/v3/classify';

    try {
        const body: VisualRecogApiResponsePayloadClassifyFile = await request.post(url, req);
        if (body.images &&
            body.images.length > 0 &&
            body.images[0].classifiers &&
            body.images[0].classifiers.length > 0 &&
            body.images[0].classifiers[0].classes)
        {
            return body.images[0].classifiers[0].classes.map((item) => {
                return { class_name : item.class, confidence : Math.round(item.score * 100), classifierTimestamp };
            }).sort(sortByConfidence);
        }
        else {
            log.error({ body }, 'Image was not classifiable');
            return [];
        }
    }
    catch (err) {
        // recognise some common errors and explain them in a more helpful way
        //
        //  otherwise, just re-throw as-is
        if (err.error &&
            err.error.images && Array.isArray(err.error.images) && err.error.images.length === 1 &&
            err.error.images[0].error &&
            err.error.images[0].error.code && err.error.images[0].error.description &&
            typeof err.error.images[0].error.description === 'string')
        {
            const errorInfo = err.error.images[0].error;

            if (classifierNotFoundError(errorInfo))
            {
                const externalError: any = new Error(ERROR_MESSAGES.NO_MODEL);
                externalError.statusCode = 400;
                throw externalError;
            }
            else if (errorInfo.code === 400 &&
                     errorInfo.description === 'Invalid/corrupted image data. ' +
                                               'Supported image file formats are GIF, JPEG, PNG, and TIFF. ' +
                                               'Supported compression format is ZIP.')
            {
                const externalError: any = new Error('Invalid image data provided. ' +
                                                     'Remember, only jpg and png images are supported.');
                externalError.statusCode = 400;
                throw externalError;
            }
            else if (errorInfo.code === 400 &&
                     errorInfo.description.startsWith('Image resolution is smaller than the minimum limit'))
            {
                const externalError: any = new Error('Image is too small to be recognized');
                externalError.statusCode = 400;
                throw externalError;
            }
            else if (errorInfo.code === 500 &&
                     errorInfo.description === 'Internal error performing classification')
            {
                const externalError: any = new Error('The IBM Watson Visual Recognition service ' +
                                                     'was unable to classify your image, and reported ' +
                                                     'an unexpected internal error. ');
                externalError.statusCode = 500;
                throw externalError;
            }
        }
        else if (err.error && err.error.error &&
                 err.error.error.code === 400 &&
                 err.error.error.description === 'No images were specified.')
        {
            const externalError: any = new Error('Missing data');
            externalError.statusCode = 400;
            throw externalError;
        }

        throw err;
    }
}



export async function testClassifierURL(
    credentials: TrainingObjects.BluemixCredentials,
    classifierid: string, classifierTimestamp: Date,
    projectid: string,
    imageurl: string,
): Promise<TrainingObjects.Classification[]>
{
    const basereq = await createBaseRequest(credentials);
    const testreq: TestUrlRequest = {
        qs : {
            url : imageurl,
            classifier_ids : classifierid,
            threshold : 0.0,
        },
    };

    const req = {
        qs : { ...basereq.qs, ...testreq.qs },
        headers : basereq.headers,
        json : basereq.json,
        gzip : basereq.gzip,
        timeout : basereq.timeout,
    };

    try {
        const url = credentials.url + '/v3/classify';
        const body: VisualRecogApiResponsePayloadClassification = await request.get(url, req);
        if (body.images &&
            body.images.length > 0 &&
            body.images[0].classifiers &&
            body.images[0].classifiers.length > 0 &&
            body.images[0].classifiers[0].classes)
        {
            return body.images[0].classifiers[0].classes.map((item) => {
                return { class_name : item.class, confidence : Math.round(item.score * 100), classifierTimestamp };
            }).sort(sortByConfidence);
        }
        else {
            log.error({ body }, 'Image was not classifiable');
            return [];
        }
    }
    catch (err) {
        // recognise some common errors and explain them in a more helpful way
        //
        //  otherwise, just re-throw as-is
        if (err.error &&
            err.error.images && Array.isArray(err.error.images) && err.error.images.length === 1 &&
            err.error.images[0].error &&
            err.error.images[0].error.code && err.error.images[0].error.description &&
            typeof err.error.images[0].error.description === 'string')
        {
            const errorInfo = err.error.images[0].error;
            if (errorInfo.code === 400 &&
                errorInfo.description.startsWith('Invalid/corrupted image data. ' +
                                                 'Supported image file formats are GIF, JPEG, PNG, and TIFF'))
            {
                const externalError: any = new Error('A usable test image could not be found at that address. ' +
                                                     'Remember, only jpg and png images are supported.');
                externalError.statusCode = 400;
                throw externalError;
            }
            else if (errorInfo.code === 400 &&
                     (errorInfo.description === 'URL Fetcher error: Could not fetch URL: ' +
                                                'Unable to resolve host name' ||
                      errorInfo.description === 'URL Fetcher error: Could not fetch URL: ' +
                                                'Timeout exceeded when loading resource'))
            {
                const externalError: any = new Error('Web address could not be contacted. ' +
                                                     'Please enter the web address for a picture that you want to ' +
                                                     'test your machine learning model on');
                externalError.statusCode = 400;
                throw externalError;
            }
            else if (errorInfo.code === 400 &&
                     (errorInfo.description === 'URL Fetcher error: Could not fetch URL: ' +
                                                'Invalid URL specified'))
            {
                const externalError: any = new Error('Invalid URL. ' +
                                                     'Please enter the web address for a picture that you want to ' +
                                                     'test your machine learning model on');
                externalError.statusCode = 400;
                throw externalError;
            }
            else if (classifierNotFoundError(errorInfo))
            {
                const externalError: any = new Error(ERROR_MESSAGES.NO_MODEL);
                externalError.statusCode = 400;
                throw externalError;
            }
            else if (errorInfo.code === 400 &&
                     errorInfo.description.startsWith('Image resolution is smaller than the minimum limit'))
            {
                const externalError: any = new Error('Image is too small to be recognized');
                externalError.statusCode = 400;
                throw externalError;
            }
            else if (errorInfo.code === 400 &&
                     errorInfo.description === 'URL Fetcher error: Could not fetch URL: ' +
                                               'Access forbidden by target server')
            {
                const externalError: any = new Error('Access forbidden. ' +
                                                     'Web server at that address would not allow the ' +
                                                     'image to be downloaded.');
                externalError.statusCode = 400;
                throw externalError;
            }
        }

        throw err;
    }
}



function classifierNotFoundError(errorInfo: any): boolean {
    return errorInfo &&
           errorInfo.code &&
           errorInfo.code === 404 &&
           errorInfo.description &&
           typeof errorInfo.description === 'string' &&
           (errorInfo.description.startsWith('None of the requested classifier ids were found: ') ||
            errorInfo.description === 'No classifiers found');
}


function sortByConfidence(item1: TrainingObjects.Classification, item2: TrainingObjects.Classification): number {
    return item2.confidence - item1.confidence;
}




async function submitTrainingToVisualRecognition(
    project: DbObjects.Project,
    credentials: TrainingObjects.BluemixCredentials,
    url: string,
    training: { [label: string]: string },
    tenantPolicy: DbObjects.ClassTenant,
): Promise<TrainingObjects.VisualClassifier>
{
    const trainingData: { name: string, [label: string]: fs.ReadStream | string } = {
        name : project.name,
    };
    for (const label of project.labels) {
        if (label in training) {
            trainingData[label + '_positive_examples'] = fs.createReadStream(training[label]);
        }
    }

    const basereq = await createBaseRequest(credentials);
    const req: NewTrainingRequest | LegacyTrainingRequest = {
        ...basereq,
        formData : trainingData,
    };

    try {
        const body = await request.post(url, req);

        log.info({ body }, 'Response from creating visual recognition classifier');

        if (body && body.error) {
            log.error({ body }, 'Error payload from Visual Recognition');

            // sometimes Visual Recogition returns an error object
            // with an HTTP-200 response code, because... reasons?
            throw {
                error : body.error,
                statusCode : 500,
            };
        }

        // determine when the classifier should be deleted
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
            url : credentials.url + '/v3/classifiers/' + encodeURIComponent(body.classifier_id),
        };
    }
    catch (err) {
        log.warn({ url, req, project, err }, ERROR_MESSAGES.UNKNOWN);


        // Visual Recognition will sometimes return an HTTP 413 (Request Entity Too Large)
        //  response in the event of an auth problem - because only authorised users can
        //  post large payloads
        // So if we get an HTTP 413, before returning that, we check the credentials
        //  (by using them to fetch a list of classifiers) to see if that might be the
        //  root cause of the error.
        if (err.statusCode === httpStatus.REQUEST_ENTITY_TOO_LARGE) {
            try {
                await getImageClassifiers(credentials);
                // if we get here, the credentials are fine - the request
                //  was legitimately too large, so we'll return that error
                //  below
            }
            catch (credserr) {
                // if we are here, we couldn't use the credentials, so that
                //  was likely the root cause of the training error
                // we'll throw that instead
                const credsCheckError: any = new Error(ERROR_MESSAGES.UNKNOWN);
                credsCheckError.error = credserr.error;
                credsCheckError.statusCode = credserr.statusCode;
                throw credsCheckError;
            }
        }

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
    const req = await createBaseRequest(credentials);
    // GETs don't need as long a timeout as POSTs
    req.timeout = 30000;
    const body: VisualRecogApiResponsePayloadClassifiers = await request.get(credentials.url + '/v3/classifiers', req);

    if (body && body.error) {
        log.error({ body }, 'Unexpected response from Visual Recognition');
        throw {
            error : body.error,
            statusCode : 500,
        };
    }

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




/**
 * An admin user has provided the credentials for a Visual Recognition service instance,
 *  but we don't know which IBM Cloud region the service instance is from. This function
 *  identifies the region (by trying the credentials in all known regions, and returning
 *  the URL for the region that the credentials were not rejected in).
 *
 * @returns url - Promise that resolves to the URL that accepted the credentials
 */
export async function identifyRegion(credentials: TrainingObjects.BluemixCredentials): Promise<string>
{
    if (getType(credentials) === 'legacy') {
        // legacy credentials only ever supported a single region, so
        //  just check what we've been given
        await getImageClassifiers(credentials);
        return credentials.url;
    }
    else {
        const POSSIBLE_URLS = [
            'https://gateway.watsonplatform.net/visual-recognition/api',
            'https://gateway-seo.watsonplatform.net/visual-recognition/api',
        ];

        const testRequest = await createBaseRequest(credentials);
        testRequest.timeout = 10000;

        let lastErr: Error = new Error('Failed to verify credentials');

        for (const url of POSSIBLE_URLS) {
            try {
                log.debug({ url }, 'Testing Visual Recognition credentials');
                await request.get(url + '/v3/classifiers', testRequest);

                // if we're here, the credentials were accepted
                return url;
            }
            catch (err) {
                log.debug({ url, err }, 'Credentials rejected');
                lastErr = err;
            }
        }

        // if we're here, all URLs rejected the credentials
        throw lastErr;
    }
}



export async function cleanupExpiredClassifiers(): Promise<void[]>
{
    log.info('Cleaning up expired Visual Recognition classifiers');

    const expired: TrainingObjects.VisualClassifier[] = await store.getExpiredImageClassifiers();
    return Promise.all(expired.map(deleteClassifier));
}


/**
 * Identifies what type of credentials are provided, so that the right auth
 *  mechanism can be used.
 */
function getType(credentials: TrainingObjects.BluemixCredentials): TrainingObjects.VisualRecCredsType {
    if (credentials.url === 'https://gateway-a.watsonplatform.net/visual-recognition/api') {
        return 'legacy';
    }
    return 'current';
}


async function createBaseRequest(credentials: TrainingObjects.BluemixCredentials)
    : Promise<LegacyVisRecRequest | NewVisRecRequest>
{
    // tslint:disable-next-line:variable-name
    const api_key: string = credentials.username + credentials.password;

    if (getType(credentials) === 'legacy') {
        const req: LegacyVisRecRequest = {
            qs : {
                version: '2016-05-20',
                api_key,
            },
            headers : {
                'user-agent': 'machinelearningforkids',
                'X-Watson-Learning-Opt-Out': 'true',
            },
            json : true,
            gzip : true,
            timeout : 120000,
        };
        return Promise.resolve(req);
    }
    else {
        const authHeader = await iam.getAuthHeader(api_key);

        const req: NewVisRecRequest = {
            qs : {
                version : '2018-03-19',
            },
            headers : {
                'user-agent': 'machinelearningforkids',
                'X-Watson-Learning-Opt-Out': 'true',
                'Authorization': authHeader,
            },
            json : true,
            gzip : true,
            timeout : 120000,
        };
        return req;
    }
}






interface VisRecRequestBase {
    readonly qs: {
        readonly version: string;
    };
    readonly headers: {
        readonly 'user-agent': 'machinelearningforkids';
        readonly 'X-Watson-Learning-Opt-Out': 'true';
    };
    readonly json: true;
    readonly gzip: true;
    timeout: number;
}

export interface LegacyVisRecRequest extends VisRecRequestBase {
    readonly qs: {
        readonly version: '2016-05-20';
        readonly api_key: string;
    };
}
export interface NewVisRecRequest extends VisRecRequestBase {
    readonly qs: {
        readonly version: '2018-03-19';
    };
    readonly headers: {
        readonly 'user-agent': 'machinelearningforkids';
        readonly 'X-Watson-Learning-Opt-Out': 'true';
        readonly Authorization: string;
    };
}

interface TrainingRequest {
    readonly formData: TrainingData;
}
interface TestUrlRequest {
    readonly qs: {
        readonly url: string;
        readonly classifier_ids: string;
        readonly threshold: number;
    };
}
interface TestFileRequest {
    readonly formData: {
        readonly images_file: fs.ReadStream,
        readonly parameters: {
            readonly value: string;
            readonly options: {
                readonly contentType: 'application/json';
            };
        };
    };
}


export interface LegacyTrainingRequest extends TrainingRequest, LegacyVisRecRequest {}
export interface NewTrainingRequest extends TrainingRequest, NewVisRecRequest {}
export interface LegacyTestFileRequest extends TestFileRequest, LegacyVisRecRequest {}
export interface NewTestFileRequest extends TestFileRequest, NewVisRecRequest {}
export interface LegacyTestUrlRequest extends TestUrlRequest, LegacyVisRecRequest {
    readonly qs: {
        readonly version: '2016-05-20';
        readonly api_key: string;

        readonly url: string;
        readonly classifier_ids: string;
        readonly threshold: number;
    };
}
export interface NewTestUrlRequest extends TestUrlRequest, NewVisRecRequest {
    readonly qs: {
        readonly version: '2018-03-19';

        readonly url: string;
        readonly classifier_ids: string;
        readonly threshold: number;
    };
}




export interface VisualRecogApiResponsePayloadClassifiers {
    readonly classifiers: VisualRecogApiResponsePayloadClassifier[];

    // sometimes Visual Recognition returns errors in response to GETs
    readonly error?: any;
}

export interface VisualRecogApiResponsePayloadClassifier {
    readonly classifier_id: string;
    readonly name: string;
    readonly owner: string;
    readonly status: string;
    readonly created: string;
    readonly classes: Array<{ class: string }>;
}


interface TrainingData {
    name: string;
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
