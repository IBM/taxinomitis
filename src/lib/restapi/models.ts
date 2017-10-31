// external dependencies
import * as Express from 'express';
import * as httpstatus from 'http-status';
// local dependencies
import * as auth from './auth';
import * as store from '../db/store';
import * as Objects from '../db/db-types';
import * as Types from '../training/training-types';
import * as conversation from '../training/conversation';
import * as visualrec from '../training/visualrecognition';
import * as numbers from '../training/numbers';
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
function transformStatus(visualClassifierStatus: string): string {
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

    let classifiers;
    switch (req.project.type) {
    case 'text':
        classifiers = await store.getConversationWorkspaces(projectid);
        classifiers = await conversation.getClassifierStatuses(classid, classifiers);
        classifiers = classifiers.map(returnConversationWorkspace);
        break;
    case 'images':
        classifiers = await store.getImageClassifiers(projectid);
        classifiers = await visualrec.getClassifierStatuses(classid, classifiers);
        classifiers = classifiers.map(returnVisualRecognition);
        break;
    case 'numbers':
        classifiers = await store.getNumbersClassifiers(projectid);
        classifiers = classifiers.map(returnNumberClassifier);
        break;
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
            if (err.message === 'Your class already has created their maximum allowed number of models') {
                return res.status(httpstatus.CONFLICT)
                        .send({ error : err.message });
            }
            else if (err.statusCode === httpstatus.UNAUTHORIZED) {
                return res.status(httpstatus.INTERNAL_SERVER_ERROR)
                        .send({ error : 'The credentials for the machine learning ' +
                                        'server used by your class were rejected.' });
            }
            else if (err.message === 'Unexpected response when retrieving service credentials') {
                return res.status(httpstatus.CONFLICT)
                    .send({ error : 'No Watson credentials have been set up for training text projects. ' +
                                    'Please let your teacher or group header know.' });
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
            if (err.message === 'Your class already has created their maximum allowed number of models') {
                return res.status(httpstatus.CONFLICT).send({ error : err.message });
            }
            else if (err.message === 'Not enough images to train the classifier' ||
                     err.message === 'Number of images exceeds maximum (10000)' ||
                     err.message.indexOf(') has unsupported file type (') > 0)
            {
                return res.status(httpstatus.BAD_REQUEST).send({ error : err.message });
            }
            else if (err.statusCode === httpstatus.UNAUTHORIZED || err.statusCode === httpstatus.FORBIDDEN) {
                return res.status(httpstatus.INTERNAL_SERVER_ERROR)
                        .send({ error : 'The credentials for the machine learning ' +
                                        'server used by your class were rejected.' });
            }
            else if (err.message === 'Unexpected response when retrieving service credentials') {
                return res.status(httpstatus.CONFLICT)
                    .send({ error : 'No Watson credentials have been set up for training images projects. ' +
                                    'Please let your teacher or group header know.' });
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
            const workspace = await store.getConversationWorkspace(projectid, modelid);
            await conversation.deleteClassifier(workspace);
            return res.sendStatus(httpstatus.NO_CONTENT);
        }
        case 'images': {
            const classifier = await store.getImageClassifier(projectid, modelid);
            await visualrec.deleteClassifier(classifier);
            return res.sendStatus(httpstatus.NO_CONTENT);
        }
        case 'numbers': {
            await numbers.deleteClassifier(userid, classid, projectid);
            return res.sendStatus(httpstatus.NO_CONTENT);
        }
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

    try {
        if (type === 'text') {
            const text = req.body.text;
            if (!text || !credsid) {
                return errors.missingData(res);
            }

            const creds = await store.getBluemixCredentialsById(credsid);
            const classes = await conversation.testClassifier(creds, modelid, projectid, text);
            return res.json(classes);
        }
        else if (type === 'images') {
            const imageurl = req.body.image;
            if (!imageurl || !credsid) {
                return errors.missingData(res);
            }

            const creds = await store.getBluemixCredentialsById(credsid);
            const classes = await visualrec.testClassifierURL(creds, modelid, projectid, imageurl);
            return res.json(classes);
        }
        else if (type === 'numbers') {
            const numberdata = req.body.numbers;
            if (!numberdata || numberdata.length === 0) {
                return errors.missingData(res);
            }

            const classes = await numbers.testClassifier(userid, classid, projectid, numberdata);
            return res.json(classes);
        }
        else {
            return errors.missingData(res);
        }
    }
    catch (err) {
        log.error({ err }, 'Test error');
        return errors.unknownError(res, err);
    }
}




export default function registerApis(app: Express.Application) {

    app.get('/api/classes/:classid/students/:studentid/projects/:projectid/models',
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyProjectAccess,
            getModels);

    app.post('/api/classes/:classid/students/:studentid/projects/:projectid/models',
             auth.authenticate,
             auth.checkValidUser,
             auth.verifyProjectAccess,
             newModel);

    app.delete('/api/classes/:classid/students/:studentid/projects/:projectid/models/:modelid',
               auth.authenticate,
               auth.checkValidUser,
               auth.verifyProjectAccess,
               deleteModel);

    app.post('/api/classes/:classid/students/:studentid/projects/:projectid/models/:modelid/label',
             auth.authenticate,
             auth.checkValidUser,
             testModel);

}
