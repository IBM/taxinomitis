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
            return res.json([ newKeyInfo ]);
        }

        return res.json(scratchKeys.map((key) => {
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
        const classes = await classifier.classify(scratchKey, req.query.data);

        return res.jsonp(classes);
    }
    catch (err) {
        if (err.message === 'Missing data') {
            return res.status(httpstatus.BAD_REQUEST).jsonp({ error : 'Missing data' });
        }
        if (err.message === 'Not implemented yet') {
            return res.status(httpstatus.NOT_IMPLEMENTED).jsonp({ error : 'Not implemented yet' });
        }

        log.error({ err }, 'Classify error');
        return res.status(httpstatus.INTERNAL_SERVER_ERROR).jsonp(err);
    }
}




async function getScratchxExtension(req: Express.Request, res: Express.Response) {
    const apikey = req.params.scratchkey;

    try {
        const scratchKey = await store.getScratchKey(apikey);
        const project = await store.getProject(scratchKey.projectid);
        const extension = await extensions.getScratchxExtension(scratchKey, project);
        return res.set('Content-Type', 'application/javascript')
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

        return res.jsonp(scratchStatus);
    }
    catch (err) {
        errors.unknownError(res, err);
    }
}



export default function registerApis(app: Express.Application) {

    app.get('/api/classes/:classid/students/:studentid/projects/:projectid/scratchkeys',
            auth.authenticate,
            auth.checkValidUser,
            getScratchKeys);

    app.get('/api/scratch/:scratchkey/classify', classifyWithScratchKey);
    app.get('/api/scratch/:scratchkey/extension.js', getScratchxExtension);
    app.get('/api/scratch/:scratchkey/status', getScratchxStatus);
}
