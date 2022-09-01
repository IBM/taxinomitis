// external dependencies
import * as Express from 'express';
import * as httpstatus from 'http-status';
import * as cors from 'cors';
// local dependencies
import * as store from '../db/store';
import * as Types from '../db/db-types';
import * as limits from '../db/limits';
import * as objectstore from '../objectstore';
import * as errors from './errors';
import * as auth from './auth';
import * as extensions from '../scratchx/extensions';
import * as scratchtfjs from '../scratchx/scratchtfjs';
import * as models from '../scratchx/models';
import * as status from '../scratchx/status';
import * as keys from '../scratchx/keys';
import * as classifier from '../scratchx/classify';
import * as training from '../scratchx/training';
import * as conversation from '../training/conversation';
import * as visrec from '../training/visualrecognition';
import * as urls from './urls';
import * as headers from './headers';
import * as env from '../utils/env';
import loggerSetup from '../utils/logger';

const log = loggerSetup();






async function getScratchKeys(req: Express.Request, res: Express.Response) {
    const classid: string = req.params.classid;
    const userid: string = req.params.studentid;
    const projectid: string = req.params.projectid;

    try {
        const scratchKeys = await store.findScratchKeys(userid, projectid, classid);

        if (scratchKeys.length === 0) {
            const newKeyInfo = await keys.createKey(projectid);
            return res.set(headers.NO_CACHE).json([ newKeyInfo ]);
        }

        return res.set(headers.NO_CACHE).json(scratchKeys.map((key) => {
            return {
                id : key.id,
                model : key.classifierid,
            };
        }));
    }
    catch (err) {
        log.error({ err }, 'Failed to get keys');
        errors.unknownError(res, err);
    }
}





async function classifyWithScratchKey(req: Express.Request, res: Express.Response) {
    const apikey = req.params.scratchkey;

    try {
        if (!req.query.data) {
            log.warn({
                agent : req.header('X-User-Agent'),
                key : apikey,
                func : 'classifyWithScratchKey',
            }, 'Missing data');
            throw new Error('Missing data');
        }

        const scratchKey = await store.getScratchKey(apikey);

        if (req.header('if-modified-since') &&
            scratchKey.updated &&
            scratchKey.updated.toISOString() === req.header('if-modified-since'))
        {
            return res.sendStatus(httpstatus.NOT_MODIFIED);
        }

        const classes = await classifier.classify(scratchKey, req.query.data);

        return res.set(headers.CACHE_10SECONDS).jsonp(classes);
    }
    catch (err) {
        if (err.message === 'Missing data') {
            return res.status(httpstatus.BAD_REQUEST).jsonp({ error : 'Missing data' });
        }
        if (err.message === conversation.ERROR_MESSAGES.TEXT_TOO_LONG) {
            return res.status(httpstatus.BAD_REQUEST).jsonp({ error : err.message });
        }
        if (err.message === 'Unexpected response when retrieving credentials for Scratch') {
            return res.status(httpstatus.NOT_FOUND).jsonp({ error : 'Scratch key not found' });
        }
        if (err.statusCode === httpstatus.BAD_REQUEST) {
            return res.status(httpstatus.BAD_REQUEST).jsonp({ error : err.message });
        }

        const safeDataDebug = typeof req.query.data === 'string' ?
                                  req.query.data.substr(0, 100) :
                                  typeof req.query.data;
        log.error({ err, data : safeDataDebug, agent : req.header('X-User-Agent') }, 'Classify error (get)');
        return res.status(httpstatus.INTERNAL_SERVER_ERROR).jsonp(err);
    }
}


