// external dependencies
import * as Express from 'express';
import * as httpstatus from 'http-status';
// local dependencies
import * as auth from './auth';
import * as store from '../db/store';
import * as Objects from '../db/db-types';
import * as nlc from '../training/nlc';
import * as errors from './errors';



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
        break;
    case 'images':
    case 'numbers':
        // do nothing
        classifiers = [];
        break;
    }

    return res.json(classifiers);
}




export default function registerApis(app: Express.Application) {

    app.get('/api/classes/:classid/students/:studentid/projects/:projectid/models',
            auth.authenticate,
            auth.checkValidUser,
            getModels);

}
