// external dependencies
import * as Express from 'express';
import * as httpstatus from 'http-status';
// local dependencies
import * as auth from './auth';
import * as store from '../db/store';
import * as Objects from '../db/db-types';
import * as Types from '../training/training-types';
import * as nlc from '../training/nlc';
import * as errors from './errors';



function returnNLCClassifier(classifier: Types.NLCClassifier) {
    return {
        classifierid : classifier.classifierid,
        created : classifier.created,
        name : classifier.name,
        status : classifier.status,
        statusDescription : classifier.statusDescription,
    };
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
        classifiers = await store.getNLCClassifiers(projectid);
        classifiers = await nlc.getClassifierStatuses(classid, classifiers);
        classifiers = classifiers.map(returnNLCClassifier);
        break;
    case 'images':
    case 'numbers':
        // do nothing
        classifiers = [];
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
            const existingClassifiers = await store.countNLCClassifiers(classid);
            const tenantPolicy = await store.getClassTenant(classid);
            if (existingClassifiers >= tenantPolicy.maxNLCClassifiers) {
                return res.status(httpstatus.CONFLICT)
                          .send({ error : 'Your class already has created their maximum allowed number of models' });
            }

            const model = await nlc.trainClassifier(userid, classid, projectid, project.name);
            return res.status(httpstatus.CREATED).json(returnNLCClassifier(model));
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
            await nlc.deleteClassifier(userid, classid, projectid, modelid);
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
    const text = req.body.text;

    if (!text) {
        return errors.missingData(res);
    }

    let servicetype: Types.BluemixServiceType;
    if (type === 'text') {
        servicetype = 'nlc';
    }
    else {
        return errors.missingData(res);
    }

    try {
        const creds = await store.getServiceCredentials(projectid, classid, userid, servicetype, modelid);
        const classes = await nlc.testClassifier(creds, modelid, text);
        return res.json(classes);
    }
    catch (err) {
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
