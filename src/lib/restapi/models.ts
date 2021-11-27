// external dependencies
import * as Express from 'express';
import * as httpstatus from 'http-status';
// local dependencies
import * as auth from './auth';
import * as store from '../db/store';
import * as DbTypes from '../db/db-types';
import * as Types from '../training/training-types';
import * as conversation from '../training/conversation';
import * as visualrec from '../training/visualrecognition';
import * as numbers from '../training/numbers';
import * as textmodels from '../training/describetext';
import * as notifications from '../notifications/slack';
import * as download from '../utils/download';
import * as urls from './urls';
import * as errors from './errors';
import * as headers from './headers';
import loggerSetup from '../utils/logger';


const log = loggerSetup();


function returnConversationWorkspace(classifier: Types.ConversationWorkspace) {
    return {
        classifierid : classifier.workspace_id,
        credentialsid : classifier.credentialsid,
        updated : classifier.updated,
        expiry : classifier.expiry,
        name : classifier.name,
        status : classifier.status,
    };
}
function returnNumberClassifier(classifier: Types.NumbersClassifier) {
    classifier.updated = classifier.created;
    return classifier;
}



async function getModels(req: auth.RequestWithProject, res: Express.Response) {
    const classid = req.params.classid;
    const projectid = req.params.projectid;

    let classifiers: any[];
    let tenant: DbTypes.ClassTenant;
    switch (req.project.type) {
    case 'text':
        tenant = await store.getClassTenant(classid);
        classifiers = await store.getConversationWorkspaces(projectid);
        classifiers = await conversation.getClassifierStatuses(tenant, classifiers);
        classifiers = classifiers.map(returnConversationWorkspace);
        break;
    case 'imgtfjs':
    case 'images':
        classifiers = [];
        break;
    case 'numbers':
        classifiers = await store.getNumbersClassifiers(projectid);
        classifiers = classifiers.map(returnNumberClassifier);
        break;
    case 'sounds':
        classifiers = [];
        break;
    }

    if (classifiers.length > 1) {
        log.error({ classid, projectid, classifiers }, 'Unexpected number of ML models');
    }

    return res.set(headers.NO_CACHE).json(classifiers);
}

async function newModel(req: auth.RequestWithProject, res: Express.Response) {
    switch (req.project.type) {
    case 'text': {
        try {
            const model = await conversation.trainClassifier(req.project);
            return res.status(httpstatus.CREATED).json(returnConversationWorkspace(model));
        }
        catch (err) {
            if (err.message === conversation.ERROR_MESSAGES.INSUFFICIENT_API_KEYS) {
                return res.status(httpstatus.CONFLICT).send({ code : 'MLMOD01', error : err.message });
            }
            else if (err.message === conversation.ERROR_MESSAGES.POOL_EXHAUSTED) {
                log.error({ err }, 'Managed classes have exhausted the pool of Watson Assistant keys');
                notifications.notify('Exhausted managed pool of Watson Assistant keys',
                                     notifications.SLACK_CHANNELS.CRITICAL_ERRORS);
                return res.status(httpstatus.CONFLICT).send({ code : 'MLMOD15', error : err.message });
            }
            else if (err.message === conversation.ERROR_MESSAGES.API_KEY_RATE_LIMIT) {
                return res.status(httpstatus.TOO_MANY_REQUESTS).send({ code : 'MLMOD02', error : err.message });
            }
            else if (err.message === conversation.ERROR_MESSAGES.MODEL_NOT_FOUND) {
                return res.status(httpstatus.NOT_FOUND)
                          .send({ code : 'MLMOD03', error : err.message + ' Please try again' });
            }
            else if (err.statusCode === httpstatus.UNAUTHORIZED) {
                return res.status(httpstatus.CONFLICT)
                        .send({
                            code : 'MLMOD04',
                            error : 'The Watson credentials being used by your class were rejected. ' +
                                    'Please let your teacher or group leader know.',
                        });
            }
            else if (err.message === 'Unexpected response when retrieving service credentials') {
                return res.status(httpstatus.CONFLICT)
                    .send({
                        code : 'MLMOD05',
                        error : 'No Watson credentials have been set up for training text projects. ' +
                                'Please let your teacher or group leader know.',
                    });
            }
            else {
                return errors.unknownError(res, err);
            }
        }
    }
    case 'numbers': {
        try {
            const model = await numbers.trainClassifier(req.project);
            return res.status(httpstatus.CREATED).json(returnNumberClassifier(model));
        }
        catch (err) {
            return errors.unknownError(res, err);
        }
    }
    case 'images':
    case 'imgtfjs':
        return errors.notImplemented(res);
    case 'sounds':
        return errors.notImplemented(res);
    }
}


async function deleteModel(req: auth.RequestWithProject, res: Express.Response) {
    const classid = req.params.classid;
    const userid = req.params.studentid;
    const projectid = req.params.projectid;
    const modelid = req.params.modelid;

    try {
        switch (req.project.type) {
        case 'text': {
            const tenant = await store.getClassTenant(classid);
            const workspace = await store.getConversationWorkspace(projectid, modelid);
            await conversation.deleteClassifier(tenant, workspace);
            return res.sendStatus(httpstatus.NO_CONTENT);
        }
        case 'numbers': {
            await numbers.deleteClassifier(userid, classid, projectid);
            return res.sendStatus(httpstatus.NO_CONTENT);
        }
        case 'sounds':
            return errors.notFound(res);
        case 'imgtfjs':
        case 'images':
            return errors.notFound(res);
        }
    }
    catch (err) {
        if (err.message === 'Unexpected response when retrieving conversation workspace details' ||
            err.message === 'Unexpected response when retrieving image classifier details')
        {
            return errors.notFound(res);
        }

        return errors.unknownError(res, err);
    }
}


