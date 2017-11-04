// external dependencies
import * as Express from 'express';
import * as httpstatus from 'http-status';
import * as rangeParse from 'http-range-parse';
// local dependencies
import * as auth from './auth';
import * as store from '../db/store';
import * as Objects from '../db/db-types';
import * as errors from './errors';
import * as headers from './headers';
import * as imageCheck from '../utils/imageCheck';
import loggerSetup from '../utils/logger';

const log = loggerSetup();



function getPagingOptions(req: Express.Request): Objects.PagingOptions {
    let start: number = 0;
    let limit: number = 50;

    try {
        const rangeStr = req.header('range');
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




async function getTraining(req: auth.RequestWithProject, res: Express.Response) {
    const options: Objects.PagingOptions = getPagingOptions(req);

    try {
        let training: any[] = [];
        const count = await store.countTraining(req.project.type, req.project.id);

        switch (req.project.type) {
        case 'text':
            training = await store.getTextTraining(req.project.id, options);
            break;
        case 'numbers':
            training = await store.getNumberTraining(req.project.id, options);
            break;
        case 'images':
            training = await store.getImageTraining(req.project.id, options);
            break;
        }

        res.set('Content-Range',
            generatePagingResponse(options.start, training, count));

        res.set(headers.NO_CACHE);

        res.json(training);
    }
    catch (err) {
        errors.unknownError(res, err);
    }
}


async function getLabels(req: auth.RequestWithProject, res: Express.Response) {
    try {
        const counts = await store.countTrainingByLabel(req.project.type, req.project.id);

        res.set(headers.NO_CACHE).json(counts);
    }
    catch (err) {
        errors.unknownError(res, err);
    }
}


function editLabel(req: auth.RequestWithProject, res: Express.Response) {
    const before: string = req.body.before;
    const after: string = req.body.after;

    if (!before || !after) {
        return errors.missingData(res);
    }

    return store.renameTrainingLabel(req.project.type, req.project.id, before, after)
        .then(() => {
            res.sendStatus(httpstatus.OK);
        })
        .catch((err) => {
            errors.unknownError(res, err);
        });
}


function deleteTraining(req: auth.RequestWithProject, res: Express.Response) {
    const trainingid: string = req.params.trainingid;

    return store.deleteTraining(req.project.type, req.project.id, trainingid)
        .then(() => {
            res.sendStatus(httpstatus.NO_CONTENT);
        })
        .catch((err) => {
            errors.unknownError(res, err);
        });
}


async function storeTraining(req: auth.RequestWithProject, res: Express.Response) {
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
            training = await store.storeNumberTraining(req.project.id, data, label);
            break;
        case 'images':
            await imageCheck.verifyImage(data);
            training = await store.storeImageTraining(req.project.id, data, label);
            break;
        }

        res.status(httpstatus.CREATED).json(training);
    }
    catch (err) {
        if (err.message === 'Text exceeds maximum allowed length (1024 characters)' ||
            err.message === 'Number of data items exceeded maximum' ||
            err.message === 'Data contains non-numeric items' ||
            err.message === 'Missing required attributes' ||
            err.message.startsWith('Unsupported file type') ||
            err.message.startsWith('Unable to download image from '))
        {
            return res.status(httpstatus.BAD_REQUEST).json({ error : err.message });
        }
        else if (err.message === 'Project already has maximum allowed amount of training data') {
            return res.status(httpstatus.CONFLICT).json({ error : err.message });
        }

        errors.unknownError(res, err);
    }
}



export default function registerApis(app: Express.Application) {
    app.get('/api/classes/:classid/students/:studentid/projects/:projectid/training',
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectAccess,
            getTraining);

    app.get('/api/classes/:classid/students/:studentid/projects/:projectid/labels',
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectAccess,
            getLabels);

    app.put('/api/classes/:classid/students/:studentid/projects/:projectid/labels',
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectAccess,
            editLabel);

    app.delete('/api/classes/:classid/students/:studentid/projects/:projectid/training/:trainingid',
               auth.authenticate,
               auth.checkValidUser,
               auth.verifyProjectAccess,
               deleteTraining);

    app.post('/api/classes/:classid/students/:studentid/projects/:projectid/training',
             auth.authenticate,
             auth.checkValidUser,
             auth.verifyProjectAccess,
             storeTraining);
}
