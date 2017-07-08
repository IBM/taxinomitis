// external dependencies
import * as request from 'request-promise';
import * as httpStatus from 'http-status';
// local dependencies
import * as store from '../db/store';
import * as Objects from '../db/db-types';
import * as TrainingObjects from './training-types';
import loggerSetup from '../utils/logger';

const log = loggerSetup();






export async function trainClassifier(
    project: Objects.Project,
): Promise<TrainingObjects.NumbersClassifier>
{
    let status: TrainingObjects.NumbersStatus;

    try {
        // create a new classifier
        const data = await fetchTraining(project.id);
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
    };

    // write details about the new classifier to the DB
    const storedClassifier = await store.storeNumbersClassifier(project.userid, project.classid, project.id, status);
    if (status === 'Available') {
        const classifierid = project.id;
        await store.storeOrUpdateScratchKey(project, credentials, classifierid);
    }

    return storedClassifier;
}



export async function testClassifier(
    studentid: string, tenantid: string, projectid: string,
    data: number[],
): Promise<TrainingObjects.Classification[]>
{
    const req = {
        auth : {
            user : process.env.NUMBERS_SERVICE_USER,
            pass : process.env.NUMBERS_SERVICE_PASS,
        },
        body : { tenantid, studentid, projectid, data },
        json : true,
        gzip : true,
    };
    const url = process.env.NUMBERS_SERVICE + '/api/classify';

    let body;
    try {
        body = await request.post(url, req);
    }
    catch (err) {
        if (err.statusCode === httpStatus.NOT_FOUND) {
            const project = await store.getProject(projectid);
            await trainClassifier(project);
            body = await request.post(url, req);
        }
        else {
            throw err;
        }
    }
    return Object.keys(body)
            .map((key) => {
                return { class_name : key, confidence : body[key] };
            })
            .sort(confidenceSort);
}



export async function deleteClassifier(studentid: string, tenantid: string, projectid: string): Promise<void>
{
    const req = {
        auth : {
            user : process.env.NUMBERS_SERVICE_USER,
            pass : process.env.NUMBERS_SERVICE_PASS,
        },
        qs : { tenantid, studentid, projectid },
        json : true,
    };

    const url = process.env.NUMBERS_SERVICE + '/api/models';
    await request.delete(url, req);
}




function confidenceSort(a: TrainingObjects.Classification, b: TrainingObjects.Classification): number {
    return b.confidence - a.confidence;
}



async function submitTraining(
    tenantid: string, studentid: string, projectid: string, data: any[][],
): Promise<void>
{
    const req = {
        auth : {
            user : process.env.NUMBERS_SERVICE_USER,
            pass : process.env.NUMBERS_SERVICE_PASS,
        },
        body : {
            tenantid, studentid, projectid, data,
        },
        json : true,
        gzip : true,
    };

    const url = process.env.NUMBERS_SERVICE + '/api/models';

    try {
        await request.post(url, req);
    }
    catch (err) {
        log.error({ req, err }, 'Failed to train classifier');

        // The full error object will include information about the
        //  internal numbers service which we don't want to return
        //  to clients/users.
        throw new Error('Failed to train classifier');
    }
}





async function fetchTraining(projectid: string): Promise<any[][]> {
    const count = await store.countNumberTraining(projectid);
    const training = await store.getNumberTraining(projectid, {
        start: 0, limit: count,
    });

    return training.filter((item) => item.label)
                   .map((item) => {
                       const data: any[] = item.numberdata;
                       data.push(item.label);
                       return data;
                   });
}
