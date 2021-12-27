// external dependencies
import * as httpstatus from 'http-status';
import * as Express from 'express';
import { v4 as uuid } from 'uuid';
// local dependencies
import * as auth0 from '../auth0/users';
import * as auth from './auth';
import * as authtypes from '../auth0/auth-types';
import * as passphrases from '../auth0/passphrases';
import * as store from '../db/store';
import * as classdeleter from '../classdeleter';
import * as dblimits from '../db/limits';
import * as errors from './errors';
import * as urls from './urls';
import * as headers from './headers';
import * as notifications from '../notifications/slack';
import loggerSetup from '../utils/logger';
import { ClassTenantType } from '../db/db-types';

const log = loggerSetup();


const VALID_USERNAME = /^[A-Za-z0-9\-_]+$/;


function getStudents(req: Express.Request, res: Express.Response) {
    let studentgroup: string | undefined = authtypes.UNGROUPED_STUDENTS;
    if (req.query.group &&
        typeof req.query.group === 'string' &&
        req.query.group.trim().length > 0)
    {
        studentgroup = req.query.group.trim();
    }

    return auth0.getAllStudents(req.params.classid, studentgroup)
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
            return res.status(httpstatus.CONFLICT).json({ error : 'There is already a user with that username or email address' });
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
        const newstudent = await auth0.createStudent(tenant, req.body.username, req.body.group);
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
    if (!req.body.group || typeof req.body.group !== 'string' || req.body.group.trim().length === 0) {
        return res.status(httpstatus.BAD_REQUEST).json({ error : 'Missing required field "group"' });
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

    const group = req.body.group.trim();
    if (group === 'ALL' || group === 'ungrouped') {
        return res.status(httpstatus.BAD_REQUEST).json({ error : 'Unsupported group name' });
    }

    log.info({ prefix, tenant, number : req.body.number }, 'Creating multiple students');

    const successes: { id: string, username: string }[] = [];
    const duplicates: string[] = [];
    const failures: string[] = [];

    for (let idx = 1; idx <= req.body.number; idx++) {
        const username = prefix + idx;
        try {
            const newstudent = await auth0.createStudentWithPwd(tenant, username, password, group);
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

    let userPatch: UserPatch;
    try {
        userPatch = getUserPatch(req);
    }
    catch (err) {
        return res.status(httpstatus.BAD_REQUEST)
                  .json({
                      error : err.message,
                  });
    }

    if (userPatch.type === 'passwordreset') {
        return auth0.resetStudentsPassword(tenant, userPatch.userids)
            .then((password) => {
                res.json({ password });
            })
            .catch((err) => {
                res.status(err.statusCode)
                    .json(err);
            });
    }
    else if (userPatch.type === 'groupadd') {
        return auth0.addStudentsToGroup(tenant, userPatch.userids, userPatch.newgroup)
            .then(() => {
                return res.status(httpstatus.OK).json(userPatch);
            })
            .catch((err) => {
                res.status(err.statusCode)
                    .json(err);
            });
    }
    else if (userPatch.type === 'groupremove') {
        return auth0.addStudentsToGroup(tenant, userPatch.userids, authtypes.UNGROUPED_STUDENTS)
            .then(() => {
                return res.status(httpstatus.OK).json(userPatch);
            })
            .catch((err) => {
                res.status(err.statusCode)
                    .json(err);
            });
    }
    else {
        return res.status(httpstatus.BAD_REQUEST).json({ error : 'Unexpected request' });
    }
}


function modifyPolicy(req: Express.Request, res: Express.Response) {
    const tenant = req.params.classid;

    let patch: PolicyPatch;
    try {
        patch = getPolicyPatch(req);
    }
    catch (err) {
        return res.status(httpstatus.BAD_REQUEST)
                  .json({
                      error : err.message,
                  });
    }

    return store.modifyClassTenantExpiries(tenant, patch.textClassifierExpiry)
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


function modifyClass(req: Express.Request, res: Express.Response) {
    const tenant = req.params.classid;

    let patch: ClassPatch;
    try {
        patch = getClassPatch(req);
    }
    catch (err) {
        return res.status(httpstatus.BAD_REQUEST)
                  .json({
                      error : err.message,
                  });
    }

    if (patch.type === 'groupadd') {
        return auth0.addGroupToClass(tenant, patch.group)
            .then(() => { res.json({})})
            .catch((err) => {
                return errors.unknownError(res, err);
            });
    }
    else if (patch.type === 'groupdelete') {
        return auth0.removeGroupFromClass(tenant, patch.group)
            .then(() => { res.json({})})
            .catch((err) => {
                return errors.unknownError(res, err);
            });
    }
    else if (patch.type === 'studentdelete') {
        return classdeleter.deleteStudents(tenant, patch.studentids)
            .then((successes) => {
                return res.json({ deleted : successes.map((studentid) => { return { id : studentid }; }) });
            })
            .catch((err) => {
                return errors.unknownError(res, err);
            });
    }
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
    const reqWithUser = req as auth.RequestWithUser;

    const tenant = req.params.classid;

    try {
        const policy = await store.getClassTenant(tenant);

        // students can only see what type of projects they can create
        if (!reqWithUser.user ||
            !reqWithUser.user.app_metadata ||
            reqWithUser.user.app_metadata.role !== 'supervisor')
        {
            return res.set(headers.CACHE_1HOUR).json({
                supportedProjectTypes : policy.supportedProjectTypes,
            });
        }

        // teachers can also see other limitations,
        //  including restrictions that they can modify
        const storelimits = await dblimits.getStoreLimits();
        let availableCredentials;
        if (policy.tenantType === ClassTenantType.ManagedPool) {
            availableCredentials = { conv : 0, visrec : 0 };
        }
        else {
            availableCredentials = await store.countBluemixCredentialsByType(tenant);
        }
        const availableTextCredentials = availableCredentials.conv;

        return res.json({
            isManaged : policy.tenantType !== ClassTenantType.UnManaged,
            tenantType : policy.tenantType,

            maxTextModels : availableTextCredentials,

            maxUsers : policy.maxUsers,
            supportedProjectTypes : policy.supportedProjectTypes,
            maxProjectsPerUser : policy.maxProjectsPerUser,
            textClassifierExpiry : policy.textClassifierExpiry,

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


type UserPatch = PasswordResetPatch | GroupMembershipAdd | GroupMembershipRemove;

interface PasswordResetPatch {
    type: 'passwordreset';
    userids: string[];
}
interface GroupMembershipAdd {
    type: 'groupadd';
    newgroup: string;
    userids: string[];
}
interface GroupMembershipRemove {
    type: 'groupremove';
    userids: string[];
}


function getUserPatch(req: Express.Request): UserPatch {
    const patchRequests = req.body;

    // check we have a non-empty list of requests
    if (Array.isArray(patchRequests) === false) {
        throw new Error('PATCH body should be an array');
    }
    if (patchRequests.length === 0) {
        throw new Error('Invalid PATCH request (empty request)');
    }

    // check that all requests are the same type
    const paths = new Set();
    const ops = new Set();
    const groups = new Set();
    for (const patchRequest of patchRequests) {
        if (patchRequest.path === '/password' || patchRequest.path === '/group') {
            paths.add(patchRequest.path);
        }
        else {
            throw new Error('Invalid PATCH request (invalid path)');
        }

        if (patchRequest.op === 'replace' || patchRequest.op === 'remove') {
            ops.add(patchRequest.op);
        }
        else {
            throw new Error('Invalid PATCH request (invalid op)');
        }

        if (patchRequest.path === '/group' && patchRequest.op === 'replace') {
            if (patchRequest.value &&
                patchRequest.value.group &&
                typeof patchRequest.value.group === 'string' &&
                patchRequest.value.group.trim().length > 0 &&
                patchRequest.value.group.trim().length < 20 &&
                patchRequest.value.group !== authtypes.ALL_STUDENTS)
            {
                groups.add(patchRequest.value.group);
            }
            else {
                throw new Error('Invalid PATCH request (unsupported group)');
            }
        }
    }
    if (paths.size !== 1 || ops.size !== 1 || groups.size > 1) {
        throw new Error('Invalid PATCH request');
    }

    // consolidate requests into a single operation
    if (patchRequests[0].path === '/password') {
        return {
            type: 'passwordreset',
            userids: patchRequests.map((patchRequest: any) => {
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
                throw new Error('Invalid PATCH request (password reset)');
            }),
        };
    }
    else if (patchRequests[0].path === '/group') {
        if (patchRequests[0].op === 'replace') {
            return {
                type: 'groupadd',
                newgroup: patchRequests[0].value.group.trim(),
                userids: patchRequests.map((patchRequest: any) => {
                    if (patchRequest &&
                        patchRequest.op &&
                        patchRequest.path &&
                        patchRequest.value &&
                        patchRequest.op === 'replace' &&
                        patchRequest.path === '/group' &&
                        patchRequest.value.group &&
                        patchRequest.value.user)
                    {
                        return patchRequest.value.user;
                    }
                    throw new Error('Invalid PATCH request (group add)');
                })
            };
        }
        else if (patchRequests[0].op === 'remove') {
            return {
                type: 'groupremove',
                userids: patchRequests.map((patchRequest: any) => {
                    if (patchRequest &&
                        patchRequest.op &&
                        patchRequest.path &&
                        patchRequest.value &&
                        patchRequest.op === 'remove' &&
                        patchRequest.path === '/group' &&
                        patchRequest.value.user)
                    {
                        return patchRequest.value.user;
                    }
                    throw new Error('Invalid PATCH request (group remove)');
                })
            };
        }
    }

    throw new Error('Invalid PATCH request');
}


interface PolicyPatch {
    textClassifierExpiry: number;
}
type ClassPatch = ClassGroupAddPatch | ClassGroupRemovePatch | ClassStudentDeletesPatch;
interface ClassGroupAddPatch {
    type: 'groupadd';
    group: string;
}
interface ClassGroupRemovePatch {
    type: 'groupdelete';
    group: string;
}
interface ClassStudentDeletesPatch {
    type: 'studentdelete';
    studentids: string[];
}


function getPolicyPatch(req: Express.Request): PolicyPatch
{
    const patchRequests = req.body;

    if (Array.isArray(patchRequests) === false) {
        throw new Error('PATCH body should be an array');
    }
    if (patchRequests.length !== 1) {
        throw new Error('PATCH body should include 1 value');
    }

    const patch = {
        textClassifierExpiry : 0,
    };

    const patchRequest = patchRequests[0];
    if (patchRequest &&
        patchRequest.op &&
        patchRequest.path &&
        patchRequest.value &&
        patchRequest.op === 'replace' &&
        patchRequest.path === '/textClassifierExpiry')
    {
        patch.textClassifierExpiry = patchRequest.value;
    }
    else {
        throw new Error('Invalid PATCH request');
    }

    return patch;
}

function getClassPatch(req: Express.Request): ClassPatch
{
    const patchRequests = req.body;

    if (Array.isArray(patchRequests) === false) {
        throw new Error('PATCH body should be an array');
    }
    if (patchRequests.length === 0) {
        throw new Error('Invalid PATCH request (empty request)');
    }
    if (patchRequests.length === 1 &&
        patchRequests[0] &&
        patchRequests[0].op && patchRequests[0].path &&
        patchRequests[0].value && typeof patchRequests[0].value === 'string' &&
        patchRequests[0].value !== 'ALL' &&
        patchRequests[0].value !== 'ungrouped' &&
        patchRequests[0].path === '/groups')
    {
        if (patchRequests[0].op === 'add') {
            return {
                type : 'groupadd',
                group : patchRequests[0].value,
            };
        }
        else if (patchRequests[0].op === 'remove') {
            return {
                type : 'groupdelete',
                group : patchRequests[0].value,
            };
        }
    }

    const studentids: string[] = [];
    for (const deleteRequest of patchRequests) {
        if (deleteRequest &&
            deleteRequest.op === 'remove' &&
            deleteRequest.path === '/students' &&
            deleteRequest.value && deleteRequest.value.user && deleteRequest.value.user.id &&
            typeof deleteRequest.value.user.id === 'string')
        {
            studentids.push(deleteRequest.value.user.id);
        }
        else {
            throw new Error('Invalid delete user PATCH');
        }
    }
    if (studentids.length > 40) {
        throw new Error('Maximum of 40 students can be deleted at a time');
    }
    return {
        type : 'studentdelete',
        studentids,
    };
}





function generatePassword(req: Express.Request, res: Express.Response) {
    res.json({ password : passphrases.generate() });
}



export default function registerApis(app: Express.Application) {

    app.get(urls.TENANT_POLICY,
        auth.authenticate,
        auth.checkValidUser,
        getPolicy);

    app.patch(urls.TENANT_POLICY,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        modifyPolicy);

    app.patch(urls.CLASS,
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
