// external dependencies
import * as Express from 'express';
import * as jwt from 'express-jwt';
import * as jwksRsa from 'jwks-rsa';
import * as jwtDecode from 'jwt-decode';
import * as jsonwebtoken from 'jsonwebtoken';
import * as httpstatus from 'http-status';
// local dependencies
import * as errors from './errors';
import * as env from '../utils/env';
import * as store from '../db/store';
import * as sessionusers from '../sessionusers';
import * as Objects from '../db/db-types';


export interface RequestWithProject extends Express.Request {
    project: Objects.Project;
}



const JWT_SECRET: string = process.env[env.AUTH0_CLIENT_SECRET] as string;



export function generateJwt(payload: object): string {
    return jsonwebtoken.sign(payload, JWT_SECRET, {
        algorithm: 'HS256',
    });
}




/**
 * Auth middleware for all normal users - who are authenticated by Auth0.
 */
const auth0Authenticate = jwt({
    secret : jwksRsa.expressJwtSecret({
        cache : true,
        rateLimit : true,
        jwksRequestsPerMinute : 5,
        jwksUri : `https://${process.env[env.AUTH0_DOMAIN]}/.well-known/jwks.json`,
    }),

    // cf. https://github.com/auth0/express-jwt/issues/171#issuecomment-305876709
    // audience : process.env[env.AUTH0_AUDIENCE],
    aud : process.env[env.AUTH0_AUDIENCE],

    issuer : `https://${process.env[env.AUTH0_CUSTOM_DOMAIN]}/`,
    algorithms : [ 'RS256' ],
});



/**
 * Auth middleware for users in the session-users class - who are authenticated locally.
 */
async function sessionusersAuthenticate(
    jwtTokenString: string,
    req: Express.Request, res: Express.Response, next: Express.NextFunction)
{
    let decoded: Objects.TemporaryUser;

    try {
        decoded = jwtDecode(jwtTokenString);
    }
    catch (err) {
        return errors.notAuthorised(res);
    }

    try {
        const sessionUserIsAuthenticated = await sessionusers.checkSessionToken(req.params.studentid, decoded.token);

        if (sessionUserIsAuthenticated) {
            req.user = {
                sub : decoded.id,
                app_metadata : {
                    role : 'student',
                    tenant : sessionusers.CLASS_NAME,
                },
                session : decoded,
            };

            next();
        }
        else {
            errors.notAuthorised(res);
        }
    }
    catch (err) {
        next(err);
    }
}





export function authenticate(req: Express.Request, res: Express.Response, next: Express.NextFunction) {

        // the request is trying to access a resource in the session-users class
    if ((req.params.classid === sessionusers.CLASS_NAME) &&
        // the request includes an auth header
        req.headers.authorization &&
        typeof req.headers.authorization === 'string' &&
        // the auth header has a bearer token
        (req.headers.authorization.split(' ')[0] === 'Bearer'))
    {
        // Access to resources in the session-users class is managed locally
        const jwtToken = req.headers.authorization.split(' ')[1];
        sessionusersAuthenticate(jwtToken, req, res, next);
    }
    else {
        // Access to ALL other resources is managed using Auth0
        auth0Authenticate(req, res, next);
    }
}







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
        errors.notAuthorised(res);
        return;
    }
    if (req.params.classid && req.user.app_metadata.tenant !== req.params.classid) {
        errors.forbidden(res);
        return;
    }

    next();
}

export function requireSupervisor(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
    if (req.user.app_metadata.role !== 'supervisor') {
        errors.supervisorOnly(res);
        return;
    }

    next();
}

export function requireSiteAdmin(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
    getValuesFromToken(req);

    if (req.user.app_metadata.role !== 'siteadmin') {
        return res.status(httpstatus.FORBIDDEN).json({ error : 'Forbidden' });
    }

    next();
}


export async function ensureUnmanaged(
    req: Express.Request, res: Express.Response,
    next: (err?: Error) => void)
{
    const tenant = req.params.classid;

    try {
        const policy = await store.getClassTenant(tenant);
        if (policy.isManaged) {
            res.status(httpstatus.FORBIDDEN)
               .json({ error : 'Access to API keys is forbidden for managed tenants' });
            return;
        }

        next();
    }
    catch (err) {
        next(err);
    }
}



enum ACCESS_TYPE {
    owneronly,     // access is allowed only to users who created the resource being accessed
                   //
    crowdsourced,  // access is allowed to users in the same class as the creator of the resource being accessed
                   //   as long as the resource has been flagged as "crowd-sourced"
    teacheraccess, // access is allowed to the user who created the resource being accessed OR
                   //         their teacher
}


/**
 * Express middleware to verify if the request should be authorised.
 *
 * @param isCrowdSourcedAllowed - if true, access is authorised for users in the same class as the project
 * @param isTeacherAccessAllowed - if true, access is authorised for teachers in the same class as the project
 */
async function verifyProjectAuth(
    req: Express.Request,
    res: Express.Response,
    next: (e?: Error) => void,
    allowedAccessTypes: ACCESS_TYPE)
{
    const classid: string = req.params.classid;
    const userid: string = req.params.studentid;
    const projectid: string = req.params.projectid;

    try {
        const project = await store.getProject(projectid);

        if (!project) {
            // attempt to access non-existent project
            return errors.notFound(res);
        }
        if (project.classid !== classid) {
            // attempt to access a project from another class/tenant
            return errors.forbidden(res);
        }

        const isOwner = req.user && (project.userid === req.user.sub) && (project.userid === userid);
        if (isOwner === false) {
            // The request has come from a user who is not the owner of
            //  the project that they are trying to access.
            //
            // That might be okay under some circumstances...

            if (// owneronly : if they're not the owner, this access isn't allowed
                (allowedAccessTypes === ACCESS_TYPE.owneronly) ||
                // crowdsourced : if the project isn't crowd-sourced, this access isn't allowed
                (allowedAccessTypes === ACCESS_TYPE.crowdsourced && !project.isCrowdSourced) ||
                // teacheraccess : if the user isn't a teacher, this access isn't allowed
                (allowedAccessTypes === ACCESS_TYPE.teacheraccess && req.user.app_metadata.role !== 'supervisor'))
            {
                return errors.forbidden(res);
            }

            // otherwise, carry on - it's okay
        }

        const modifiedRequest: RequestWithProject = req as RequestWithProject;
        modifiedRequest.project = project;

        next();
    }
    catch (err) {
        return next(err);
    }
}


/**
 * API Auth middleware.
 *
 * Ensures that the user is accessing a project that they
 *  have exclusive rights to.
 */
export async function verifyProjectOwner(
    req: Express.Request,
    res: Express.Response,
    next: (e?: Error) => void)
{
    verifyProjectAuth(req, res, next, ACCESS_TYPE.owneronly);
}

/**
 * API Auth middleware.
 *
 * Ensures that the user is accessing a project that they
 *  have at least read access to.
 */
export async function verifyProjectAccess(
    req: Express.Request,
    res: Express.Response,
    next: (e?: Error) => void)
{
    verifyProjectAuth(req, res, next, ACCESS_TYPE.crowdsourced);
}

/**
 * API Auth middleware.
 *
 * Ensures that the user is accessing a project that they
 *  have exclusive rights to, or they are the teacher of
 *  the owner of the project.
 */
export async function verifyProjectOwnerOrTeacher(
    req: Express.Request,
    res: Express.Response,
    next: (e?: Error) => void)
{
    verifyProjectAuth(req, res, next, ACCESS_TYPE.teacheraccess);
}
