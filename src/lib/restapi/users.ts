// external dependencies
import * as httpstatus from 'http-status';
import * as Express from 'express';
import * as uuid from 'uuid/v4';
// local dependencies
import * as auth0 from '../auth0/users';
import * as auth from './auth';
import * as passphrases from '../auth0/passphrases';
import * as store from '../db/store';
import * as classdeleter from '../classdeleter';
import * as dblimits from '../db/limits';
import * as errors from './errors';
import * as urls from './urls';
import * as headers from './headers';
import * as notifications from '../notifications/slack';
import loggerSetup from '../utils/logger';

const log = loggerSetup();


const VALID_USERNAME = /^[A-Za-z0-9\-_]+$/;


function getStudents(req: Express.Request, res: Express.Response) {
    return auth0.getAllStudents(req.params.classid)
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
                                       'Username ' + req.body.username + ' (' + req.body.email + ') has signed up' +
                                       (req.body.notes ? ', saying "' + req.body.notes + '"' : '');
        notifications.notify(summarymessage, notifications.SLACK_CHANNELS.CLASS_CREATE);

        return res.status(httpstatus.CREATED)
                  .json(teacher);
    }
    catch (err) {
        if (userAlreadyExists(err)) {
            return res.status(httpstatus.CONFLICT).json({ error : 'There is already a user with that username' });
        }

        log.error({ err }, 'Failed to create class account');

        let statusCode = httpstatus.INTERNAL_SERVER_ERROR;
        let errObj = { error : 'Failed to create new class account' };

        if (err.response && err.response.body && err.response.body.statusCode) {
            statusCode = err.response.body.statusCode;
        }
        if (err.error) {
            errObj = err.error;
        }

        return res.status(statusCode).json(errObj);
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
        if (userAlreadyExists(err)) {
            return res.status(httpstatus.CONFLICT).json({ error : 'There is already a student with that username' });
        }

        log.error({ err }, 'Failed to create student account');

        let statusCode = httpstatus.INTERNAL_SERVER_ERROR;
        let errObj = { error : 'Failed to create new account' };

        if (err.response && err.response.body && err.response.body.statusCode) {
            statusCode = err.response.body.statusCode;
        }
        if (err.error) {
            errObj = err.error;
        }

        return res.status(statusCode).json(errObj);
    }
}


async function createStudents(req: Express.Request, res: Express.Response) {
    const tenant: string = req.params.classid;
    if (!req.body) {
        return res.status(httpstatus.BAD_REQUEST).json({ error : 'Missing required fields' });
    }
    if (!req.body.prefix || typeof req.body.prefix !== 'string' || req.body.prefix.trim().length === 0) {
        return res.status(httpstatus.BAD_REQUEST).json({ error : 'Missing required field "prefix"' });
    }
    if (!req.body.number || Number.isInteger(req.body.number) === false ||
        req.body.number <= 0 || req.body.number > 250)
    {
        return res.status(httpstatus.BAD_REQUEST).json({ error : 'Missing required field "number"' });
    }
    // we don't need to check the password is good/sensible as password
    //  complexity policy is defined and enforced at the Auth0 service
    if (!req.body.password || typeof req.body.password !== 'string' || req.body.password.trim().length === 0) {
        return res.status(httpstatus.BAD_REQUEST).json({ error : 'Missing required field "password"' });
    }

    const numUsersInTenant = await auth0.countUsers(tenant);
    const tenantPolicy = await store.getClassTenant(tenant);
    if (numUsersInTenant + req.body.number > tenantPolicy.maxUsers) {
        return res.status(httpstatus.CONFLICT)
                  .json({ error : 'That would exceed the number of students allowed in the class' });
    }

    const prefix = req.body.prefix.trim();
    const password = req.body.password.trim();

    log.info({ prefix, tenant, number : req.body.number }, 'Creating multiple students');

    const successes: Array<{ id: string, username: string }> = [];
    const duplicates: string[] = [];
    const failures: string[] = [];

    for (let idx = 1; idx <= req.body.number; idx++) {
        const username = prefix + idx;
        try {
            const newstudent = await auth0.createStudentWithPwd(tenant, username, password);
            successes.push({ id : newstudent.id, username : newstudent.username });
        }
        catch (err) {
            if (userAlreadyExists(err)) {
                duplicates.push(username);
            }
            else if (passwordRejected(err)) {
                return res.status(httpstatus.BAD_REQUEST).json({ error : 'Password is too simple' });
            }
            else {
                log.error({ err, username, tenant }, 'Failed to create student');
                failures.push(username);
            }
        }
    }

    return res.status(httpstatus.OK).json({ successes, duplicates, failures });
}


