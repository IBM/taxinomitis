// external dependencies
import * as Express from 'express';
import { status as httpstatus } from 'http-status';
// local dependencies
import * as conversation from '../training/conversation';
import * as notifications from '../notifications/slack';
import loggerSetup from '../utils/logger';
const log = loggerSetup();


export function missingData(res: Express.Response) {
    return res.status(httpstatus.BAD_REQUEST).json({ error : 'Missing data' });
}
export function notFound(res: Express.Response) {
    return res.status(httpstatus.NOT_FOUND).json({ error : 'Not found' });
}
export function notAuthorised(res: Express.Response) {
    return res.status(httpstatus.UNAUTHORIZED).json({ error : 'Not authorised' });
}
export function forbidden(res: Express.Response) {
    return res.status(httpstatus.FORBIDDEN).json({ error : 'Invalid access' });
}
export function supervisorOnly(res: Express.Response) {
    return res.status(httpstatus.FORBIDDEN).json({ error : 'Only supervisors are allowed to invoke this'});
}
export function requestTooLarge(res: Express.Response) {
    return res.status(httpstatus.REQUEST_ENTITY_TOO_LARGE).json({ error : 'Payload too large' });
}
export function notImplemented(res: Express.Response) {
    return res.status(httpstatus.NOT_IMPLEMENTED).json({ error : 'Not implemented' });
}
export function siteInMaintenanceMode(req: Express.Request, res: Express.Response) {
    return res.status(httpstatus.SERVICE_UNAVAILABLE).json({ error : 'Site is temporarily down for maintenance' });
}
export function watsonAssistantModelCreationFailure(res: Express.Response, err: NodeJS.ErrnoException | any) {
    if (err.message === conversation.ERROR_MESSAGES.INSUFFICIENT_API_KEYS) {
        return res.status(httpstatus.CONFLICT).send({ code : 'MLMOD01', error : err.message });
    }
    else if (err.message === conversation.ERROR_MESSAGES.POOL_EXHAUSTED) {
        log.error({ err }, 'Managed classes have exhausted the pool of Watson Assistant keys');
        notifications.notify('Exhausted managed pool of Watson Assistant keys',
                             notifications.SLACK_CHANNELS.CRITICAL_ERRORS);
        return res.status(httpstatus.CONFLICT).send({ code : 'MLMOD15', error : err.message });
    }
    else if (err.message === conversation.ERROR_MESSAGES.API_KEY_RATE_LIMIT) {
        return res.status(httpstatus.TOO_MANY_REQUESTS).send({ code : 'MLMOD02', error : err.message });
    }
    else if (err.message === conversation.ERROR_MESSAGES.MODEL_NOT_FOUND) {
        return res.status(httpstatus.NOT_FOUND)
                  .send({ code : 'MLMOD03', error : err.message + ' Please try again' });
    }
    else if (err.statusCode === httpstatus.UNAUTHORIZED) {
        return res.status(httpstatus.CONFLICT)
                .send({
                    code : 'MLMOD04',
                    error : 'The Watson credentials being used by your class were rejected. ' +
                            'Please let your teacher or group leader know.',
                });
    }
    else if (err.message === 'Unexpected response when retrieving service credentials') {
        return res.status(httpstatus.CONFLICT)
            .send({
                code : 'MLMOD05',
                error : 'No Watson credentials have been set up for training text projects. ' +
                        'Please let your teacher or group leader know.',
            });
    }
    else {
        return unknownError(res, err);
    }
}
export function watsonAssistantModelTestFailure(res: Express.Response, err: NodeJS.ErrnoException | any) {
    if (err.message === conversation.ERROR_MESSAGES.MODEL_NOT_FOUND) {
        return res.status(httpstatus.NOT_FOUND).send({ error : err.message + ' Refresh the page' });
    }
    if (err.message === conversation.ERROR_MESSAGES.TEXT_TOO_LONG) {
        return res.status(httpstatus.BAD_REQUEST).send({ error : err.message });
    }
    if (err.message === 'Unexpected response when retrieving the service credentials') {
        return notFound(res);
    }
    if (err.message === conversation.ERROR_MESSAGES.SERVICE_ERROR) {
        return res.status(httpstatus.SERVICE_UNAVAILABLE).send({ error : err.message });
    }
    log.error({ err }, 'Test error');
    return unknownError(res, err);
}
export function unknownError(res: Express.Response, err: NodeJS.ErrnoException | any) {
    if (err && err.sqlState) {
        err = {
            error : 'Error accessing the database used to store data',
            detail : {
                code : err.code,
                errno : err.errno,
                sqlState : err.sqlState,
                message : err.message,
            },
        };
    }
    else if (err && err.message) {
        err = { error : err.message };
    }
    else if (!err || Object.keys(err).length === 0) {
        err = { error : 'Unknown error' };
    }

    return res.status(httpstatus.INTERNAL_SERVER_ERROR).json(err);
}

export function expectsBody(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
    if (!req.body) {
        return missingData(res);
    }
    next();
}

export function registerErrorHandling(app: Express.Application) {
    app.use((err: Error,
             req: Express.Request,
             res: Express.Response,
             next: (e?: Error) => void) =>
    {
        if (err) {
            if (err.name === 'UnauthorizedError') {
                return notAuthorised(res);
            }
            if (err.name === 'PayloadTooLargeError') {
                return requestTooLarge(res);
            }
            const expressErr = err as any;
            if (expressErr.status === httpstatus.BAD_REQUEST) {
                return missingData(res);
            }

            log.error({ err, url : req.url }, 'Unhandled exception');
        }

        next(err);
    });
}


export function register404Handler(app: Express.Application) {
    app.use((req: Express.Request,
             res: Express.Response,
             /*next: (e?: Error) => void*/) =>
    {
        if (common404Urls.includes(req.url)) {
            return notFound(res);
        }

        log.info({ req, res }, '404');

        if (req.accepts('html')) {
            res.redirect('/#!/404');
        }
        else {
            notFound(res);
        }
    });
}

// well-known URLs that clients often attempt to fetch, even
//  though they don't exist on this site
// 404's from these URLs don't suggest a problem
const common404Urls = [
    '/.well-known/assetlinks.json',
    '/.well-known/passkey-endpoints',
];