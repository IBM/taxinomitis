// external dependencies
import * as fs from 'fs';
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
import * as notifications from '../notifications/slack';
import * as base64decode from '../utils/base64decode';
import * as download from '../utils/download';
import * as random from '../utils/random';
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
function transformStatus(visualClassifierStatus?: string): string | undefined {
    switch (visualClassifierStatus) {
    case 'training':
        return 'Training';
    case 'ready':
        return 'Available';
    default:
        return visualClassifierStatus;
    }
}
function returnVisualRecognition(classifier: Types.VisualClassifier) {
    return {
        classifierid : classifier.classifierid,
        credentialsid : classifier.credentialsid,
        updated : classifier.created,
        expiry : classifier.expiry,
        name : classifier.name,
        status : transformStatus(classifier.status),
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
    case 'images':
        tenant = await store.getClassTenant(classid);
        classifiers = await store.getImageClassifiers(projectid);
        classifiers = await visualrec.getClassifierStatuses(tenant, classifiers);
        classifiers = classifiers.map(returnVisualRecognition);
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
    case 'images': {
        try {
            const model = await visualrec.trainClassifier(req.project);
            return res.status(httpstatus.CREATED).json(returnVisualRecognition(model));
        }
        catch (err) {
            if (err.message === visualrec.ERROR_MESSAGES.INSUFFICIENT_API_KEYS) {
                return res.status(httpstatus.CONFLICT).send({ code : 'MLMOD06', error : err.message });
            }
            else if (err.message === visualrec.ERROR_MESSAGES.POOL_EXHAUSTED) {
                log.error({ err }, 'Managed classes have exhausted the pool of Visual Recognition keys');
                notifications.notify('Exhausted managed pool of Visual Recognition keys',
                                     notifications.SLACK_CHANNELS.CRITICAL_ERRORS);
                return res.status(httpstatus.CONFLICT).send({ code : 'MLMOD16', error : err.message });
            }
            else if (err.message === visualrec.ERROR_MESSAGES.API_KEY_RATE_LIMIT) {
                return res.status(httpstatus.TOO_MANY_REQUESTS).send({ code : 'MLMOD07', error : err.message });
            }
            else if (err.message === 'Not enough images to train the classifier' ||
                     err.message === 'Number of images exceeds maximum (10000)' ||
                     err.message.indexOf(') has unsupported file type (') > 0)
            {
                return res.status(httpstatus.BAD_REQUEST).send({ code : 'MLMOD08', error : err.message });
            }
            else if (err.statusCode === httpstatus.UNAUTHORIZED || err.statusCode === httpstatus.FORBIDDEN) {
                return res.status(httpstatus.CONFLICT)
                        .send({
                            code : 'MLMOD09',
                            error : 'The Watson credentials being used by your class were rejected. ' +
                                    'Please let your teacher or group leader know.',
                        });
            }
            else if (err.message === 'Unexpected response when retrieving service credentials') {
                return res.status(httpstatus.CONFLICT)
                    .send({
                        code : 'MLMOD10',
                        error : 'No Watson credentials have been set up for training images projects. ' +
                                'Please let your teacher or group leader know.',
                    });
            }
            else if (err.message.includes('413 Request Entity Too Large')) {
                return res.status(httpstatus.REQUEST_ENTITY_TOO_LARGE)
                    .json({
                        code : 'MLMOD11',
                        error : 'Machine learning server rejected the training request ' +
                                'because the training data was too large',
                    });
            }
            else if (err.message && err.message.startsWith(download.ERRORS.DOWNLOAD_FAIL)) {
                return res.status(httpstatus.CONFLICT)
                        .send({
                            code : 'MLMOD12',
                            error : 'One of your training images could not be downloaded',
                            location : err.location,
                        });
            }
            else if (err.message === download.ERRORS.DOWNLOAD_FILETYPE_UNSUPPORTED) {
                return res.status(httpstatus.CONFLICT)
                        .send({
                            code : 'MLMOD13',
                            error : 'One of your training images is a type that cannot be used',
                            location : err.location,
                        });
            }
            else if (err.message && err.message.includes(download.ERRORS.DOWNLOAD_FORBIDDEN)) {
                return res.status(httpstatus.CONFLICT)
                        .send({
                            code: 'MLMOD14',
                            error: err.message,
                            location: err.location,
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
        case 'images': {
            const tenant = await store.getClassTenant(classid);
            const classifier = await store.getImageClassifier(projectid, modelid);
            await visualrec.deleteClassifier(tenant, classifier);
            return res.sendStatus(httpstatus.NO_CONTENT);
        }
        case 'numbers': {
            await numbers.deleteClassifier(userid, classid, projectid);
            return res.sendStatus(httpstatus.NO_CONTENT);
        }
        case 'sounds':
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
            return res.json({
                examples : [
                    {
                        text : 'SOME GENERIC PLACEHOLDER HEADLINE WILL GO HERE',
                        label : 'Daily_Mail',
                        bagofwords : [
                            { annotation : 'number of times that the word "HEADLINE" appears', value : 1 },
                            { annotation : 'number of times that the word "FURY" appears', value : 0 },
                            { annotation : 'LONDON', value : 0 },
                            { annotation : 'GO', value : 1 },
                            { annotation : 'WILL', value : 1 },
                            { annotation : 'OPEN', value : 0 },
                            { annotation : 'PLACEHOLDER', value : 1 },
                            { annotation : 'TESTING', value : 0 },
                            { annotation : 'VALUES', value : 0 },
                            { annotation : 'QUEEN', value : 0 },
                        ],
                        customfeatures : [
                            { annotation : 'number of letters', value : 46 },
                            { annotation : 'punctuation marks', value : 0 },
                            { annotation : 'number of capital letters', value : 46 },
                            { annotation : 'syllables', value : 12 },
                            { annotation : 'includes numbers', value : 0 },
                            { annotation : 'has an email address', value : 0 },
                            { annotation : 'includes web address', value : 0 },
                            { annotation : 'includes a question mark', value : 0 },
                            { annotation : 'starts with a capital letter', value : 1 },
                        ],
                        random : [
                            { annotation : '', value : random.int(1, 5) },
                            { annotation : '', value : random.int(1, 5) },
                            { annotation : '', value : random.int(0, 5) },
                            { annotation : '', value : random.int(1, 5) },
                            { annotation : '', value : random.int(0, 5) },
                            { annotation : '', value : random.int(0, 5) },
                            { annotation : '', value : random.int(0, 5) },
                            { annotation : '', value : random.int(1, 5) },
                            { annotation : '', value : random.int(0, 5) },
                            { annotation : '', value : random.int(1, 5) },
                        ],
                        output : {
                            Daily_Mail : 0.2,
                            Daily_Telegraph : 0.1,
                            Independent : 0.6,
                            The_Guardian : 0.1,
                        },
                    },
                    {
                        text : 'This is another example that is used for the analysis of the neural network, although unusually long for a newspaper headline is it not? Yes, I think it really is, although examples of a thousand characters are possible. Yes indeed.',
                        label : 'Independent',
                        bagofwords : [
                            { annotation : 'another', value : 1 },
                            { annotation : 'example', value : 1 },
                            { annotation : 'LONDON', value : 0 },
                            { annotation : 'GO', value : 0 },
                            { annotation : 'WILL', value : 0 },
                            { annotation : 'OPEN', value : 0 },
                            { annotation : 'PLACEHOLDER', value : 0 },
                            { annotation : 'TESTING', value : 0 },
                            { annotation : 'unusually', value : 1 },
                            { annotation : 'QUEEN', value : 0 },
                        ],
                        embeddings : [
                            { annotation : 'placeholder', value : random.int(0, 15) },
                            { annotation : 'placeholder', value : random.int(0, 15) },
                            { annotation : 'placeholder', value : random.int(0, 16) },
                            { annotation : 'placeholder', value : random.int(0, 16) },
                            { annotation : 'placeholder', value : random.int(0, 15) },
                            { annotation : 'placeholder', value : random.int(0, 15) },
                            { annotation : 'placeholder', value : random.int(0, 15) },
                            { annotation : 'placeholder', value : random.int(0, 15) },
                            { annotation : 'placeholder', value : random.int(0, 16) },
                            { annotation : 'placeholder', value : random.int(0, 16) },
                        ],
                        random : [
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                        ],
                        output : {
                            Daily_Mail : 0.2,
                            Daily_Telegraph : 0.3,
                            Independent : 0.3,
                            The_Guardian : 0.2,
                        },
                    },
                    {
                        text : 'Another example',
                        label : 'The_Guardian',
                        random : [
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                        ],
                        output : {
                            Daily_Mail : 0.1,
                            Daily_Telegraph : 0.2,
                            Independent : 0.1,
                            The_Guardian : 0.6,
                        },
                    },
                    {
                        text : 'Yet another example',
                        label : 'Daily_Telegraph',
                        random : [
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                        ],
                        output : {
                            Daily_Mail : 0.2,
                            Daily_Telegraph : 0.7,
                            Independent : 0.05,
                            The_Guardian : 0.05,
                        },
                    },
                    {
                        text : 'How many examples are needed?',
                        label : 'Daily_Mail',
                        random : [
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                        ],
                        output : {
                            Daily_Mail : 0.6,
                            Daily_Telegraph : 0.4,
                            Independent : 0.2,
                            The_Guardian : 0.2,
                        },
                    },
                    {
                        text : 'This is the final example',
                        label : 'Daily_Mail',
                        random : [
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                            { annotation : '', value : random.int(0, 6) },
                            { annotation : '', value : random.int(1, 6) },
                        ],
                        output : {
                            Daily_Mail : 0.7,
                            Daily_Telegraph : 0.15,
                            Independent : 0.05,
                            The_Guardian : 0.1,
                        },
                    },
                ],
            });
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
        else if (type === 'images') {
            const imageurl = req.body.image;
            const imagedata = req.body.data;

            if (!credsid || (!imageurl && !imagedata)) {
                return errors.missingData(res);
            }

            const tenant = await store.getClassTenant(classid);
            const creds = await store.getBluemixCredentialsById(tenant.tenantType, credsid);

            let classes: Types.Classification[];
            if (imageurl) {
                classes = await visualrec.testClassifierURL(creds, modelid, requestTimestamp, projectid, imageurl);
            }
            else {
                const imgfile = await base64decode.run(imagedata);
                try {
                    classes = await visualrec.testClassifierFile(creds, modelid, requestTimestamp, projectid, imgfile);
                }
                finally {
                    fs.unlink(imgfile, logError);
                }
            }
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

        log.error({ err, body : req.body }, 'Test error');
        return errors.unknownError(res, err);
    }
}


function logError(err?: Error | null) {
    if (err) {
        log.error({ err }, 'Error when deleting image file');
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