async function describeModel(req: auth.RequestWithProject, res: Express.Response) {
    try {
        if (req.project.type === 'numbers') {
            const classifierInfo = await numbers.getModelVisualisation(req.project);

            // computing the visualisation data is super expensive
            //  so ask browsers to cache it forever
            res.set(headers.CACHE_1YEAR);

            return res.json(classifierInfo);
        }
        else if (req.project.type === 'text') {
            const classifierInfo = await textmodels.getModelVisualisation(req.project);

            // computing this analysis is quite expensiive, so
            //  ask browsers to cache it for a while
            res.set(headers.CACHE_1HOUR);

            return res.json(classifierInfo);
        }
        else {
            // sounds and images not supported yet
            return errors.notImplemented(res);
        }
    }
    catch (err) {
        return errors.unknownError(res, err);
    }
}


async function testModel(req: Express.Request, res: Express.Response) {
    const classid = req.params.classid;
    const userid = req.params.studentid;
    const projectid = req.params.projectid;
    const modelid = req.params.modelid;
    const type = req.body.type;
    const credsid = req.body.credentialsid;
    const requestTimestamp = new Date();

    try {
        if (type === 'text') {
            const text = req.body.text;
            if (!text || !credsid) {
                return errors.missingData(res);
            }

            const tenant = await store.getClassTenant(classid);
            const creds = await store.getBluemixCredentialsById(tenant.tenantType, credsid);

            const classes = await conversation.testClassifier(creds, modelid, requestTimestamp, projectid, text);
            return res.json(classes);
        }
        else if (type === 'numbers') {
            const numberdata = req.body.numbers;
            if (!numberdata || numberdata.length === 0) {
                return errors.missingData(res);
            }

            const classes = await numbers.testClassifier(userid, classid, requestTimestamp, projectid, numberdata);
            return res.json(classes);
        }
        else if (type === 'imgtfjs' || type === 'images') {
            // this behaves slightly differently - the API endpoint returns data
            //  ready for testing, rather than the results from testing
            const imageurl = req.body.image;

            if (!imageurl) {
                return errors.missingData(res);
            }

            const downloadSpec = await visualrec.getImageDownloadSpec('placeholder', imageurl);
            const imageData = await download.resizeUrl(downloadSpec.url,
                                                       visualrec.IMAGE_WIDTH_PIXELS,
                                                       visualrec.IMAGE_HEIGHT_PIXELS);
            return res.send(imageData);
        }
        else if (type === 'sounds') {
            return errors.notImplemented(res);
        }
        else {
            return errors.missingData(res);
        }
    }
    catch (err) {
        if (err.message === conversation.ERROR_MESSAGES.MODEL_NOT_FOUND) {
            return res.status(httpstatus.NOT_FOUND).send({ error : err.message + ' Refresh the page' });
        }
        if (err.message === conversation.ERROR_MESSAGES.TEXT_TOO_LONG) {
            return res.status(httpstatus.BAD_REQUEST).send({ error : err.message });
        }
        if (err.message === 'Unexpected response when retrieving the service credentials') {
            return errors.notFound(res);
        }
        if ((type === 'images' || type === 'numbers') &&
            err.statusCode === 400)
        {
            return res.status(httpstatus.BAD_REQUEST).send({ error : err.message });
        }
        if (err.message && err.message.startsWith(download.ERRORS.DOWNLOAD_FAIL)) {
            return res.status(httpstatus.BAD_REQUEST)
                    .send({ error : 'The test image could not be downloaded' });
        }
        if (err.message === download.ERRORS.DOWNLOAD_FILETYPE_UNSUPPORTED) {
            return res.status(httpstatus.BAD_REQUEST)
                    .send({ error : 'The test image is a type that cannot be used' });
        }
        if (err.message === conversation.ERROR_MESSAGES.SERVICE_ERROR) {
            return res.status(httpstatus.SERVICE_UNAVAILABLE).send({ error : err.message });
        }
        if (err.message === visualrec.ERROR_MESSAGES.INVALID_URL) {
            return res.status(httpstatus.BAD_REQUEST)
                    .send({ error : 'The test image address is not a valid web address' });
        }

        log.error({ err, body : req.body }, 'Test error');
        return errors.unknownError(res, err);
    }
}



export default function registerApis(app: Express.Application) {

    app.get(urls.MODELS,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectAccess,
            // @ts-ignore
            getModels);

    app.post(urls.MODELS,
             auth.authenticate,
             auth.checkValidUser,
             auth.verifyProjectOwner,
             // @ts-ignore
             newModel);

    app.get(urls.MODEL,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectAccess,
            // @ts-ignore
            describeModel);

    app.delete(urls.MODEL,
               auth.authenticate,
               auth.checkValidUser,
               auth.verifyProjectOwnerOrTeacher,
               // @ts-ignore
               deleteModel);

    app.post(urls.MODELTEST,
             auth.authenticate,
             auth.checkValidUser,
             testModel);
}
