// external dependencies
import * as Express from 'express';
import * as httpstatus from 'http-status';
// local dependencies
import * as conversation from '../training/conversation';
import * as auth from './auth';
import * as store from '../db/store';
import * as Objects from '../db/db-types';
import * as TrainingTypes from '../training/training-types';
import * as keys from '../scratchx/keys';
import * as errors from './errors';
import * as headers from './headers';
import * as urls from './urls';
import loggerSetup from '../utils/logger';

const log = loggerSetup();



async function createLocalProject(req: auth.RequestWithUser, res: Express.Response) {
    // path params
    const classid: string = req.params.classid;
    const userid: string = req.params.studentid;
    // payload params
    const type: Objects.ProjectTypeLabel = req.body.type;
    const name: string = req.body.name;
    const labels: string[] = req.body.labels;

    try {
        const project = await store.storeLocalProject(userid, classid, type, name, labels);
        return res.status(httpstatus.CREATED).json(project);
    }
    catch (err) {
        if (err.statusCode === httpstatus.BAD_REQUEST) {
            return res.status(httpstatus.BAD_REQUEST).json({ error : err.message });
        }
        log.error({ err, func : 'createLocalProject', request : req.body }, 'Server error');
        errors.unknownError(res, err);
    }
}



async function updateLocalProject(req: auth.RequestWithLocalProject, res: Express.Response) {
    try {
        const project = req.project;
        // only property we let clients update is the list of labels
        project.labels = req.body.labels;

        await store.updateLocalProject(project);
        return res.status(httpstatus.OK).json(project);
    }
    catch (err) {
        if (err.statusCode === httpstatus.BAD_REQUEST) {
            return res.status(httpstatus.BAD_REQUEST).json({ error : err.message });
        }
        log.error({ err, func : 'updateLocalProject', request : req.body }, 'Server error');
        errors.unknownError(res, err);
    }
}



async function deleteLocalProject(req: auth.RequestWithLocalProject, res: Express.Response) {
    const classid = req.params.classid;
    const userid = req.params.studentid;

    try {
        const project: Objects.LocalProject = req.project;
        await store.deleteEntireProject(userid, classid, project);
        return res.sendStatus(httpstatus.NO_CONTENT);
    }
    catch (err) {
        log.error({ err, func : 'deleteLocalProject' }, 'Server error');
        errors.unknownError(res, err);
    }
}



async function newLocalProjectModel(req: auth.RequestWithLocalProject, res: Express.Response) {
    if (req.project.type !== 'text') {
        return errors.unknownError(res, new Error('Unexpected project type'));
    }

    if (!conversation.validateTraining(req.body.training)) {
        return errors.missingData(res);
    }
    let training: TrainingTypes.ConversationTrainingData;
    try {
        training = conversation.sanitizeTraining(req.body.training);
    }
    catch (err) {
        log.error({ err, func : 'newLocalProjectModel' }, 'Failed to parse training data');
        return errors.missingData(res);
    }

    try {
        const model = await conversation.trainClassifierForProject(req.project, training);
        res.status(httpstatus.CREATED).json(returnConversationWorkspace(model));

        // lazily (after returning response to the user) update
        //  the expiry date and labels for the project
        const updatedProject = req.project;
        updatedProject.labels = conversation.getLabelNamesFromTraining(req.body.training);
        store.updateLocalProject(req.project);
    }
    catch (err) {
        return errors.watsonAssistantModelCreationFailure(res, err);
    }
}



async function getLocalProjectModels(req: auth.RequestWithLocalProject, res: Express.Response) {
    if (req.project.type !== 'text') {
        return errors.unknownError(res, new Error('Unexpected project type'));
    }

    const classid = req.params.classid;
    const projectid = req.params.projectid;

    try {
        let classifiers: any[];
        const tenant = await store.getClassTenant(classid);
        classifiers = await store.getConversationWorkspaces(projectid);
        classifiers = await conversation.getClassifierStatuses(tenant, classifiers);
        classifiers = classifiers.map(returnConversationWorkspace);
        return res.set(headers.NO_CACHE).json(classifiers);
    }
    catch (err) {
        return errors.unknownError(res, err);
    }
}



