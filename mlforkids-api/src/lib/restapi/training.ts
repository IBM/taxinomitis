// external dependencies
import * as Express from 'express';
import * as httpstatus from 'http-status';
import * as rangeParse from 'http-range-parse';
// local dependencies
import * as auth from './auth';
import * as store from '../db/store';
import * as Objects from '../db/db-types';
import * as urls from './urls';
import * as errors from './errors';
import * as headers from './headers';
import * as visrec from '../training/visualrecognition';
import * as imageCheck from '../utils/imageCheck';
import * as imageDownload from '../utils/download';
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
        case 'imgtfjs':
            training = await store.getImageTraining(req.project.id, options);
            break;
        case 'sounds':
            training = await store.getSoundTraining(req.project.id, options);
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


function getTrainingItem(req: auth.RequestWithProject, res: Express.Response) {
    if (req.project.type !== 'imgtfjs') {
        return res.status(httpstatus.BAD_REQUEST).json({ error : 'Only supported for image projects' });
    }

    return visrec.getTrainingItemData(req.project, req.params.trainingid)
        .then((trainingdata) => {
            res.set(headers.CACHE_1YEAR);
            res.send(trainingdata);
        })
        .catch((err) => {
            if (err.message && err.message.startsWith(imageDownload.ERRORS.DOWNLOAD_FAIL)) {
                return res.status(httpstatus.CONFLICT)
                        .send({
                            code : 'MLMOD12',
                            error : 'One of your training images could not be downloaded',
                            location : err.location,
                        });
            }
            else if (err.message === imageDownload.ERRORS.DOWNLOAD_FILETYPE_UNSUPPORTED) {
                return res.status(httpstatus.CONFLICT)
                        .send({
                            code : 'MLMOD13',
                            error : 'One of your training images is a type that cannot be used',
                            location : err.location,
                        });
            }
            else if (err.message === 'Training data not found') {
                return errors.notFound(res);
            }

            return errors.unknownError(res, err);
        });
}


async function getLabels(req: auth.RequestWithProject, res: Express.Response) {
    try {
        const counts = await store.countTrainingByLabel(req.project);

        const labelCounts: { [label: string]: number } = {};
        for (const label of req.project.labels) {
            labelCounts[label] = (label in counts) ? counts[label] : 0;
        }

        res.set(headers.NO_CACHE).json(labelCounts);
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


async function deleteTraining(req: auth.RequestWithProject, res: Express.Response) {
    const trainingid: string = req.params.trainingid;

    if (req.project.type === 'images' || req.project.type === 'imgtfjs') {
        const inImageStore = await store.isImageStored(trainingid);
        if (inImageStore) {
            store.storeDeleteObjectJob(req.params.classid,
                                       req.params.studentid,
                                       req.params.projectid,
                                       trainingid);
        }
    }
    else if (req.project.type === 'sounds') {
        store.storeDeleteObjectJob(req.params.classid,
                                   req.params.studentid,
                                   req.params.projectid,
                                   trainingid);
    }

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
            if (!Array.isArray(data) || data.length !== req.project.numfields) {
                return errors.missingData(res);
            }
            training = await store.storeNumberTraining(req.project.id, req.project.isCrowdSourced, data, label);
            break;
        case 'images':
            await imageCheck.verifyImage(data, visrec.getMaxImageFileSize());
            training = await store.storeImageTraining(req.project.id, data, label, false);
            break;
        case 'imgtfjs':
            await imageCheck.verifyImage(data, visrec.getMaxImageFileSize());
            training = await store.storeImageTraining(req.project.id, data, label, false);
            break;
        case 'sounds':
            // should be uploaded via the object store URL
            return errors.notImplemented(res);
        }

        res.status(httpstatus.CREATED).json(training);
    }
    catch (err) {
        if (err.message && typeof err.message === 'string' &&
            (
            err.message === 'Text exceeds maximum allowed length (1024 characters)' ||
            err.message === 'Empty text is not allowed' ||
            err.message === 'Number of data items exceeded maximum' ||
            err.message === 'Data contains non-numeric items' ||
            err.message === 'Number is too small' ||
            err.message === 'Number is too big' ||
            err.message === 'Missing required attributes' ||
            err.message === imageCheck.ERROR_PREFIXES.INVALID_URL ||
            err.message.startsWith(imageCheck.ERROR_PREFIXES.BAD_TYPE) ||
            err.message.startsWith('Unable to download image from ') ||
            err.message.startsWith(imageCheck.ERROR_PREFIXES.TOO_BIG) ||
            err.message.includes(imageDownload.ERRORS.DOWNLOAD_FORBIDDEN) ||
            err.message.includes(imageDownload.ERRORS.DOWNLOAD_TOO_MANY_REQUESTS)
            ))
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
    app.get(urls.TRAININGITEMS,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectAccessOrTeacher,
            // @ts-ignore
            getTraining);

    app.get(urls.LABELS,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectAccessOrTeacher,
            // @ts-ignore
            getLabels);

    app.put(urls.LABELS,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectOwner,
            // @ts-ignore
            editLabel);

    app.get(urls.TRAININGITEM,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectAccess,
            // @ts-ignore
            getTrainingItem);

    app.delete(urls.TRAININGITEM,
               auth.authenticate,
               auth.checkValidUser,
               auth.verifyProjectAccess,
               // @ts-ignore
               deleteTraining);

    app.post(urls.TRAININGITEMS,
             auth.authenticate,
             auth.checkValidUser,
             auth.verifyProjectAccess,
             // @ts-ignore
             storeTraining);
}
