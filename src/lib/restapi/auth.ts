// external dependencies
import * as Express from 'express';
import * as jwt from 'express-jwt';
// local dependencies
import * as errors from './errors';



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

