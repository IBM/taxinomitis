// external dependencies
import * as Express from 'express';
import * as jwt from 'express-jwt';
import * as jwksRsa from 'jwks-rsa';
import * as httpstatus from 'http-status';
// local dependencies
import * as errors from './errors';
import * as store from '../db/store';
import * as Objects from '../db/db-types';


export interface RequestWithProject extends Express.Request {
    project: Objects.Project;
}


export const authenticate = jwt({
    secret : jwksRsa.expressJwtSecret({
        cache : true,
        rateLimit : true,
        jwksRequestsPerMinute : 5,
        jwksUri : `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
    }),

    // cf. https://github.com/auth0/express-jwt/issues/171#issuecomment-305876709
    // audience : process.env.AUTH0_AUDIENCE,
    aud : process.env.AUTH0_AUDIENCE,

    issuer : `https://${process.env.AUTH0_DOMAIN}/`,
    algorithms : ['RS256'],
});



function getValuesFromToken(req: Express.Request) {
    if (req.user && !req.user.app_metadata) {
        req.user.app_metadata = {
            role : req.user['https://machinelearningforkids.co.uk/api/role'],
            tenant : req.user['https://machinelearningforkids.co.uk/api/tenant'],
        };
    }
}


export function checkValidUser(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
    getValuesFromToken(req);

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


export async function ensureUnmanaged(req: Express.Request, res: Express.Response, next) {
    const tenant = req.params.classid;

    try {
        const policy = await store.getClassTenant(tenant);
        if (policy.isManaged) {
            return res.status(httpstatus.FORBIDDEN)
                      .json({ error : 'Access to API keys is forbidden for managed tenants' });
        }

        next();
    }
    catch (err) {
        return next(err);
    }
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
