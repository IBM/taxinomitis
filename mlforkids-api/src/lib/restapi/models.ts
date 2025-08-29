// external dependencies
import * as Express from 'express';
import { status as httpstatus } from 'http-status';
// local dependencies
import * as auth from './auth';
import * as store from '../db/store';
import * as DbTypes from '../db/db-types';
import * as Types from '../training/training-types';
import * as conversation from '../training/conversation';
import * as visualrec from '../training/visualrecognition';
import * as numbers from '../training/numbers';
import * as textmodels from '../training/describetext';
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
    return {
        key : classifier.projectid,
        status : 'Unknown',
        urls : {
            status : classifier.url,
        }
    };
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
            return errors.watsonAssistantModelCreationFailure(res, err);
        }
    }
    case 'numbers': {
        try {
            const model = await numbers.trainClassifierCloudProject(req.project);
            return res.status(httpstatus.CREATED).json(model);
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
            await store.deleteNumberClassifier(req.project.userid, req.project.id);
            return res.sendStatus(httpstatus.NO_CONTENT);
        }
        case 'sounds':
        case 'imgtfjs':
        case 'images':
            return errors.notFound(res);
        }
    }
    catch (err) {
        if (err.message === 'Unexpected response when retrieving conversation workspace details')
        {
            return errors.notFound(res);
        }

        return errors.unknownError(res, err);
    }
}


async function describeModel(req: auth.RequestWithProject, res: Express.Response) {
    try {
        if (req.project.type === 'text') {
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
            return errors.notImplemented(res);
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
        if (err.message && err.message.startsWith(download.ERRORS.DOWNLOAD_FAIL)) {
            return res.status(httpstatus.BAD_REQUEST)
                    .send({ error : 'The test image could not be downloaded' });
        }
        if (err.message === download.ERRORS.DOWNLOAD_FILETYPE_UNSUPPORTED) {
            return res.status(httpstatus.BAD_REQUEST)
                    .send({ error : 'The test image is a type that cannot be used' });
        }
        if (err.message === visualrec.ERROR_MESSAGES.INVALID_URL) {
            return res.status(httpstatus.BAD_REQUEST)
                    .send({ error : 'The test image address is not a valid web address' });
        }
        return errors.watsonAssistantModelTestFailure(res, err);
    }
}



export default function registerApis(app: Express.Application) {

    app.get(urls.MODELS,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectAccess,
            // @ts-expect-error custom middleware not understood by linter
            getModels);

    app.post(urls.MODELS,
             auth.authenticate,
             auth.checkValidUser,
             auth.verifyProjectOwner,
             // @ts-expect-error custom middleware not understood by linter
             newModel);

    app.get(urls.MODEL,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectAccess,
            // @ts-expect-error custom middleware not understood by linter
            describeModel);

    app.delete(urls.MODEL,
               auth.authenticate,
               auth.checkValidUser,
               auth.verifyProjectOwnerOrTeacher,
               // @ts-expect-error custom middleware not understood by linter
               deleteModel);

    app.post(urls.MODELTEST,
             errors.expectsBody,
             auth.authenticate,
             auth.checkValidUser,
             testModel);
}
