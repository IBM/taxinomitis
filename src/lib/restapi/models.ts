// external dependencies
import * as Express from 'express';
import * as httpstatus from 'http-status';
// local dependencies
import * as auth from './auth';
import * as store from '../db/store';
import * as Objects from '../db/db-types';
import * as Types from '../training/training-types';
import * as conversation from '../training/conversation';
import * as numbers from '../training/numbers';
import * as errors from './errors';
import loggerSetup from '../utils/logger';


const log = loggerSetup();



function returnConversationWorkspace(classifier: Types.ConversationWorkspace) {
    return {
        classifierid : classifier.workspace_id,
        updated : classifier.updated,
        name : classifier.name,
        status : classifier.status,
    };
}
function returnNumberClassifier(classifier: Types.NumbersClassifier) {
    classifier.updated = classifier.created;
    return classifier;
}



async function getModels(req: Express.Request, res: Express.Response) {
    const classid = req.params.classid;
    const userid = req.params.studentid;
    const projectid = req.params.projectid;

    const project = await store.getProject(projectid);
    if (!project) {
        return errors.notFound(res);
    }
    if (project.classid !== classid || project.userid !== userid) {
        return errors.forbidden(res);
    }

    let classifiers;
    switch (project.type) {
    case 'text':
        classifiers = await store.getConversationWorkspaces(project.id);
        classifiers = await conversation.getClassifierStatuses(classid, classifiers);
        classifiers = classifiers.map(returnConversationWorkspace);
        break;
    case 'images':
        // do nothing
        classifiers = [];
        break;
    case 'numbers':
        classifiers = await store.getNumbersClassifiers(projectid);
        break;
    }

    return res.json(classifiers);
}

async function newModel(req: Express.Request, res: Express.Response) {
    const classid = req.params.classid;
    const userid = req.params.studentid;
    const projectid = req.params.projectid;

    const project = await store.getProject(projectid);
    if (!project) {
        return errors.notFound(res);
    }
    if (project.classid !== classid || project.userid !== userid) {
        return errors.forbidden(res);
    }

    if (project.type === 'text') {
        try {
            const model = await conversation.trainClassifier(userid, classid, project);
            return res.status(httpstatus.CREATED).json(returnConversationWorkspace(model));
        }
        catch (err) {
            return errors.unknownError(res, err);
        }
    }
    else if (project.type === 'numbers') {
        try {
            const model = await numbers.trainClassifier(userid, classid, projectid);
            return res.status(httpstatus.CREATED).json(returnNumberClassifier(model));
        }
        catch (err) {
            return errors.unknownError(res, err);
        }
    }

    return errors.notImplementedYet(res);
}


async function deleteModel(req: Express.Request, res: Express.Response) {
    const classid = req.params.classid;
    const userid = req.params.studentid;
    const projectid = req.params.projectid;
    const modelid = req.params.modelid;

    const project = await store.getProject(projectid);
    if (!project) {
        return errors.notFound(res);
    }
    if (project.classid !== classid || project.userid !== userid) {
        return errors.forbidden(res);
    }

    try {
        if (project.type === 'text') {
            await conversation.deleteClassifier(userid, classid, projectid, modelid);
            return res.sendStatus(httpstatus.NO_CONTENT);
        }
        else if (project.type === 'numbers') {
            await numbers.deleteClassifier(userid, classid, projectid);
            return res.sendStatus(httpstatus.NO_CONTENT);
        }
        else {
            return errors.notImplementedYet(res);
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


    try {
        if (type === 'text') {
            const text = req.body.text;
            if (!text) {
                return errors.missingData(res);
            }

            const creds = await store.getServiceCredentials(projectid, classid, userid, 'conv', modelid);
            const classes = await conversation.testClassifier(creds, modelid, text);
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
            getModels);

    app.post('/api/classes/:classid/students/:studentid/projects/:projectid/models',
             auth.authenticate,
             auth.checkValidUser,
             newModel);

    app.delete('/api/classes/:classid/students/:studentid/projects/:projectid/models/:modelid',
               auth.authenticate,
               auth.checkValidUser,
               deleteModel);

    app.post('/api/classes/:classid/students/:studentid/projects/:projectid/models/:modelid/label',
             auth.authenticate,
             auth.checkValidUser,
             testModel);

}
