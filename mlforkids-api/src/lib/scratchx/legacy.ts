// external dependencies
import * as _ from 'lodash';
import * as httpStatus from 'http-status';
// local dependencies
import * as store from '../db/store';
import * as Types from '../db/db-types';
import * as TrainingTypes from '../training/training-types';
import * as request from '../utils/request';
import * as env from '../utils/env';
import loggerSetup from '../utils/logger';

const log = loggerSetup();



export const LEGACYKEYS = [
    'b84f0890-d873-11ee-8913-e5db25e37b3c0eddcd36-3e15-4536-bb5a-946dbdc389ad',
];






export async function trainClassifier(
    project: Types.Project,
): Promise<TrainingTypes.NumbersClassifier>
{
    let status: TrainingTypes.NumbersStatus;

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

    const storedClassifier = {
        created : new Date(),
        status,
        classifierid : project.id,
    };
    // // write details about the new classifier to the DB
    // const storedClassifier = await store.storeNumbersClassifier(project.userid, project.classid, project.id, status);
    // if (status === 'Available') {
    //     const classifierid = project.id;
    await store.storeOrUpdateScratchKey(project, credentials, storedClassifier.classifierid, storedClassifier.created);
    // }

    return storedClassifier;
}


async function submitTraining(
    tenantid: string, studentid: string, projectid: string, data: any[][],
): Promise<void>
{
    const req = {
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

    const url = process.env[env.NUMBERS_SERVICE_LEGACY] + '/api/models';

    try {
        await request.post(url, req, true);
    }
    catch (err) {
        log.error({ req, err, tenantid, projectid }, 'Failed to train numbers classifier');

        // The full error object will include information about the
        //  internal numbers service which we don't want to return
        //  to clients/users.
        throw new Error('Failed to train classifier');
    }
}

async function fetchTraining(project: Types.Project): Promise<any[][]> {
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








function chooseLabelsAtRandom(project: Types.Project | Types.LocalProject): TrainingTypes.Classification[] {
    const confidence = Math.round((1 / project.labels.length) * 100);
    return _.shuffle(project.labels).map((label) => {
        return {
            class_name : label,
            confidence,
            random : true,
            classifierTimestamp : new Date(),
        };
    });
}


/**
 * Parses the provided string as a number if it can be.
 *  If that fails (returns NaN), it returns the original string.
 */
function safeParseFloat(str: string): any {
    const val = parseFloat(str);
    return isNaN(val) ? str : val;
}

function safeJsonStringify(obj: object): string {
    try {
        return JSON.stringify(obj);
    }
    catch (err) {
        return err.message;
    }
}




function prepareDataObject(
    fields: Types.NumbersProjectField[],
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
            if (num < -3.4028235e+38) {
                const tooSmall = new Error('Value (' + num + ') is too small') as any;
                tooSmall.statusCode = httpStatus.BAD_REQUEST;
                throw tooSmall;
            }
            if (num > 3.4028235e+38) {
                const tooBig = new Error('Value (' + num + ') is too big') as any;
                tooBig.statusCode = httpStatus.BAD_REQUEST;
                throw tooBig;
            }
            trainingObj[field.name] = num;
        }
    });

    return trainingObj;
}


function confidenceSort(a: TrainingTypes.Classification, b: TrainingTypes.Classification): number {
    return b.confidence - a.confidence;
}


async function testClassifier(
    studentid: string, tenantid: string,
    classifierTimestamp: Date, projectid: string,
    data: any[],
): Promise<TrainingTypes.Classification[]>
{
    const fieldsInfo = await store.getNumberProjectFields(studentid, tenantid, projectid);

    const req = {
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
    const url = process.env[env.NUMBERS_SERVICE_LEGACY] + '/api/classify';

    let body: { [classname: string]: number } = {};
    try {
        body = await request.post(url, req, true);
    }
    catch (err) {
        if (err.statusCode === httpStatus.NOT_FOUND) {
            // no ML model found, so try to train one now
            //  and then try the call again
            const project = await store.getProject(projectid);
            if (!project) {
                throw new Error('Project not found');
            }
        }
        else if (err.statusCode === httpStatus.INTERNAL_SERVER_ERROR &&
                 err.message.includes("Input contains NaN, infinity or a value too large for dtype('float32')"))
        {
            log.error({ err, data }, 'Value provided outside of valid range?');
            throw err;
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






export async function classifyNumbers(key: Types.ScratchKey, numbers: string[]): Promise<TrainingTypes.Classification[]> {
    if (!numbers || numbers.length === 0 || !Array.isArray(numbers)) {
        throw new Error('Missing data');
    }
    const project = await store.getProject(key.projectid);
    if (!project) {
        throw new Error('Project not found');
    }
    if (numbers.length !== project.numfields) {
        throw new Error('Missing data');
    }

    try {
        if (key.classifierid && key.credentials) {
            const resp = await testClassifier(
                key.credentials.username,
                key.credentials.password,
                key.updated,
                key.classifierid,
                numbers.map(safeParseFloat));
            return resp;
        }
    }
    catch (err) {
        if (err.statusCode === httpStatus.BAD_REQUEST) {
            log.warn({ err, numbers }, 'Failed to test numbers classifier');
        }
        else {
            log.error({ err, numbers, numbersjson : safeJsonStringify(numbers) }, 'Failed to test numbers classifier');
        }
    }

    // we don't have a trained functional decision tree,
    //  so we resort to choosing random
    return chooseLabelsAtRandom(project);
}
