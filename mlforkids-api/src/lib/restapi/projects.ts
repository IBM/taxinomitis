// external dependencies
import * as Express from 'express';
import * as httpstatus from 'http-status';
// local dependencies
import * as auth from './auth';
import * as store from '../db/store';
import * as Objects from '../db/db-types';
import * as dbobjects from '../db/objects';
import * as datasets from '../datasets';
import * as users from '../auth0/users';
import * as Users from '../auth0/auth-types';
import * as urls from './urls';
import * as sound from '../training/sound';
import * as errors from './errors';
import * as headers from './headers';
import loggerSetup from '../utils/logger';

const log = loggerSetup();


interface ProjectWithOwner extends Objects.Project {
    owner?: Users.Student;
    hasModel?: boolean;
    classifierId?: string;
}



function getProjectsByClassId(req: Express.Request, res: Express.Response) {
    const classid: string = req.params.classid;

    const responsePromises: [Promise<{[id: string]: Users.Student }>,
                             Promise<Objects.Project[]>,
                             Promise<{[projectid: string]: string}>] =
        [
            users.getStudentsByUserId(classid),
            store.getProjectsByClassId(classid),
            store.getProjectsWithBluemixClassifiers(classid),
        ];

    Promise.all(responsePromises)
        .then((response) => {
            const students = response[0];
            const projects = response[1];
            const projectIdsWithModels = response[2];

            const ownedProjects: ProjectWithOwner[] = projects.map((project) => {
                const ownedProject: ProjectWithOwner = project;
                ownedProject.owner = students[project.userid];

                if (projectIdsWithModels[project.id]) {
                    ownedProject.hasModel = true;
                    ownedProject.classifierId = projectIdsWithModels[project.id];
                }
                else {
                    ownedProject.hasModel = false;
                }

                return ownedProject;
            });

            return res.json(ownedProjects);
        })
        .catch((err) => {
            log.error({ err, func : 'getProjectsByClassId' }, 'Server error');
            errors.unknownError(res, err);
        });
}


function getProjectsByUserId(req: Express.Request, res: Express.Response) {
    const classid: string = req.params.classid;
    const userid: string = req.params.studentid;

    store.getProjectsByUserId(userid, classid)
        .then((projects: Objects.Project[]) => {
            res.set(headers.NO_CACHE).json(projects);
        })
        .catch((err) => {
            log.error({ err, func : 'getProjectsByUserId' }, 'Server error');
            errors.unknownError(res, err);
        });
}


/**
 * This could be creating a new empty project, or creating a project based
 *  on a pre-prepared dataset of training data.
 */
async function createProject(req: auth.RequestWithUser, res: Express.Response) {
    const classid: string = req.params.classid;
    const userid: string = req.params.studentid;

    let isImport = false;

    // percentage of the training data that should be excluded for
    //  use in testing
    let testratio = 0;

    //
    // Quick sanity check that the request looks to have the right
    //  values in it.
    //

    if (req.body && req.body.dataset && req.body.type) {
        // assume we're being asked to create a project
        //  based on a pre-existing set of training data
        isImport = true;

        // how much of the dataset should be imported?
        if (req.body.testratio) {
            if (Number.isInteger(req.body.testratio) &&
                req.body.testratio >= 0 &&
                req.body.testratio <= 100)
            {
                testratio = req.body.testratio;
            }
            else {
                return res.status(httpstatus.BAD_REQUEST)
                        .send({ error : 'Test ratio must be an integer between 0 and 100' });
            }
        }
    }
    else {
        // otherwise assume we're creating a new empty project

        if (!req.body || !req.body.type || !req.body.name) {
            return res.status(httpstatus.BAD_REQUEST)
                    .send({ error : 'Missing required field' });
        }
        if (dbobjects.VALID_PROJECT_NAME.test(req.body.name) === false) {
            return res.status(httpstatus.BAD_REQUEST)
                    .send({ error : 'Invalid project name' });
        }
        if (req.body.type === 'text' && !req.body.language) {
            return res.status(httpstatus.BAD_REQUEST)
                    .send({ error : 'Missing required field' });
        }
    }


    //
    // Regardless of what type of project we're creating, we
    //  check that the student is allowed to create a new
    //  project of this type
    //

    const numProjects = await store.countProjectsByUserId(userid, classid);
    const tenantPolicy = await store.getClassTenant(classid);

    if (numProjects >= tenantPolicy.maxProjectsPerUser) {
        return res.status(httpstatus.CONFLICT)
                  .send({ error : 'User already has maximum number of projects' });
    }
    if (tenantPolicy.supportedProjectTypes.indexOf(req.body.type) === -1) {
        return res.status(httpstatus.FORBIDDEN)
                  .send({ error : 'Support for ' + req.body.type + ' projects is not enabled for your class' });
    }

    // only teachers are allowed to create crowdsourced projects
    let crowdsourced: boolean = false;
    if (req.body.isCrowdSourced) {
        if (req.user.app_metadata.role !== 'supervisor') {
            return res.status(httpstatus.FORBIDDEN)
                      .send({ error : 'Only teachers or group leaders can create crowd-sourced projects' });
        }
        else {
            crowdsourced = true;
        }
    }


    //
    // The request looks okay, so we'll try and create it
    //  (More checking will be performed, so there is still a chance
    //   of a http-400 bad-request error being thrown, but we've
    //   decided to at least attempt)
    //

    try {
        let project;
        if (isImport) {
            const opts = { crowdsourced, testratio };
            project = await datasets.importDataset(userid, classid, opts,
                                                   req.body.type,
                                                   req.body.dataset);
        }
        else {
            project = await store.storeProject(userid, classid,
                                               req.body.type,
                                               req.body.name,
                                               req.body.language,
                                               req.body.fields,
                                               crowdsourced);
        }

        if (project.type === 'sounds') {
            await store.addLabelToProject(userid, classid, project.id, sound.BACKGROUND_NOISE);
        }
        return res.status(httpstatus.CREATED).json(project);
    }
    catch (err) {
        if (err.statusCode === httpstatus.BAD_REQUEST) {
            return res.status(httpstatus.BAD_REQUEST).json({ error : err.message });
        }
        log.error({ err, func : 'createProject', request : req.body }, 'Server error');
        errors.unknownError(res, err);
    }
}