async function postClassifyWithScratchKey(req: Express.Request, res: Express.Response) {
    const apikey = req.params.scratchkey;

    try {
        if (!req.body.data) {
            log.warn({
                agent : req.header('X-User-Agent'),
                key : apikey,
                func : 'postClassifyWithScratchKey',
            }, 'Missing data');
            throw new Error('Missing data');
        }

        const scratchKey = await store.getScratchKey(apikey);

        if (req.header('if-modified-since') &&
            scratchKey.updated &&
            scratchKey.updated.toISOString() === req.header('if-modified-since'))
        {
            return res.sendStatus(httpstatus.NOT_MODIFIED);
        }

        const classes = await classifier.classify(scratchKey, req.body.data);

        return res.json(classes);
    }
    catch (err) {
        if (err.message === 'Unexpected response when retrieving credentials for Scratch') {
            return res.status(httpstatus.NOT_FOUND).json({ error : 'Scratch key not found' });
        }
        if (err.message === conversation.ERROR_MESSAGES.TEXT_TOO_LONG) {
            return res.status(httpstatus.BAD_REQUEST).json({ error : err.message });
        }
        if (err.statusCode === httpstatus.BAD_REQUEST) {
            return res.status(httpstatus.BAD_REQUEST).json({ error : err.message });
        }
        if (err.statusCode === httpstatus.FORBIDDEN || err.statusCode === httpstatus.UNAUTHORIZED) {
            return res.status(httpstatus.CONFLICT).json({ error : 'The Watson credentials being used by your class were rejected.' });
        }

        const safeDataDebug = typeof req.body.data === 'string' ?
                                 req.body.data.substr(0, 100) :
                                 typeof req.body.data;

        if (err.message === 'Missing data' ||
            err.message === 'Invalid image data provided. Remember, only jpg and png images are supported.')
        {
            log.warn({
                agent : req.header('X-User-Agent'),
                displayedHelp : req.body.displayedhelp,
                data : safeDataDebug,
            }, 'Missing data in Scratch key classification');
            return res.status(httpstatus.BAD_REQUEST).json({ error : err.message });
        }

        log.error({ err, data : safeDataDebug, agent : req.header('X-User-Agent') }, 'Classify error (post)');
        return res.status(httpstatus.INTERNAL_SERVER_ERROR).json(err);
    }
}



function getSoundTrainingItem(info: Types.SoundTraining): Promise<any> {
    const urlSegments = info.audiourl.split('/');
    if (urlSegments.length < 10) {
        throw new Error('Unexpected audio url');
    }
    const soundSpec = {
        classid : urlSegments[3],
        userid : urlSegments[5],
        projectid : urlSegments[7],
        objectid : urlSegments[9],
    };
    return objectstore.getSound(soundSpec)
        .then((audiodata) => {
            const soundTraining: any = info as any;
            soundTraining.audiodata = audiodata.body;
            return soundTraining;
        });
}
function getImageTrainingItem(scratchKey: Types.ScratchKey, info: Types.ImageTraining, proxy: boolean): any {
    let imageurl: string;
    if (info.isstored) {
        // if it's stored, provide a URL to download the image from the ML for Kids server
        imageurl = env.getSiteHostUrl() + '/api/scratch/' + scratchKey.id + '/images' + info.imageurl;
    }
    else if (proxy) {
        // only if requested, provide a URL that downloads non-stored images through ML for Kids as a proxy
        imageurl = env.getSiteHostUrl() + '/api/scratch/' + scratchKey.id + '/images/api' +
            '/classes/classid' +
            '/students/userid' +
            '/projects/' + scratchKey.projectid +
            '/images/' + info.id +
            '?proxy=true';
    }
    else {
        // otherwise, provide the canonical source URL
        imageurl = info.imageurl;
    }

    return {
        id : info.id,
        imageurl,
        label : info.label,
    };
}


async function getTrainingData(req: Express.Request, res: Express.Response) {
    const apikey = req.params.scratchkey;

    try {
        const scratchKey = await store.getScratchKey(apikey);

        if (scratchKey.type === 'sounds') {
            const trainingInfo = await store.getSoundTraining(scratchKey.projectid, {
                start : 0,
                limit : limits.getStoreLimits().soundTrainingItemsPerProject,
            });

            const trainingData = await Promise.all(trainingInfo.map(getSoundTrainingItem));

            res.set(headers.CACHE_2MINUTES);

            return res.json(trainingData);
        }
        else if (scratchKey.type === 'imgtfjs') {
            const trainingInfo = await store.getImageTraining(scratchKey.projectid, {
                start : 0,
                limit : limits.getStoreLimits().imageTrainingItemsPerProject,
            });
            const proxy = req.query.proxy === 'true';

            const trainingData = trainingInfo.map((item) => getImageTrainingItem(scratchKey, item, proxy));

            res.set(headers.CACHE_2MINUTES);

            return res.json(trainingData);
        }
        else if (scratchKey.type === 'text') {
            const trainingData = await store.getTextTraining(scratchKey.projectid, {
                start : 0,
                limit : limits.getStoreLimits().textTrainingItemsPerProject,
            });

            res.set(headers.CACHE_2MINUTES);

            return res.json(trainingData);
        }
        else {
            return res.status(httpstatus.METHOD_NOT_ALLOWED)
                .json({
                    error : 'Method not allowed',
                });
        }
    }
    catch (err) {
        if (err.message === 'Unexpected response when retrieving credentials for Scratch') {
            return res.status(httpstatus.NOT_FOUND).json({ error : 'Scratch key not found' });
        }

        log.error({ err, agent : req.header('X-User-Agent') }, 'Fetch error');
        return res.status(httpstatus.INTERNAL_SERVER_ERROR).jsonp(err);
    }
}