function userAlreadyExists(err: any) {
    return err && err.response && err.response.body &&
           (
               (err.response.body.statusCode === httpstatus.CONFLICT &&
                err.response.body.message === 'The user already exists.')
                ||
               (err.response.body.statusCode === httpstatus.BAD_REQUEST &&
                err.response.body.message === 'The username provided is in use already.')
            );
}
function passwordRejected(err: any) {
    return err && err.response && err.response.body &&
           (
               (err.response.body.statusCode === httpstatus.BAD_REQUEST &&
                err.response.body.message === 'PasswordStrengthError: Password is too weak')
            );
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
        notifications.notify('Failed to delete user ' + userid + ' from ' + tenant,
                             notifications.SLACK_CHANNELS.CRITICAL_ERRORS);
    }

    try {
        await store.storeDeleteUserObjectsJob(tenant, userid);
    }
    catch (err) {
        log.error({ err }, 'Failed to clean up image store for deleted user');
        notifications.notify('Failed to delete storage for user ' + userid + ' from ' + tenant,
                             notifications.SLACK_CHANNELS.CRITICAL_ERRORS);
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

function resetStudentsPassword(req: Express.Request, res: Express.Response) {
    const tenant = req.params.classid;

    let studentids: string[];
    try {
        studentids = getUserPatch(req);
    }
    catch (err) {
        return res.status(httpstatus.BAD_REQUEST)
                  .json({
                      error : err.message,
                  });
    }

    return auth0.resetStudentsPassword(tenant, studentids)
        .then((password) => {
            res.json({ password });
        })
        .catch((err) => {
            res.status(err.statusCode)
                .json(err);
        });
}



function modifyClass(req: Express.Request, res: Express.Response) {
    const tenant = req.params.classid;

    let patch: { textClassifierExpiry: number, imageClassifierExpiry: number };
    try {
        patch = getClassPatch(req);
    }
    catch (err) {
        return res.status(httpstatus.BAD_REQUEST)
                  .json({
                      error : err.message,
                  });
    }

    return store.modifyClassTenantExpiries(tenant,
                                           patch.textClassifierExpiry,
                                           patch.imageClassifierExpiry)
        .then((modified) => {
            res.json(modified);
        })
        .catch((err) => {
            if (err.message === 'Missing required expiry value' ||
                err.message === 'Expiry values should be an integer number of hours' ||
                err.message === 'Expiry values should be a positive number of hours' ||
                err.message === 'Expiry values should not be greater than 255 hours')
            {
                return errors.missingData(res);
            }
            return errors.unknownError(res, err);
        });
}




function deleteClass(req: Express.Request, res: Express.Response) {
    const tenant = req.params.classid;
    const confirm = req.query.confirm;

    if (!confirm) {
        return errors.missingData(res);
    }

    return classdeleter.deleteClass(tenant)
        .then(() => {
            return res.status(httpstatus.NO_CONTENT).send();
        })
        .catch((err) => {
            log.error({ err, tenant }, 'Failed to delete class');
            notifications.notify('Failed to delete class ' + tenant + ' because:\n' + err.message,
                                 notifications.SLACK_CHANNELS.CRITICAL_ERRORS);

            return errors.unknownError(res, err);
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

            maxTextModels : availableTextCredentials,
            maxImageModels : availableImageCredentials,

            maxUsers : policy.maxUsers,
            supportedProjectTypes : policy.supportedProjectTypes,
            maxProjectsPerUser : policy.maxProjectsPerUser,
            textClassifierExpiry : policy.textClassifierExpiry,
            imageClassifierExpiry : policy.imageClassifierExpiry,

            textTrainingItemsPerProject : storelimits.textTrainingItemsPerProject,
            numberTrainingItemsPerProject : storelimits.numberTrainingItemsPerProject,
            numberTrainingItemsPerClassProject : storelimits.numberTrainingItemsPerClassProject,
            imageTrainingItemsPerProject : storelimits.imageTrainingItemsPerProject,
            soundTrainingItemsPerProject : storelimits.soundTrainingItemsPerProject,
        });
    }
    catch (err){
        log.error({ err }, 'Failed to get policy');
        errors.unknownError(res, err);
    }
}



function getUserPatch(req: Express.Request): string[] {
    const patchRequests = req.body;

    if (Array.isArray(patchRequests) === false) {
        throw new Error('PATCH body should be an array');
    }

    return patchRequests.map((patchRequest: any) => {
        if (patchRequest &&
            patchRequest.op &&
            patchRequest.path &&
            patchRequest.value &&
            patchRequest.op === 'replace' &&
            patchRequest.path === '/password' &&
            patchRequest.value.id)
        {
            return patchRequest.value.id;
        }
        throw new Error('Invalid PATCH request');
    });
}

function getClassPatch(req: Express.Request): { textClassifierExpiry: number, imageClassifierExpiry: number }
{
    const patchRequests = req.body;

    if (Array.isArray(patchRequests) === false) {
        throw new Error('PATCH body should be an array');
    }
    if (patchRequests.length !== 2) {
        throw new Error('PATCH body should include 2 values');
    }

    const patch = {
        textClassifierExpiry : 0,
        imageClassifierExpiry : 0,
    };

    patchRequests.forEach((patchRequest: any) => {
        if (patchRequest &&
            patchRequest.op &&
            patchRequest.path &&
            patchRequest.value &&
            patchRequest.op === 'replace' &&
            (patchRequest.path === '/textClassifierExpiry' || patchRequest.path === '/imageClassifierExpiry'))
        {
            const path: 'textClassifierExpiry' | 'imageClassifierExpiry' = patchRequest.path.substr(1);
            patch[path] = patchRequest.value;
        }
        else {
            throw new Error('Invalid PATCH request');
        }
    });

    return patch;
}



function generatePassword(req: Express.Request, res: Express.Response) {
    res.json({ password : passphrases.generate() });
}



export default function registerApis(app: Express.Application) {

    app.get(urls.TENANT_POLICY,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        getPolicy);

    app.patch(urls.TENANT_POLICY,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        modifyClass);

    app.delete(urls.CLASS,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        deleteClass);

    app.get(urls.USERS,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        getStudents);

    app.post(urls.USERS,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        createStudent);

    app.put(urls.USERS,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        createStudents);

    app.delete(urls.USER,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        deleteStudent);

    app.post(urls.USER_PASSWORD,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        resetStudentPassword);

    app.patch(urls.USERS,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        resetStudentsPassword);

    app.get(urls.PASSWORD,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        generatePassword);

    // API for creating new tenants / teacher accounts so
    //  this API can't be an authenticated one
    app.post(urls.TEACHERS, createTeacher);
}