function getProject(req: auth.RequestWithProject, res: Express.Response) {
    return res.set(headers.NO_CACHE).json(req.project);
}


function getProjectFields(req: Express.Request, res: Express.Response) {
    const classid: string = req.params.classid;
    const userid: string = req.params.studentid;
    const projectid: string = req.params.projectid;

    return store.getNumberProjectFields(userid, classid, projectid)
        .then((fields: Objects.NumbersProjectField[]) => {
            if (fields && fields.length > 0) {
                return res.set(headers.NO_CACHE).json(fields);
            }
            else {
                return errors.notFound(res);
            }
        })
        .catch((err) => {
            log.error({ err, func : 'getProjectFields' }, 'Server error');
            errors.unknownError(res, err);
        });
}



async function deleteProject(req: auth.RequestWithProject, res: Express.Response) {
    const classid = req.params.classid;
    const userid = req.params.studentid;
    const projectid = req.params.projectid;

    try {
        const project: Objects.Project = req.project;

        // if this is an images or sounds project, schedule a job to
        //  clean up any usage of the S3 Object Store by training data
        if (project.type === 'images' || project.type === 'sounds' || project.type === 'imgtfjs') {
            await store.storeDeleteProjectObjectsJob(classid, userid, projectid);
        }

        await store.deleteEntireProject(userid, classid, project);
        return res.sendStatus(httpstatus.NO_CONTENT);
    }
    catch (err) {
        log.error({ err, func : 'deleteProject' }, 'Server error');
        errors.unknownError(res, err);
    }
}



type ExpectedProjectPatches = 'labels' | 'isCrowdSourced' | 'type';



function getProjectPatch(req: Express.Request, expected: ExpectedProjectPatches[]) {
    const patchRequests = req.body;

    if (Array.isArray(patchRequests) === false) {
        throw new Error('PATCH body should be an array');
    }

    if (patchRequests.length !== 1) {
        throw new Error('Only individual PATCH requests are supported');
    }

    const patchRequest = patchRequests[0];

    if (!patchRequest.op) {
        throw new Error('PATCH requests must include an op');
    }
    const op: string = patchRequest.op;

    if (!('value' in patchRequest)) {
        throw new Error('PATCH requests must include a value');
    }
    let value = patchRequest.value;

    const path: string = patchRequest.path;

    if (path === '/labels' && expected.includes('labels')) {
        if (op === 'add' || op === 'remove') {
            if (typeof value !== 'string') {
                throw new Error('PATCH requests to add or remove a label should specify a string');
            }
            value = value.trim();
            if (value.length === 0) {
                throw new Error('Cannot add an empty label');
            }
            if (value.length > Objects.MAX_LABEL_LENGTH) {
                throw new Error('Label exceeds max length');
            }
        }
        else if (op === 'replace') {
            if (Array.isArray(value) === false) {
                throw new Error('PATCH requests to replace labels should specify an array');
            }
            value = value.map((item: any) => item.toString().trim())
                        .filter((item: any) => item);

            for (const item of value) {
                if (item.length > Objects.MAX_LABEL_LENGTH) {
                    throw new Error('Label exceeds max length');
                }
            }
        }
        else {
            throw new Error('Invalid PATCH op');
        }

        return { op, value, path };
    }
    else if (path === '/type' && expected.includes('type')) {
        if (op === 'replace' && typeof value === 'string' &&
            (value === 'images' || value === 'imgtfjs'))
        {
            return { op, value, path };
        }
        else {
            throw new Error('Invalid PATCH op');
        }
    }
    else if (path === '/isCrowdSourced' && expected.includes('isCrowdSourced')) {
        if (op === 'replace' && typeof value === 'boolean') {
            return { op, value, path };
        }
        else {
            throw new Error('Invalid PATCH op');
        }
    }
    else {
        throw new Error('Only modifications to project ' + expected.join(' or ') + ' are supported');
    }
}


