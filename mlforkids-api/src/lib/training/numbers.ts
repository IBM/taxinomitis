// external dependencies
import * as httpStatus from 'http-status';
import { unparse } from 'papaparse';
// local dependencies
import * as store from '../db/store';
import * as Objects from '../db/db-types';
import * as TrainingObjects from './training-types';
import * as request from '../utils/request';
import * as env from '../utils/env';
import loggerSetup from '../utils/logger';
import * as slack from '../notifications/slack';

const log = loggerSetup();



export async function trainClassifierCloudProject(project: Objects.Project): Promise<NumbersApiResponsePayloadClassifierItem>
{
    const training = await store.getNumberTraining(project.id, { start: 0, limit: 3000 });
    const fieldsinfo = await store.getNumberProjectFields(project.userid, project.classid, project.id);

    return trainClassifier(project, training, fieldsinfo);
}



export function trainClassifier(
    project: Objects.Project,
    training: Objects.NumberTraining[],
    fieldsInfo: Objects.NumbersProjectField[],
): Promise<NumbersApiResponsePayloadClassifierItem>
{
    return createTensorflowCsv(project, training, fieldsInfo)
        .then((csvData) => {
            return submitTraining(project.id, csvData);
        })
        .catch((err) => {
            log.error({ err, project }, 'Failed to train classifier');
            if (isTrainingErrorPayload(err)) {
                slack.notify('Failed to train number classifier', slack.SLACK_CHANNELS.TRAINING_ERRORS);
                return err;
            }
            else {
                let errormessage = err.message;
                if (errormessage.includes('ECONNREFUSED')) {
                    errormessage = 'Failed to contact model training server';
                }

                return {
                    key : project.id,
                    status : 'Failed',
                    error : {
                        message : errormessage,
                    },
                };
            }
        });
}


function isTrainingErrorPayload(obj: any): boolean {
    return obj.status &&
           obj.error &&
           obj.error.message;
}



function submitTraining(
    projectid: string, csvfile: TrainingObjects.CsvString,
): Promise<NumbersApiResponsePayloadClassifierItem>
{
    const req: NumbersApiRequestPayloadClassifierItem = {
        auth : {
            user : process.env[env.NUMBERS_SERVICE_USER],
            pass : process.env[env.NUMBERS_SERVICE_PASS],
        },
        formData : {
            csvfile : {
                value : csvfile,
                options : {
                    filename : 'training.csv',
                    contentType : 'text/csv',
                },
            },
        },
        json : true,
        gzip : true,
    };

    const url = process.env[env.NUMBERS_SERVICE] + '/model-requests/' + projectid;

    const DO_NOT_RETRY = false;

    return request.post(url, req, DO_NOT_RETRY);
}



async function createTensorflowCsv(
    project: Objects.Project,
    training: Objects.NumberTraining[],
    fieldsInfo: Objects.NumbersProjectField[],
): Promise<TrainingObjects.CsvString>
{
    if (training.length === 0) {
        const insufficientData = new Error('More training data needed to train a model') as any;
        insufficientData.statusCode = httpStatus.BAD_REQUEST;
        throw insufficientData;
    }

    const inflatedTraining = training
        .filter((item) => item.label && project.labels.includes(item.label))
        .map((item) => {
            const trainingItem: { [key: string]: string | number } = {
                mlforkids_outcome_label : item.label as string,
            };

            fieldsInfo.forEach((field, idx) => {
                const num = item.numberdata[idx];

                if (field.type === 'multichoice' && field.choices[num]) {
                    trainingItem[field.name] = field.choices[num];
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
                    trainingItem[field.name] = num;
                }
            });

            return trainingItem;
        });

    const fieldNames = fieldsInfo.map((field) => field.name);
    fieldNames.push('mlforkids_outcome_label');

    return unparse(inflatedTraining, {
        columns: fieldNames,
        quotes: false,
        delimiter: ',',
        header: true,
    });
}


function isString(item: any): boolean {
    return typeof item === 'string';
}
function isNumber(item: any): boolean {
    return typeof item === 'number';
}
export function isNumbersProjectFieldSummary(item: any): boolean {
    return item &&
           item.name && typeof item.name === 'string' &&
           item.type && (item.type === 'number' || item.type === 'multichoice') &&
           (item.type === 'number' || (item.choices && Array.isArray(item.choices)));
}
function isNumberTraining(item: any): boolean {
    return item &&
           item.numberdata &&
                Array.isArray(item.numberdata) &&
                item.numberdata.every(isNumber) &&
           item.label && typeof item.label === 'string';
}


export function validateLocalProjectTrainingRequest(input: any, userid: string): { project: Objects.Project, training: Objects.NumberTraining[] } {
    if (!input) {
        throw new Error('No data provided');
    }

    if (input.project &&
        input.project.labels &&
            Array.isArray(input.project.labels) &&
            input.project.labels.every(isString) &&
        input.project.fields &&
            Array.isArray(input.project.fields) &&
            input.project.fields.every(isNumbersProjectFieldSummary))
    {
        // valid project

        // replace the id if it isn't something that we can rely on as unique
        if (typeof input.project.id !== 'string') {
            input.project.id = userid + '-' + input.project.id;
        }
    }
    else {
        throw new Error('Missing required project info');
    }

    if (input.training &&
            Array.isArray(input.training) &&
            input.training.every(isNumberTraining))
    {
        // valid training
    }
    else {
        throw new Error('Missing required training info');
    }

    return input;
}



export interface NumbersApiRequestPayloadClassifierItem {
    readonly auth: {
        readonly user: string | undefined;
        readonly pass: string | undefined;
    };
    readonly formData: {
        readonly csvfile: {
            readonly value : TrainingObjects.CsvString;
            readonly options : {
                readonly filename : 'training.csv';
                readonly contentType : 'text/csv';
            };
        };
    };
    readonly json: true;
    readonly gzip: true;
}
export interface NumbersApiResponsePayloadClassifierItem {
    readonly key : string;
    readonly status : 'error' | 'training' | 'ready';
    readonly urls : undefined | {
        readonly status : string;
        readonly model : string;
        readonly tree : string;
        readonly vocab : string;
        readonly dot : string;
    };
    readonly lastupdate : string;
    readonly error : undefined | {
        readonly message : string;
        readonly stack : string;
    };
}

