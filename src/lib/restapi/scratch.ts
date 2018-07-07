// external dependencies
import * as Express from 'express';
import * as httpstatus from 'http-status';
// local dependencies
import * as store from '../db/store';
import * as errors from './errors';
import * as auth from './auth';
import * as extensions from '../scratchx/extensions';
import * as status from '../scratchx/status';
import * as keys from '../scratchx/keys';
import * as classifier from '../scratchx/classify';
import * as training from '../scratchx/training';
import * as urls from './urls';
import * as headers from './headers';
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
        if (err.message === 'Unexpected response when retrieving credentials for Scratch') {
            return res.status(httpstatus.NOT_FOUND).jsonp({ error : 'Scratch key not found' });
        }

        log.error({ err }, 'Classify error');
        return res.status(httpstatus.INTERNAL_SERVER_ERROR).jsonp(err);
    }
}

async function postClassifyWithScratchKey(req: Express.Request, res: Express.Response) {
    const apikey = req.params.scratchkey;

    try {
        if (!req.body.data) {
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
        if (err.message === 'Missing data') {
            return res.status(httpstatus.BAD_REQUEST).json({ error : 'Missing data' });
        }

        log.error({ err }, 'Classify error');
        return res.status(httpstatus.INTERNAL_SERVER_ERROR).json(err);
    }
}



async function storeTrainingData(req: Express.Request, res: Express.Response) {
    const apikey = req.params.scratchkey;

    try {
        if (!req.query.data || !req.query.label) {
            throw new Error('Missing data');
        }

        const scratchKey = await store.getScratchKey(apikey);
        const stored = await training.storeTrainingData(scratchKey, req.query.label, req.query.data);

        return res.set(headers.NO_CACHE).jsonp(stored);
    }
    catch (err) {
        if (err.message === 'Missing data' ||
            err.message === 'Invalid data' ||
            err.message === 'Invalid label')
        {
            return res.status(httpstatus.BAD_REQUEST).jsonp({ error : err.message });
        }
        if (err.message === 'Project already has maximum allowed amount of training data') {
            return res.status(httpstatus.CONFLICT).jsonp({ error : err.message });
        }
        if (err.message === 'Not implemented yet') {
            return res.status(httpstatus.NOT_IMPLEMENTED).jsonp({ error : 'Not implemented yet' });
        }

        log.error({ err }, 'Store error');
        return res.status(httpstatus.INTERNAL_SERVER_ERROR).jsonp(err);
    }
}



async function getScratchxExtension(req: Express.Request, res: Express.Response) {
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

        const extension = await extensions.getScratchxExtension(scratchKey, project);
        return res.set('Content-Type', 'application/javascript')
                  .set(headers.NO_CACHE)
                  .send(extension);
    }
    catch (err) {
        errors.unknownError(res, err);
    }
}





async function getScratchxStatus(req: Express.Request, res: Express.Response) {
    const apikey = req.params.scratchkey;

    try {
        const scratchKey = await store.getScratchKey(apikey);
        const scratchStatus = await status.getStatus(scratchKey);

        return res.set(headers.NO_CACHE).jsonp(scratchStatus);
    }
    catch (err) {
        errors.unknownError(res, err);
    }
}



export default function registerApis(app: Express.Application) {

    app.get(urls.SCRATCHKEYS,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectAccess,
            getScratchKeys);

    app.get(urls.SCRATCHKEY_CLASSIFY, classifyWithScratchKey);
    app.post(urls.SCRATCHKEY_CLASSIFY, postClassifyWithScratchKey);

    app.get(urls.SCRATCHKEY_TRAIN, storeTrainingData);

    app.get(urls.SCRATCHKEY_EXTENSION, getScratchxExtension);
    app.get(urls.SCRATCHKEY_STATUS, getScratchxStatus);
}