async function deleteImages(classid: string, userid: string, projectid: string, label: string): Promise<void> {
    const imagesToDelete = await store.getStoredImageTraining(projectid, label);
    for (const imageToDelete of imagesToDelete) {
        await store.storeDeleteObjectJob(classid, userid, projectid, imageToDelete.id);
    }
}


async function modifyProject(req: Express.Request, res: Express.Response) {
    const classid = req.params.classid;
    const userid = req.params.studentid;
    const projectid = req.params.projectid;

    let patch;
    try {
        patch = getProjectPatch(req, ['labels', 'type']);
    }
    catch (err) {
        return res.status(httpstatus.BAD_REQUEST)
                  .json({
                      error : err.message,
                  });
    }

    try {
        let response: string[];

        if (patch.path === '/labels') {
            switch (patch.op) {
            case 'add':
                response = await store.addLabelToProject(userid, classid, projectid, patch.value);
                break;
            case 'remove':
                // delete anything with the label from the S3 Object Store
                await deleteImages(classid, userid, projectid, patch.value);
                // delete anything with the label from the DB
                response = await store.removeLabelFromProject(userid, classid, projectid, patch.value);
                break;
            case 'replace':
                response = await store.replaceLabelsForProject(userid, classid, projectid, patch.value);
                break;
            default:
                response = [];
            }
        }
        else {
            return errors.missingData(res);
        }

        res.json(response);
    }
    catch (err) {
        if (err.message === 'No room for the label') {
            return res.status(httpstatus.BAD_REQUEST).json({ error : err.message });
        }
        log.error({ err, func : 'modifyProject' }, 'Server error');
        return errors.unknownError(res, err);
    }
}


async function shareProject(req: auth.RequestWithProject, res: Express.Response) {
    const classid = req.params.classid;
    const userid = req.params.studentid;
    const projectid = req.params.projectid;

    try {
        const project: Objects.Project = req.project;

        let patch;
        try {
            patch = getProjectPatch(req, ['isCrowdSourced']);
        }
        catch (err) {
            return res.status(httpstatus.BAD_REQUEST)
                      .json({
                          error : err.message,
                      });
        }

        if (project.isCrowdSourced === patch.value) {
            return res.status(httpstatus.CONFLICT).json({ error : 'isCrowdSourced already set' });
        }

        await store.updateProjectCrowdSourced(userid, classid, projectid, patch.value);
        return res.sendStatus(httpstatus.NO_CONTENT);
    }
    catch (err) {
        log.error({ err, func : 'shareProject' }, 'Server error');
        return errors.unknownError(res, err);
    }
}



export default function registerApis(app: Express.Application) {

    app.get(urls.ALL_CLASS_PROJECTS,
            auth.authenticate,
            auth.checkValidUser,
            auth.requireSupervisor,
            getProjectsByClassId);

    app.get(urls.PROJECTS,
            auth.authenticate,
            auth.checkValidUser,
            getProjectsByUserId);

    app.post(urls.PROJECTS,
            auth.authenticate,
            auth.checkValidUser,
            // @ts-ignore
            createProject);

    app.get(urls.PROJECT,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectAccessOrTeacher,
            // @ts-ignore
            getProject);

    app.get(urls.FIELDS,
            auth.authenticate,
            auth.checkValidUser,
            getProjectFields);

    app.delete(urls.PROJECT,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectOwner,
            // @ts-ignore
            deleteProject);

    app.patch(urls.PROJECT,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectOwner,
            modifyProject);

    app.patch(urls.PROJECT_CROWDSOURCED,
            auth.authenticate,
            auth.checkValidUser,
            auth.requireSupervisor,
            auth.verifyProjectOwner,
            // @ts-ignore
            shareProject);
}
