// external dependencies
import * as request from 'request-promise';
import * as httpStatus from 'http-status';
// local dependencies
import * as store from '../db/store';
import * as Objects from '../db/db-types';
import * as TrainingObjects from './training-types';
import * as openwhisk from '../utils/openwhisk';
import * as env from '../utils/env';
import loggerSetup from '../utils/logger';

const log = loggerSetup();






export async function trainClassifier(
    project: Objects.Project,
): Promise<TrainingObjects.NumbersClassifier>
{
    let status: TrainingObjects.NumbersStatus;

    try {
        // create a new classifier
        const data = await fetchTraining(project);
        if (data.length === 0) {
            // no training data available to train a classifier
            return {
                created : new Date(),
                status: 'Failed',
                classifierid : '',
            };
        }

        await submitTraining(project.classid, project.userid, project.id, data);

        status = 'Available';
    }
    catch (err) {
        status = 'Failed';
    }

    // misusing the Bluemix creds structure to store what we need
    //  to use the numbers service
    const credentials: TrainingObjects.BluemixCredentials = {
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

    // write details about the new classifier to the DB
    const storedClassifier = await store.storeNumbersClassifier(project.userid, project.classid, project.id, status);
    if (status === 'Available') {
        const classifierid = project.id;
        await store.storeOrUpdateScratchKey(project, credentials, classifierid, storedClassifier.created);
    }

    return storedClassifier;
}



export async function testClassifier(
    studentid: string, tenantid: string,
    classifierTimestamp: Date, projectid: string,
    data: any[],
): Promise<TrainingObjects.Classification[]>
{
    const fieldsInfo = await store.getNumberProjectFields(studentid, tenantid, projectid);

    const req: NumbersApiRequestPayloadTestItem = {
        auth : {
            user : process.env[env.NUMBERS_SERVICE_USER],
            pass : process.env[env.NUMBERS_SERVICE_PASS],
        },
        body : {
            tenantid, studentid, projectid,
            data : prepareDataObject(fieldsInfo, data),
        },
        json : true,
        gzip : true,
    };
    const url = process.env[env.NUMBERS_SERVICE] + '/api/classify';

    let body: { [classname: string]: number };
    try {
        body = await request.post(url, req);
    }
    catch (err) {
        if (err.statusCode === httpStatus.NOT_FOUND) {
            // no ML model found, so try to train one now
            //  and then try the call again
            const project = await store.getProject(projectid);
            if (!project) {
                throw new Error('Project not found');
            }

            const classifier = await trainClassifier(project);
            if (classifier.status === 'Available') {
                body = await request.post(url, req);
            }
            else {
                throw new Error('Failed to create classifier');
            }
        }
        else {
            throw err;
        }
    }
    return Object.keys(body)
            .map((key) => {
                return {
                    class_name : key,
                    confidence : body[key],
                    classifierTimestamp,
                };
            })
            .sort(confidenceSort);
}



export async function deleteClassifier(studentid: string, tenantid: string, projectid: string): Promise<void>
{
    const req: NumbersApiDeleteClassifierRequest = {
        auth : {
            user : process.env[env.NUMBERS_SERVICE_USER],
            pass : process.env[env.NUMBERS_SERVICE_PASS],
        },
        qs : { tenantid, studentid, projectid },
        json : true,
    };

    const url = process.env[env.NUMBERS_SERVICE] + '/api/models';
    await request.delete(url, req);
}




function confidenceSort(a: TrainingObjects.Classification, b: TrainingObjects.Classification): number {
    return b.confidence - a.confidence;
}



async function submitTraining(
    tenantid: string, studentid: string, projectid: string, data: any[][],
): Promise<void>
{
    const req: NumbersApiRequestPayloadClassifierItem = {
        auth : {
            user : process.env[env.NUMBERS_SERVICE_USER],
            pass : process.env[env.NUMBERS_SERVICE_PASS],
        },
        body : {
            tenantid, studentid, projectid, data,
        },
        json : true,
        gzip : true,
    };

    const url = process.env[env.NUMBERS_SERVICE] + '/api/models';

    try {
        await request.post(url, req);
    }
    catch (err) {
        log.error({ req, err, tenantid, projectid }, 'Failed to train numbers classifier');

        // The full error object will include information about the
        //  internal numbers service which we don't want to return
        //  to clients/users.
        throw new Error('Failed to train classifier');
    }
}


function prepareDataObject(
    fields: Objects.NumbersProjectField[],
    dataitems: number[],
): { [fieldname: string]: string | number }
{
    const trainingObj: { [fieldname: string]: string | number } = {};

    fields.forEach((field, fieldPos) => {
        const num = dataitems[fieldPos];
        if (field.type === 'multichoice' && field.choices[num]) {
            trainingObj[field.name] = field.choices[num];
        }
        else {
            trainingObj[field.name] = num;
        }
    });

    return trainingObj;
}




async function fetchTraining(project: Objects.Project): Promise<any[][]> {
    const count = await store.countTraining('numbers', project.id);
    const training = await store.getNumberTraining(project.id, {
        start: 0, limit: count,
    });
    const fieldsInfo = await store.getNumberProjectFields(project.userid, project.classid, project.id);

    return training.filter((item) => item.label && project.labels.includes(item.label))
                   .map((item) => {
                       return [
                           prepareDataObject(fieldsInfo, item.numberdata),
                           item.label,
                       ];
                   });
}



async function getVisualisationFromModelServer(project: Objects.Project): Promise<NumbersModelDescriptionResponse> {
    const req: NumbersModelDescriptionRequest = {
        auth : {
            user : process.env[env.NUMBERS_SERVICE_USER],
            pass : process.env[env.NUMBERS_SERVICE_PASS],
        },
        qs : {
            tenantid : project.classid,
            studentid : project.userid,
            projectid : project.id,
            formats : 'dot,svg',
        },
        json : true,
    };

    const url = process.env[env.NUMBERS_SERVICE] + '/api/models';

    let response: NumbersModelDescriptionResponse;
    try {
        response = await request.get(url, req);
    }
    catch (err) {
        if (err.statusCode === httpStatus.NOT_FOUND) {
            const classifier = await trainClassifier(project);
            if (classifier.status === 'Available') {
                response = await request.get(url, req);
            }
            else {
                throw new Error('Failed to create classifier');
            }
        }
        else {
            throw err;
        }
    }
    return response;
}

async function getVisualisationFromOpenWhisk(project: Objects.Project): Promise<NumbersModelDescriptionResponse> {
    const rawTraining = await fetchTraining(project);
    const examples = [];
    const labels: string[] = [];
    for (const trainingItem of rawTraining) {
        examples.push(trainingItem[0]);
        labels.push(trainingItem[1]);
    }

    const url = openwhisk.getUrl(openwhisk.FUNCTIONS.DESCRIBE_MODEL);
    const headers = openwhisk.getHeaders();

    const serverlessRequest = {
        url,
        method : 'POST',
        json : true,
        headers : {
            ...headers,
            'User-Agent': 'machinelearningforkids.co.uk',
            'Accept' : 'application/json',
        },
        body : {
            examples,
            labels,
            formats : [ 'dot', 'svg' ],
        },
    };

    try {
        const response = await request.post(serverlessRequest);

        return response;
    }
    catch (err) {
        log.error({ err, url }, 'Failed to submit OpenWhisk request');
        throw err;
        // return getVisualisationFromModelServer(project);
    }
}


let execution: openwhisk.Execution = 'local';

function chooseExecutionEnvironment() {
    openwhisk.isOpenWhiskConfigured()
        .then((okayToUseOpenWhisk) => {
            if (okayToUseOpenWhisk) {
                execution = 'openwhisk';
            }
        });
}

chooseExecutionEnvironment();





export function getModelVisualisation(project: Objects.Project): Promise<NumbersModelDescriptionResponse> {
    if (execution === 'openwhisk') {
        return getVisualisationFromOpenWhisk(project);
    }
    else {
        return getVisualisationFromModelServer(project);
    }
}



export interface NumbersModelDescriptionRequest {
    readonly auth: {
        readonly user: string | undefined;
        readonly pass: string | undefined;
    };
    readonly qs: {
        readonly tenantid: string;
        readonly studentid: string;
        readonly projectid: string;
        readonly formats: string;
    };
    readonly json: true;
}

export interface NumbersModelDescriptionResponse {
    readonly vocabulary: { [fieldname: string]: number };
    readonly svg?: string;
    readonly png?: string;
    readonly dot?: string;
}




export interface NumbersApiRequestPayloadClassifierItem {
    readonly auth: {
        readonly user: string | undefined;
        readonly pass: string | undefined;
    };
    readonly body: {
        readonly tenantid: string;
        readonly studentid: string;
        readonly projectid: string;
        readonly data: any[][];
    };
    readonly json: true;
    readonly gzip: true;
}

export interface NumbersApiRequestPayloadTestItem {
    readonly auth: {
        readonly user: string | undefined;
        readonly pass: string | undefined;
    };
    readonly body: {
        readonly tenantid: string;
        readonly studentid: string;
        readonly projectid: string;
        readonly data: { [fieldname: string]: string | number };
    };
    readonly json: true;
    readonly gzip: true;
}

export interface NumbersApiDeleteClassifierRequest {
    readonly auth: {
        readonly user: string | undefined;
        readonly pass: string | undefined;
    };
    readonly qs: {
        readonly tenantid: string;
        readonly studentid: string;
        readonly projectid: string;
    };
    readonly json: true;
}