async function getImageTrainingDataItem(req: Express.Request, res: Express.Response) {
    const apikey = req.params.scratchkey;

    try {
        const scratchKey = await store.getScratchKey(apikey);

        const imageKey = {
            classid : req.params.classid,
            userid : req.params.studentid,
            projectid : req.params.projectid,
            objectid : req.params.imageid,
        };
        if (scratchKey.projectid !== imageKey.projectid) {
            return errors.forbidden(res);
        }

        let imageData: Buffer;
        if (req.query.proxy === 'true') {
            const project = await store.getProject(imageKey.projectid);
            if (!project || project.type !== 'imgtfjs'){
                return errors.forbidden(res);
            }
            imageData = await visrec.getTrainingItemData(project, imageKey.objectid);
        }
        else {
            const image = await objectstore.getImage(imageKey);

            //
            // set headers dynamically based on the image we've fetched
            //

            res.setHeader('Content-Type', image.filetype);

            if (image.modified) {
                res.setHeader('Last-Modified', image.modified);
            }
            if (image.etag) {
                res.setHeader('ETag', image.etag);
            }

            imageData = image.body;
        }

        // This is slow, so encourage browsers to aggressively
        //  cache the images rather than repeatedly download them
        // (This is safe as we don't allow images to be modified,
        //  so it's okay to treat them as immutable).
        res.set(headers.CACHE_1YEAR);


        res.send(imageData);
    }
    catch (err) {
        if (err.message === 'Unexpected response when retrieving credentials for Scratch') {
            return res.status(httpstatus.NOT_FOUND).json({ error : 'Scratch key not found' });
        }
        if (err.message === 'The specified key does not exist.') {
            return res.status(httpstatus.NOT_FOUND).json({ error : 'File not found' });
        }

        return res.status(httpstatus.INTERNAL_SERVER_ERROR).json({ error : err.message });
    }
}




async function storeTrainingData(req: Express.Request, res: Express.Response) {
    const apikey = req.params.scratchkey;

    try {
        if (!req.body.data || !req.body.label) {
            log.warn({
                agent : req.header('X-User-Agent'),
                key : apikey,
                func : 'postStoreTrainingData',
            }, 'Missing data');
            throw new Error('Missing data');
        }

        const scratchKey = await store.getScratchKey(apikey);
        const stored = await training.storeTrainingData(scratchKey, req.body.label, req.body.data);

        return res.set(headers.NO_CACHE).json(stored);
    }
    catch (err) {
        if (err.message === 'Missing data' ||
            err.message === 'Invalid data' ||
            err.message === 'Invalid label' ||
            err.message === 'Number is too small' ||
            err.message === 'Number is too big')
        {
            return res.status(httpstatus.BAD_REQUEST).json({ error : err.message });
        }
        if (err.message === 'Project already has maximum allowed amount of training data') {
            return res.status(httpstatus.CONFLICT).json({ error : err.message });
        }
        if (err.message === 'Unexpected response when retrieving credentials for Scratch') {
            return res.status(httpstatus.NOT_FOUND).json({ error : 'Scratch key not found' });
        }

        log.error({ err, datatype : typeof(req.body.data), agent : req.header('X-User-Agent') }, 'Store error');
        return res.status(httpstatus.INTERNAL_SERVER_ERROR).json(err);
    }
}




async function getExtension(req: Express.Request, res: Express.Response, version: 2 | 3) {
    const apikey = req.params.scratchkey;

    try {
        const scratchKey = await store.getScratchKey(apikey);
        const project = await store.getProject(scratchKey.projectid);
        if (!project) {
            return errors.notFound(res);
        }

        if (project.type === 'numbers') {
            project.fields = await store.getNumberProjectFields(project.userid, project.classid, project.id);
        }

        const extension = await extensions.getScratchxExtension(scratchKey, project, version);
        return res.set('Content-Type', 'application/javascript')
                  .set(headers.NO_CACHE)
                  .send(extension);
    }
    catch (err) {
        if (err.message === 'Unexpected response when retrieving credentials for Scratch') {
            return res.status(httpstatus.NOT_FOUND).json({ error : 'Scratch key not found' });
        }

        log.error({ err }, 'Failed to generate extension');
        errors.unknownError(res, err);
    }
}


