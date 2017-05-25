// external dependencies
import * as fs from 'fs';
import * as tmp from 'tmp';
import * as csvWriter from 'csv-write-stream';
import * as request from 'request-promise';
import * as Bluebird from 'bluebird';
// local dependencies
import * as store from '../db/store';
import * as TrainingObjects from './training-types';
import loggerSetup from '../utils/logger';

const log = loggerSetup();




/**
 * Train a new NLC classifier on Bluemix using the training data
 *  collected for a 'text' training project.
 *
 * @param userid - ID of the user that has collected the training data
 * @param classid - the tenant that the user is a member of
 * @param projectid - the ID for the project with the training data
 * @param projectname - name to give the new classifier
 *
 * @returns details of the created classifier
 */
export async function trainClassifier(
    userid: string, classid: string, projectid: string, projectname: string,
): Promise<TrainingObjects.NLCClassifier>
{
    const trainingFile = await writeTrainingToFile(projectid);
    const credentials = await store.getBluemixCredentials(classid, 'nlc');
    const classifier = await submitTrainingToNLC(credentials, projectname, trainingFile);
    fs.unlink(trainingFile.path);
    return store.storeNLCClassifier(credentials, userid, classid, projectid, classifier);
}



/**
 * Updates the provided set of NLC classifiers with the current status from
 *  Bluemix.
 *
 * @param classid - the tenant that the user is a member of
 * @param classifiers - set of classifier to get status info for
 *
 * @returns the same set of classifiers, with the status and statusDescription
 *  properties set using responses from the Bluemix REST API
 */
export async function getClassifierStatuses(
    classid: string,
    classifiers: TrainingObjects.NLCClassifier[],
): Promise<TrainingObjects.NLCClassifier[]>
{
    const credentials = await store.getBluemixCredentials(classid, 'nlc');
    return Promise.all(
        classifiers.map((classifier) => getStatus(credentials, classifier)));
}




/**
 * Fetches the training data for a project from the DB, and writes it to a
 *  CSV file in the format expected by the Natural Language Classifier service.
 *
 * Only data with a label is included.
 *
 * The intention is that the created file should be a temporary file, and
 *  deleted once it has been used.
 *
 * @returns location of the file with the training data
 */
async function writeTrainingToFile(projectid: string): Promise<TrainingObjects.File> {
    const tmpFile = await getTemporaryFile();
    const writer = prepareCsvWriter(tmpFile);
    await fetchAndWriteTrainingInBatches(projectid, writer);
    writer.end();
    return tmpFile;
}


/**
 * Creates a Natural Language Classifier (NLC) classifier by submitting
 *  a CSV training file to the Bluemix REST API.
 *
 * @param creds - credentials to use to auth with the Bluemix API
 * @param name - name to give the classifier being created
 * @param training - the training data file
 *
 * @returns details of the created classifier
 */
async function submitTrainingToNLC(
    credentials: TrainingObjects.BluemixCredentials,
    name: string,
    training: TrainingObjects.File,
): Promise<TrainingObjects.NLCClassifier>
{
    const req = {
        auth : {
            user : credentials.username,
            pass : credentials.password,
        },
        formData : {
            training_metadata : JSON.stringify({
                language : 'en',
                name,
            }),
            training_data : fs.createReadStream(training.path),
        },
        json : true,
    };

    const body = await request.post(credentials.url + '/v1/classifiers', req);

    const classifierid: string = body.classifier_id;
    const language: string = body.language;
    const created: Date = new Date(body.created);
    const url: string = body.url;
    const status: TrainingObjects.NLCStatus = body.status;
    const statusDescription: string = body.status_description;

    const classifier: TrainingObjects.NLCClassifier = {
        classifierid, url, name, language, created,
        status, statusDescription,
    };

    log.debug({ classifier }, 'Created new classifier');

    return classifier;
}



function getStatus(
    credentials: TrainingObjects.BluemixCredentials,
    classifier: TrainingObjects.NLCClassifier,
): PromiseLike<TrainingObjects.NLCClassifier>
{
    return request.get(classifier.url, {
        auth : {
            user : credentials.username,
            pass : credentials.password,
        },
        json : true,
    })
    .then((body) => {
        classifier.status = body.status;
        classifier.statusDescription = body.status_description;
        return classifier;
    })
    .catch((err) => {
        classifier.status = 'Non Existent';
        classifier.statusDescription = err.error.description;
        return classifier;
    });
}




const NLC_CSV_FORMAT = {
    separator : ',',
    newline : '\n',
    sendHeaders : false,
};

function getTemporaryFile(): Promise<TrainingObjects.File> {
    return new Promise((resolve, reject) => {
        tmp.file((err, path) => {
            if (err) {
                return reject(err);
            }
            return resolve({ path });
        });
    });
}

function prepareCsvWriter(tmpFile: TrainingObjects.File) {
    const writer = csvWriter(NLC_CSV_FORMAT);
    writer.pipe(fs.createWriteStream(tmpFile.path, { flags : 'a' }));
    return writer;
}

async function fetchAndWriteTrainingInBatches(projectid: string, writer): Promise<void> {
    const BATCH = 100;
    const count = await store.countTextTraining(projectid);
    let ptr = 0;
    while (ptr < count) {
        const trainingBatch = await store.getTextTraining(projectid, {
            start: ptr, limit: BATCH,
        });

        for (const training of trainingBatch) {
            if (training.label && training.textdata) {
                writer.write({
                    text : training.textdata,
                    label : training.label,
                });
            }
        }

        ptr += BATCH;
    }
}

