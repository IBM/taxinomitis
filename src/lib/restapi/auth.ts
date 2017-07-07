// external dependencies
import * as Express from 'express';
import * as jwt from 'express-jwt';
// local dependencies
import * as errors from './errors';
import * as store from '../db/store';
import * as Objects from '../db/db-types';



export interface RequestWithProject extends Express.Request {
    project: Objects.Project;
}




export const authenticate = jwt({
    secret: process.env.AUTH0_CLIENT_SECRET,
    audience: process.env.AUTH0_CLIENT_ID,
    issuer: 'https://' + process.env.AUTH0_DOMAIN + '/',
    algorithms: ['HS256'],
});


export function checkValidUser(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
    if (!req.user || !req.user.app_metadata) {
        return errors.notAuthorised(res);
    }
    if (req.user.app_metadata.tenant !== req.params.classid) {
        return errors.forbidden(res);
    }

    next();
}

export function requireSupervisor(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
    if (req.user.app_metadata.role !== 'supervisor') {
        return errors.supervisorOnly(res);
    }

    next();
}


export async function verifyProjectAccess(req: Express.Request, res: Express.Response, next) {
    const classid: string = req.params.classid;
    const userid: string = req.params.studentid;
    const projectid: string = req.params.projectid;

    try {
        const project = await store.getProject(projectid);
        if (!project) {
            return errors.notFound(res);
        }
        if (project.classid !== classid || project.userid !== userid) {
            return errors.forbidden(res);
        }

        const modifiedRequest: RequestWithProject = req as RequestWithProject;
        modifiedRequest.project = project;

        next();
    }
    catch (err) {
        return next(err);
    }
}
