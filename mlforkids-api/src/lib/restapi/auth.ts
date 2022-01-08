// external dependencies
import * as Express from 'express';
import * as jwt from 'express-jwt';
import * as jwksRsa from 'jwks-rsa';
import jwtDecode from 'jwt-decode';
import * as jsonwebtoken from 'jsonwebtoken';
import * as httpstatus from 'http-status';
// local dependencies
import * as errors from './errors';
import * as store from '../db/store';
import * as authvalues from '../auth0/values';
import * as sessionusers from '../sessionusers';
import * as Objects from '../db/db-types';


export interface RequestWithProject extends Express.Request {
    project: Objects.Project;
}
export interface RequestWithTenant extends Express.Request {
    tenant: Objects.ClassTenant;
}
export interface RequestWithUser extends Express.Request {
    user: {
        readonly sub: string;
        app_metadata: {
            readonly role?: 'student' | 'supervisor' | 'siteadmin';
            readonly tenant?: string;
        };
        readonly session?: Objects.TemporaryUser;

        readonly 'https://machinelearningforkids.co.uk/api/role'?: 'student' | 'supervisor' | 'siteadmin';
        readonly 'https://machinelearningforkids.co.uk/api/tenant'?: string;
    };
}

const JWT_SECRET: string = authvalues.CLIENT_SECRET as string;



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
        jwksUri : 'https://' + authvalues.DOMAIN + '/.well-known/jwks.json',
    }),

    // cf. https://github.com/auth0/express-jwt/issues/171#issuecomment-305876709
    // audience : process.env[env.AUTH0_AUDIENCE],
    aud : authvalues.AUDIENCE,

    issuer : 'https://' + authvalues.CUSTOM_DOMAIN + '/',
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
            const reqWithUser = req as RequestWithUser;
            reqWithUser.user = {
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







function getValuesFromToken(req: RequestWithUser) {
    if (req.user && !req.user.app_metadata) {
        req.user.app_metadata = {
            role : req.user['https://machinelearningforkids.co.uk/api/role'],
            tenant : req.user['https://machinelearningforkids.co.uk/api/tenant'],
        };
    }
}


export function checkValidUser(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
    const reqWithUser = req as RequestWithUser;

    getValuesFromToken(reqWithUser);

    if (!reqWithUser.user || !reqWithUser.user.app_metadata) {
        errors.notAuthorised(res);
        return;
    }
    if (reqWithUser.params.classid &&
        reqWithUser.user.app_metadata.tenant !== reqWithUser.params.classid)
    {
        errors.forbidden(res);
        return;
    }

    next();
}

export function requireSupervisor(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
    const reqWithUser = req as RequestWithUser;

    if (reqWithUser.user.app_metadata.role !== 'supervisor') {
        errors.supervisorOnly(res);
        return;
    }

    next();
}

export function requireSiteAdmin(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
    const reqWithUser = req as RequestWithUser;

    getValuesFromToken(reqWithUser);

    if (reqWithUser.user.app_metadata.role !== 'siteadmin') {
        return res.status(httpstatus.FORBIDDEN).json({ error : 'Forbidden' });
    }

    next();
}



export async function ensureUnmanagedTenant(
    req: Express.Request, res: Express.Response,
    next: (err?: Error) => void)
{
    const tenant = req.params.classid;

    try {
        const policy = await store.getClassTenant(tenant);
        if (policy.tenantType !== Objects.ClassTenantType.UnManaged) {
            res.status(httpstatus.FORBIDDEN)
               .json({ error : 'Access to API keys is forbidden for managed tenants' });
            return;
        }

        const reqWithTenant = req as RequestWithTenant;
        reqWithTenant.tenant = policy;

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
    review,        // access is allowed to users in the same class as the creator of the resource being accessed
                   //   as long as the resource has been flagged as "crowd-sourced", OR
                   //   the teacher of the project owner
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

    const reqWithUser = req as RequestWithUser;

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

        const isOwner = reqWithUser.user &&
                        (project.userid === reqWithUser.user.sub) &&
                        (project.userid === userid);
        if (isOwner === false) {
            // The request has come from a user who is not the owner of
            //  the project that they are trying to access.
            //
            // That might be okay under some circumstances...

            // owneronly : if they're not the owner, this access isn't allowed
            if (allowedAccessTypes === ACCESS_TYPE.owneronly) {
                return errors.forbidden(res);
            }
            // crowdsourced : if the project isn't crowd-sourced, this access isn't allowed
            if (allowedAccessTypes === ACCESS_TYPE.crowdsourced) {
                if (!project.isCrowdSourced) {
                    return errors.forbidden(res);
                }
            }
            // teacheraccess : if the user isn't a teacher, this access isn't allowed
            if (allowedAccessTypes === ACCESS_TYPE.teacheraccess) {
                if (reqWithUser.user.app_metadata.role !== 'supervisor') {
                    return errors.forbidden(res);
                }
            }
            // review : if the project isn't crowd-sourced or the user isn't a teacher, this access isn't allowed
            if (allowedAccessTypes === ACCESS_TYPE.review) {
                if (reqWithUser.user.app_metadata.role !== 'supervisor' && !project.isCrowdSourced)
                {
                    return errors.forbidden(res);
                }
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

/**
 * API Auth middleware.
 *
 * Ensures that the user is accessing a project that they
 *  have at least read access to, or they are the teacher of
 *  the owner of the project.
 */
export async function verifyProjectAccessOrTeacher(
    req: Express.Request,
    res: Express.Response,
    next: (e?: Error) => void)
{
    verifyProjectAuth(req, res, next, ACCESS_TYPE.review);
}
