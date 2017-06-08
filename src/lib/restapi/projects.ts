// external dependencies
import * as util from 'util';
import * as Express from 'express';
import * as httpstatus from 'http-status';
// local dependencies
import * as auth from './auth';
import * as store from '../db/store';
import * as Objects from '../db/db-types';
import * as errors from './errors';
import loggerSetup from '../utils/logger';


const log = loggerSetup();


function getProjectsByClassId(req: Express.Request, res: Express.Response) {
    const classid: string = req.params.classid;

    store.getProjectsByClassId(classid)
        .then((projects: Objects.Project[]) => {
            res.json(projects);
        })
        .catch((err) => {
            log.error({ err }, 'Server error');
            errors.unknownError(res, err);
        });
}


function getProjectsByUserId(req: Express.Request, res: Express.Response) {
    const classid: string = req.params.classid;
    const userid: string = req.params.studentid;

    store.getProjectsByUserId(userid, classid)
        .then((projects: Objects.Project[]) => {
            res.json(projects);
        })
        .catch((err) => {
            log.error({ err }, 'Server error');
            errors.unknownError(res, err);
        });
}


async function createProject(req: Express.Request, res: Express.Response) {
    const classid: string = req.params.classid;
    const userid: string = req.params.studentid;

    if (!req.body || !req.body.type || !req.body.name) {
        return res.status(httpstatus.BAD_REQUEST)
                  .send({ error : 'Missing required field' });
    }

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


    try {
        const project = await store.storeProject(userid, classid, req.body.type, req.body.name);
        return res.status(httpstatus.CREATED).json(project);
    }
    catch (err) {
        log.error({ err }, 'Server error');
        errors.unknownError(res, err);
    }
}


function getProject(req: Express.Request, res: Express.Response) {
    const classid: string = req.params.classid;
    const userid: string = req.params.studentid;
    const projectid: string = req.params.projectid;

    return store.getProject(projectid)
        .then((project: Objects.Project) => {
            if (project) {
                if (project.classid === classid && project.userid === userid) {
                    return res.json(project);
                }
                else {
                    return errors.forbidden(res);
                }
            }
            else {
                return errors.notFound(res);
            }
        })
        .catch((err) => {
            log.error({ err }, 'Server error');
            errors.unknownError(res, err);
        });
}


async function deleteProject(req: Express.Request, res: Express.Response) {
    const classid = req.params.classid;
    const userid = req.params.studentid;
    const projectid = req.params.projectid;

    try {
        const project: Objects.Project = await store.getProject(projectid);

        if (project) {
            if (project.classid === classid && project.userid === userid) {
                await store.deleteEntireProject(userid, classid, projectid);
                return res.sendStatus(httpstatus.NO_CONTENT);
            }
            else {
                return errors.forbidden(res);
            }
        }
        else {
            return errors.notFound(res);
        }
    }
    catch (err) {
        log.error({ err }, 'Server error');
        errors.unknownError(res, err);
    }
}


function getProjectPatch(req: Express.Request) {
    const patchRequests = req.body;

    if (util.isArray(patchRequests) === false) {
        throw new Error('PATCH body should be an array');
    }

    if (patchRequests.length !== 1) {
        throw new Error('Only individual PATCH requests are supported');
    }

    const patchRequest = patchRequests[0];

    if (patchRequest.path !== '/labels') {
        throw new Error('Only modifications to project labels are supported');
    }

    if (!patchRequest.op) {
        throw new Error('PATCH requests must include an op');
    }
    const op: string = patchRequest.op;
    if (['add', 'remove', 'replace'].includes(op) === false) {
        throw new Error('Invalid PATCH op');
    }

    if (!patchRequest.value) {
        throw new Error('PATCH requests must include a value');
    }
    let value = patchRequest.value;
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
        if (util.isArray(value) === false) {
            throw new Error('PATCH requests to replace labels should specify an array');
        }
        value = value.map((item) => item.toString().trim())
                     .filter((item) => item);

        for (const item of value) {
            if (item.length > Objects.MAX_LABEL_LENGTH) {
                throw new Error('Label exceeds max length');
            }
        }
    }

    return { op, value };
}


async function modifyProject(req: Express.Request, res: Express.Response) {
    const classid = req.params.classid;
    const userid = req.params.studentid;
    const projectid = req.params.projectid;

    let patch;
    try {
        patch = getProjectPatch(req);
    }
    catch (err) {
        return res.status(httpstatus.BAD_REQUEST)
                  .send({
                      error : 'Invalid patch request',
                      detail : err.message,
                  });
    }

    try {
        let response: string[];

        switch (patch.op) {
        case 'add':
            response = await store.addLabelToProject(userid, classid, projectid, patch.value);
            break;
        case 'remove':
            response = await store.removeLabelFromProject(userid, classid, projectid, patch.value);
            break;
        case 'replace':
            response = await store.replaceLabelsForProject(userid, classid, projectid, patch.value);
            break;
        }

        res.json(response);
    }
    catch (err) {
        log.error({ err }, 'Server error');
        return errors.unknownError(res, err);
    }
}



export default function registerApis(app: Express.Application) {
    app.get('/api/classes/:classid/projects',
            auth.authenticate,
            auth.checkValidUser,
            auth.requireSupervisor,
            getProjectsByClassId);

    app.get('/api/classes/:classid/students/:studentid/projects',
            auth.authenticate,
            auth.checkValidUser,
            getProjectsByUserId);

    app.post('/api/classes/:classid/students/:studentid/projects',
            auth.authenticate,
            auth.checkValidUser,
            createProject);

    app.get('/api/classes/:classid/students/:studentid/projects/:projectid',
            auth.authenticate,
            auth.checkValidUser,
            getProject);

    app.delete('/api/classes/:classid/students/:studentid/projects/:projectid',
            auth.authenticate,
            auth.checkValidUser,
            deleteProject);

    app.patch('/api/classes/:classid/students/:studentid/projects/:projectid',
            auth.authenticate,
            auth.checkValidUser,
            modifyProject);
}
