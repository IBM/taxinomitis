// external dependencies
import * as Express from 'express';
import * as httpstatus from 'http-status';
// local dependencies
import loggerSetup from '../utils/logger';
const log = loggerSetup();


export function missingData(res: Express.Response) {
    return res.status(httpstatus.BAD_REQUEST).json({ error : 'Missing data' });
}
export function notFound(res: Express.Response) {
    return res.status(httpstatus.NOT_FOUND).send({ error : 'Not found' });
}
export function notAuthorised(res: Express.Response) {
    return res.status(httpstatus.UNAUTHORIZED).send({ error : 'Not authorised' });
}
export function forbidden(res: Express.Response) {
    return res.status(httpstatus.FORBIDDEN).send({ error : 'Invalid access' });
}
export function supervisorOnly(res: Express.Response) {
    return res.status(httpstatus.FORBIDDEN).send({ error : 'Only supervisors are allowed to invoke this'});
}
export function unknownError(res: Express.Response, err) {
    if (!err || Object.keys(err).length === 0) {
        err = { error : 'Unknown error' };
    }
    return res.status(httpstatus.INTERNAL_SERVER_ERROR).send(err);
}


export function registerErrorHandling(app: Express.Application) {
    app.use((err, req, res, next) => {
        if (err.name === 'UnauthorizedError') {
            return notAuthorised(res);
        }

        log.error({ err }, 'Unhandled exception');

        next();
    });
}