async function deleteLocalProjectModel(req: auth.RequestWithLocalProject, res: Express.Response) {
    if (req.project.type !== 'text') {
        return errors.unknownError(res, new Error('Unexpected project type'));
    }

    const classid = req.params.classid;
    const projectid = req.params.projectid;
    const modelid = req.params.modelid;

    try {
        const tenant = await store.getClassTenant(classid);
        const workspace = await store.getConversationWorkspace(projectid, modelid);
        await conversation.deleteClassifier(tenant, workspace);
        res.sendStatus(httpstatus.NO_CONTENT);

        // lazily (after returning response to the user) update
        //  the expiry date for the project
        store.updateLocalProject(req.project);
    }
    catch (err) {
        if (err.message === 'Unexpected response when retrieving conversation workspace details')
        {
            return errors.notFound(res);
        }

        return errors.unknownError(res, err);
    }
}



async function testLocalProjectModel(req: auth.RequestWithLocalProject, res: Express.Response) {
    if (req.project.type !== 'text') {
        return errors.unknownError(res, new Error('Unexpected project type'));
    }

    const classid = req.params.classid;
    const projectid = req.params.projectid;
    const modelid = req.params.modelid;
    const credsid = req.body.credentialsid;
    const requestTimestamp = new Date();

    const text = req.body.text;
    if (!text || !credsid) {
        return errors.missingData(res);
    }

    try {
        const tenant = await store.getClassTenant(classid);
        const creds = await store.getBluemixCredentialsById(tenant.tenantType, credsid);

        const classes = await conversation.testClassifier(creds, modelid, requestTimestamp, projectid, text);
        return res.json(classes);
    }
    catch (err) {
        return errors.watsonAssistantModelTestFailure(res, err);
    }
}



function returnConversationWorkspace(classifier: TrainingTypes.ConversationWorkspace) {
    return {
        classifierid : classifier.workspace_id,
        credentialsid : classifier.credentialsid,
        updated : classifier.updated,
        expiry : classifier.expiry,
        name : classifier.name,
        status : classifier.status,
    };
}



async function getLocalProjectScratchKeys(req: auth.RequestWithLocalProject, res: Express.Response) {
    if (req.project.type !== 'text') {
        return errors.unknownError(res, new Error('Unexpected project type'));
    }

    const classid = req.project.classid;
    const userid = req.project.userid;
    const projectid = req.project.id;

    try {
        const scratchKeys = await store.findScratchKeys(userid, projectid, classid);

        if (scratchKeys.length === 0) {
            const newKeyInfo = await keys.createLocalKey(projectid);
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
        return errors.unknownError(res, err);
    }
}



export default function registerApis(app: Express.Application) {

    app.post(urls.LOCALPROJECTS,
             auth.authenticate,
             auth.checkValidUser,
             // @ts-expect-error custom middleware not understood by linter
             createLocalProject);

    app.put(urls.LOCALPROJECT,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyLocalProjectAuth,
            // @ts-expect-error custom middleware not understood by linter
            updateLocalProject);

    app.delete(urls.LOCALPROJECT,
               auth.authenticate,
               auth.checkValidUser,
               auth.verifyLocalProjectAuth,
               // @ts-expect-error custom middleware not understood by linter
               deleteLocalProject);

    app.post(urls.LOCALMODELS,
             auth.authenticate,
             auth.checkValidUser,
             auth.verifyLocalProjectAuth,
             // @ts-expect-error custom middleware not understood by linter
             newLocalProjectModel);

    app.get(urls.LOCALMODELS,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyLocalProjectAuth,
            // @ts-expect-error custom middleware not understood by linter
            getLocalProjectModels);

    app.post(urls.LOCALMODELTEST,
             auth.authenticate,
             auth.checkValidUser,
             auth.verifyLocalProjectAuth,
             // @ts-expect-error custom middleware not understood by linter
             testLocalProjectModel);

    app.delete(urls.LOCALMODEL,
               auth.authenticate,
               auth.checkValidUser,
               auth.verifyLocalProjectAuth,
               // @ts-expect-error custom middleware not understood by linter
               deleteLocalProjectModel);

    app.get(urls.LOCALSCRATCHKEYS,
            auth.authenticate,
            auth.checkValidUser,
            auth.verifyLocalProjectAuth,
            // @ts-expect-error custom middleware not understood by linter
            getLocalProjectScratchKeys);
}