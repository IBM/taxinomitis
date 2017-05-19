// external dependencies
import * as Express from 'express';
import * as httpstatus from 'http-status';
import * as rangeParse from 'http-range-parse';
// local dependencies
import * as auth from './auth';
import * as store from '../db/store';
import * as Objects from '../db/db-types';
import * as errors from './errors';
import loggerSetup from '../utils/logger';

const log = loggerSetup();



interface RequestWithProject extends Express.Request {
    project: Objects.Project;
}


function getPagingOptions(req: Express.Request): Objects.PagingOptions {
    let start: number = 0;
    let limit: number = 50;

    try {
        const rangeStr: string = req.header('range');
        if (rangeStr) {
            const range = rangeParse(rangeStr);
            if (range && range.unit === 'items'){
                start = range.first;
                limit = range.last - start + 1;

                limit = isNaN(limit) === false && limit > 0 ? limit : 0;
            }
        }
    }
    catch (err) {
        log.error({ err }, 'Failed to parse paging options');
    }

    return { start, limit };
}

function generatePagingResponse(start: number, items: any[], count: number): string {
    return 'items ' + start + '-' + (start + items.length - 1) + '/' + count;
}


async function verifyProjectAccess(req: Express.Request, res: Express.Response, next) {
    const userid: string = req.params.studentid;
    const projectid: string = req.params.projectid;

    try {
        const project = await store.getProject(projectid);
        if (!project) {
            return errors.notFound(res);
        }
        if (project.userid !== userid) {
            return errors.forbidden(res);
        }

        const modifiedRequest: RequestWithProject = req as RequestWithProject;
        modifiedRequest.project = project;

        next();
    }
    catch (err) {
        return next(err);
    }
}



async function getTraining(req: RequestWithProject, res: Express.Response) {
    const options: Objects.PagingOptions = getPagingOptions(req);

    try {
        let training = [];
        let count = 0;

        switch (req.project.type) {
        case 'text':
            training = await store.getTextTraining(req.project.id, options);
            count = await store.countTextTraining(req.project.id);
            break;
        case 'numbers':
        case 'images':
            // TODO not implemented yet
            break;
        }

        res.set('Content-Range',
            generatePagingResponse(options.start, training, count));

        res.json(training);
    }
    catch (err) {
        errors.unknownError(res, err);
    }
}


async function getLabels(req: RequestWithProject, res: Express.Response) {
    try {
        const counts = await store.countTextTrainingByLabel(req.project.id);
        res.json(counts);
    }
    catch (err) {
        errors.unknownError(res, err);
    }
}


async function editLabel(req: RequestWithProject, res: Express.Response) {
    const before: string = req.body.before;
    const after: string = req.body.after;

    if (!before || !after) {
        return errors.missingData(res);
    }

    try {
        await store.renameTextTrainingLabel(req.project.id, before, after);

        res.sendStatus(httpstatus.OK);
    }
    catch (err) {
        errors.unknownError(res, err);
    }
}


async function deleteTraining(req: RequestWithProject, res: Express.Response) {
    const trainingid: string = req.params.trainingid;

    try {
        await store.deleteTextTraining(req.project.id, trainingid);

        res.sendStatus(httpstatus.NO_CONTENT);
    }
    catch (err) {
        errors.unknownError(res, err);
    }
}


async function storeTraining(req: RequestWithProject, res: Express.Response) {
    try {
        const data = req.body.data;
        const label = req.body.label;

        if (!data) {
            return errors.missingData(res);
        }

        let training;

        switch (req.project.type) {
        case 'text':
            training = await store.storeTextTraining(req.project.id, data, label);
            break;
        case 'numbers':
        case 'images':
            return res.sendStatus(httpstatus.NOT_IMPLEMENTED);
        }

        res.status(httpstatus.CREATED).json(training);
    }
    catch (err) {
        errors.unknownError(res, err);
    }
}



export default function registerApis(app: Express.Application) {
    app.get('/api/classes/:classid/students/:studentid/projects/:projectid/training',
            auth.authenticate,
            auth.checkValidUser,
            verifyProjectAccess,
            getTraining);

    app.get('/api/classes/:classid/students/:studentid/projects/:projectid/labels',
            auth.authenticate,
            auth.checkValidUser,
            verifyProjectAccess,
            getLabels);

    app.put('/api/classes/:classid/students/:studentid/projects/:projectid/labels',
            auth.authenticate,
            auth.checkValidUser,
            verifyProjectAccess,
            editLabel);

    app.delete('/api/classes/:classid/students/:studentid/projects/:projectid/training/:trainingid',
               auth.authenticate,
               auth.checkValidUser,
               verifyProjectAccess,
               deleteTraining);

    app.post('/api/classes/:classid/students/:studentid/projects/:projectid/training',
             auth.authenticate,
             auth.checkValidUser,
             verifyProjectAccess,
             storeTraining);
}
