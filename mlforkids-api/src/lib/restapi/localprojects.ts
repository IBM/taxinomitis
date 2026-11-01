// external dependencies
import * as Express from 'express';
import { status as httpstatus } from 'http-status';
// local dependencies
import * as textmodels from '../training/textmodels';
import * as numbers from '../training/numbers';
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
    const classid: string = req.params.classid as string;
    const userid: string = req.params.studentid as string;
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
    const classid = req.params.classid as string;
    const userid = req.params.studentid as string;

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



function newLocalProjectNumberModel(req: auth.RequestWithUser, res: Express.Response) {
    let request: { project: Objects.Project, training: Objects.NumberTraining[] };
    try {
        const studentid = req.params.studentid as string;
        request = numbers.validateLocalProjectTrainingRequest(req.body, studentid);
    }
    catch (err) {
        log.error({ err, func: 'newLocalProjectNumberModel', payload : req.body }, 'Failed to parse training data');
        return errors.missingData(res);
    }

    return numbers.trainClassifier(request.project, request.training, request.project.fields as Objects.NumbersProjectField[])
        .then((model) => {
            return res.status(httpstatus.CREATED).json(model);
        })
        .catch((err) => {
            return errors.unknownError(res, err);
        });
}



async function newLocalProjectModel(req: auth.RequestWithLocalProject, res: Express.Response) {
    if (req.project.type !== 'text') {
        return errors.unknownError(res, new Error('Unexpected project type'));
    }

    if (!textmodels.validateTraining(req.body.training)) {
        return errors.missingData(res);
    }
    if (!textmodels.isPlainTextTraining(req.body.training)) {
        return errors.notPlainText(res);
    }
    let training: TrainingTypes.ConversationTrainingData;
    try {
        training = textmodels.sanitizeTraining(req.body.training);
    }
    catch (err) {
        log.error({ err, func : 'newLocalProjectModel' }, 'Failed to parse training data');
        return errors.missingData(res);
    }

    try {
        const model = await textmodels.trainClassifierForProject(req.project, training);
        res.status(httpstatus.CREATED).json(returnTextClassifier(model));

        // lazily (after returning response to the user) update
        //  the expiry date and labels for the project
        const updatedProject = req.project;
        updatedProject.labels = textmodels.getLabelNamesFromTraining(req.body.training);
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

    const classid = req.params.classid as string;
    const projectid = req.params.projectid as string;

    try {
        let classifiers: any[];
        const tenant = await store.getClassTenant(classid);
        classifiers = await store.getTextClassifiers(projectid);
        classifiers = await textmodels.getModelStatuses(tenant, classifiers);
        classifiers = classifiers.map(returnTextClassifier);
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

    const classid = req.params.classid as string;
    const projectid = req.params.projectid as string;
    const modelid = req.params.modelid as string;

    try {
        const tenant = await store.getClassTenant(classid);
        const workspace = await store.getTextClassifier(projectid, modelid);
        await textmodels.deleteClassifier(tenant, workspace);
        res.sendStatus(httpstatus.NO_CONTENT);

        // lazily (after returning response to the user) update
        //  the expiry date for the project
        store.updateLocalProject(req.project);
    }
    catch (err) {
        if (err.message === 'Unexpected response when retrieving text classifier details')
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

    const classid = req.params.classid as string;
    const projectid = req.params.projectid as string;
    const modelid = req.params.modelid as string;
    const requestTimestamp = new Date();

    const text = req.body.text;
    if (!text) {
        return errors.missingData(res);
    }

    try {
        const tenant = await store.getClassTenant(classid);
        const classes = await textmodels.classifyModel(tenant, projectid, modelid, requestTimestamp, text);
        return res.json(classes);
    }
    catch (err) {
        return errors.watsonAssistantModelTestFailure(res, err);
    }
}



function returnTextClassifier(classifier: TrainingTypes.TextClassifier) {
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
             errors.expectsBody,
             auth.authenticate,
             auth.checkValidUser,
             // @ts-expect-error custom middleware not understood by linter
             createLocalProject);

    app.put(urls.LOCALPROJECT,
            errors.expectsBody,
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

    app.post(urls.LOCALNUMBERSMODELS,
             errors.expectsBody,
             auth.authenticate,
             auth.checkValidUser,
             auth.verifyLocalModelsAuth,
             // @ts-expect-error custom middleware not understood by linter
             newLocalProjectNumberModel);

    app.post(urls.LOCALMODELS,
             errors.expectsBody,
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
             errors.expectsBody,
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