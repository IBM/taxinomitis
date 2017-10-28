// external dependencies
import * as httpstatus from 'http-status';
import * as Express from 'express';
import * as uuid from 'uuid/v4';
// local dependencies
import * as auth0 from '../auth0/users';
import * as auth from './auth';
import * as store from '../db/store';
import * as dblimits from '../db/limits';
import * as errors from './errors';
import * as headers from './headers';
import * as notifications from '../notifications/slack';
import loggerSetup from '../utils/logger';

const log = loggerSetup();


const VALID_USERNAME = /^[A-Za-z0-9\-_]+$/;


function getStudents(req: Express.Request, res: Express.Response) {
    return auth0.getStudents(req.params.classid)
        .then((students) => {
            res.set(headers.NO_CACHE).json(students);
        })
        .catch((err) => {
            errors.unknownError(res, err);
        });
}


async function createTeacher(req: Express.Request, res: Express.Response) {
    if (!req.body || !req.body.username || !req.body.email) {
        return res.status(httpstatus.BAD_REQUEST)
                  .send({ error : 'A username and email address for a class leader ' +
                                  'is required to create a new class' });
    }
    if (VALID_USERNAME.test(req.body.username) === false) {
        return res.status(httpstatus.BAD_REQUEST)
                   .send({ error : 'Invalid username. Use letters, numbers, hyphens and underscores, only.' });
    }

    const tenant: string = uuid();

    try {
        const teacher = await auth0.createTeacher(tenant,
                                                  req.body.username,
                                                  req.body.email);

        const summarymessage: string = 'A new class account was created! ' +
                                       'Username ' + req.body.username + ' has signed up, ' +
                                       (req.body.notes ? 'saying "' + req.body.notes + '"' : '');
        notifications.notify(summarymessage);

        return res.status(httpstatus.CREATED)
                  .json(teacher);
    }
    catch (err) {
        log.error({ err }, 'Failed to create class account');

        return res.status(httpstatus.INTERNAL_SERVER_ERROR)
                  .json({ error : 'Failed to create new class account. ' + err.message });
    }
}


async function createStudent(req: Express.Request, res: Express.Response) {
    const tenant: string = req.params.classid;
    if (!req.body || !req.body.username) {
        return res.status(httpstatus.BAD_REQUEST)
                   .json({ error : 'Missing required field "username"' });
    }
    if (VALID_USERNAME.test(req.body.username) === false) {
        return res.status(httpstatus.BAD_REQUEST)
                   .json({ error : 'Invalid username. Use letters, numbers, hyphens and underscores, only.' });
    }

    const numUsersInTenant = await auth0.countUsers(tenant);
    const tenantPolicy = await store.getClassTenant(tenant);

    if (numUsersInTenant >= tenantPolicy.maxUsers) {
        return res.status(httpstatus.CONFLICT)
                  .json({ error : 'Class already has maximum allowed number of students' });
    }

    try {
        const newstudent = await auth0.createStudent(tenant, req.body.username);
        return res.status(httpstatus.CREATED)
                  .json(newstudent);
    }
    catch (err) {
        return res.status(err.response.body.statusCode)
                  .json(err.response.body);
    }
}


async function deleteStudent(req: Express.Request, res: Express.Response) {
    const tenant = req.params.classid;
    const userid = req.params.studentid;

    try {
        await auth0.deleteStudent(tenant, userid);
        res.sendStatus(httpstatus.NO_CONTENT);
    }
    catch (err) {
        res.status(err.statusCode).json(err);
    }

    try {
        await store.deleteEntireUser(userid, tenant);
    }
    catch (err) {
        log.error({ err }, 'Failed to clean up projects for deleted user');
    }
}


function resetStudentPassword(req: Express.Request, res: Express.Response) {
    const tenant = req.params.classid;
    const userid = req.params.studentid;

    return auth0.resetStudentPassword(tenant, userid)
        .then((student) => {
            res.json(student);
        })
        .catch((err) => {
            res.status(err.statusCode)
                .json(err);
        });
}




async function getPolicy(req: Express.Request, res: Express.Response) {
    const tenant = req.params.classid;

    try {
        const policy = await store.getClassTenant(tenant);
        const storelimits = await dblimits.getStoreLimits();
        const availableCredentials = await store.countBluemixCredentialsByType(tenant);
        const availableTextCredentials = availableCredentials.conv;
        const availableImageCredentials = availableCredentials.visrec;

        return res.json({
            isManaged : policy.isManaged,

            maxTextModels : availableTextCredentials * 20,
            maxImageModels : availableImageCredentials * 1,

            maxUsers : policy.maxUsers,
            supportedProjectTypes : policy.supportedProjectTypes,
            maxProjectsPerUser : policy.maxProjectsPerUser,
            textClassifierExpiry : policy.textClassifierExpiry,
            imageClassifierExpiry : policy.imageClassifierExpiry,

            textTrainingItemsPerProject : storelimits.textTrainingItemsPerProject,
            numberTrainingItemsPerProject : storelimits.numberTrainingItemsPerProject,
            imageTrainingItemsPerProject : storelimits.imageTrainingItemsPerProject,
        });
    }
    catch (err){
        log.error({ err }, 'Failed to get policy');
        errors.unknownError(res, err);
    }
}







export default function registerApis(app: Express.Application) {

    app.get('/api/classes/:classid/policy',
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        getPolicy);

    app.get('/api/classes/:classid/students',
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        getStudents);

    app.post('/api/classes/:classid/students',
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        createStudent);

    app.delete('/api/classes/:classid/students/:studentid',
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        deleteStudent);

    app.post('/api/classes/:classid/students/:studentid/password',
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        resetStudentPassword);


    // API for creating new tenants / teacher accounts so
    //  this API can't be an authenticated one
    app.post('/api/teachers', createTeacher);
}