function getScratchxExtension(req: Express.Request, res: Express.Response) {
    getExtension(req, res, 2);
}
function getScratch3Extension(req: Express.Request, res: Express.Response) {
    getExtension(req, res, 3);
}


function handleTfjsException(err: any, res: Express.Response) {
    log.error({ err }, 'TensorFlow.js request exception');
    if (err.statusCode === httpstatus.NOT_FOUND) {
        return res.status(httpstatus.BAD_REQUEST)
                  .json({ error : 'Model not found' });
    }
    errors.unknownError(res, err);
}


function getTfjsExtension(req: Express.Request, res: Express.Response) {
    const scratchkey = req.params.scratchkey;

    return extensions.getScratchTfjsExtension(scratchkey)
        .then((extension) => {
            return res.set('Content-Type', 'application/javascript')
                  .set(headers.CACHE_1YEAR)
                  .send(extension);
        })
        .catch((err) => {
            handleTfjsException(err, res);
        });
}

function generateTfjsExtension(req: Express.Request, res: Express.Response) {
    return scratchtfjs.generateUrl(req.body)
        .then((resp) => {
            return res.status(httpstatus.OK)
                    .set(headers.CACHE_1YEAR)
                    .json({ url : resp });
        })
        .catch((err) => {
            handleTfjsException(err, res);
        });
}


async function getScratchxStatus(req: Express.Request, res: Express.Response) {
    const apikey = req.params.scratchkey;

    try {
        const scratchKey = await store.getScratchKey(apikey);
        const scratchStatus = await status.getStatus(scratchKey);

        return res.set(headers.NO_CACHE).jsonp(scratchStatus);
    }
    catch (err) {
        if (err.message === 'Unexpected response when retrieving credentials for Scratch') {
            return res.status(httpstatus.NOT_FOUND).jsonp({ error : 'Scratch key not found' });
        }

        log.error({ err, agent : req.header('X-User-Agent') }, 'Status error');
        errors.unknownError(res, err);
    }
}


async function trainNewClassifier(req: Express.Request, res: Express.Response) {
    const apikey = req.params.scratchkey;

    try {
        const scratchKey = await store.getScratchKey(apikey);
        const classifierStatus = await models.trainModel(scratchKey);

        return res.set(headers.NO_CACHE).jsonp(classifierStatus);
    }
    catch (err) {
        if (err.message === 'Only text or numbers models can be trained using a Scratch key') {
            return res.status(httpstatus.NOT_IMPLEMENTED).json({ error : err.message });
        }

        log.error({ err, agent : req.header('X-User-Agent') }, 'Train error');
        errors.unknownError(res, err);
    }
}



const CORS_CONFIG = {
    origin: /machinelearningforkids\.co\.uk$/,
};

function doNothing(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
    next();
}


export default function registerApis(app: Express.Application) {

    app.options('/api/scratch/*', cors(CORS_CONFIG), doNothing);

    app.get(urls.SCRATCHKEYS,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectAccess,
            getScratchKeys);

    app.get(urls.SCRATCHKEY_CLASSIFY, cors(CORS_CONFIG), classifyWithScratchKey);
    app.post(urls.SCRATCHKEY_CLASSIFY, cors(CORS_CONFIG), postClassifyWithScratchKey);
    app.post(urls.SCRATCHKEY_MODEL, cors(CORS_CONFIG), trainNewClassifier);

    app.get(urls.SCRATCHKEY_TRAIN, cors(CORS_CONFIG), getTrainingData);
    app.get(urls.SCRATCHKEY_IMAGE, cors(CORS_CONFIG), getImageTrainingDataItem);
    app.post(urls.SCRATCHKEY_TRAIN, cors(CORS_CONFIG), storeTrainingData);

    app.post(urls.SCRATCHTFJS_EXTENSIONS, cors(CORS_CONFIG), generateTfjsExtension);

    app.get(urls.SCRATCHKEY_EXTENSION, cors(CORS_CONFIG), getScratchxExtension);
    app.get(urls.SCRATCH3_EXTENSION, cors(CORS_CONFIG), getScratch3Extension);
    app.get(urls.SCRATCHTFJS_EXTENSION, cors(CORS_CONFIG), getTfjsExtension);
    app.get(urls.SCRATCHKEY_STATUS, cors(CORS_CONFIG), getScratchxStatus);
}
