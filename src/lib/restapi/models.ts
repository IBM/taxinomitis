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
            const model = await nlc.trainClassifier(userid, classid, projectid, project.name);
            return res.status(httpstatus.CREATED).json(returnNLCClassifier(model));
        }
        catch (err) {
            return errors.unknownError(res, err);
        }
    }

    return errors.notImplementedYet(res);
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

}
