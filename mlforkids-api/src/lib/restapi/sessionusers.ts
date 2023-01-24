// external dependencies
import * as httpstatus from 'http-status';
import * as Express from 'express';
// local dependencies
import * as errors from './errors';
import * as urls from './urls';
import * as auth from './auth';
import * as sessionusers from '../sessionusers';
import * as Objects from '../db/db-types';
import * as notifications from '../notifications/slack';
import loggerSetup from '../utils/logger';

const log = loggerSetup();






function createSessionUser(req: Express.Request, res: Express.Response)
{
    const requestOrigin = req.header('cf-ipcountry');

    sessionusers.createSessionUser(requestOrigin)
        .then((user) => {
            return res.status(httpstatus.CREATED).json({
                id : user.id,
                token : user.token,
                sessionExpiry : user.sessionExpiry,
                jwt : auth.generateJwt(user),
            });
        })
        .catch((err) => {
            notifications.notify('Failed to create "Try it now" session for ' + requestOrigin + ' : ' + err.message,
                                 notifications.SLACK_CHANNELS.CRITICAL_ERRORS);

            if (err.message === sessionusers.ERROR_MESSAGES.CLASS_FULL) {
                log.debug({ err, requestOrigin }, 'Failed to create session user');
                return res.status(httpstatus.PRECONDITION_FAILED).json({ error : err.message });
            }
            else {
                log.error({ err, requestOrigin }, 'Unexpected failure to create session user');
                return errors.unknownError(res, err);
            }
        });
}



function deleteSessionUser(req: auth.RequestWithUser, res: Express.Response)
{
    const userid = req.params.studentid;

    if (req.user.sub !== userid) {
        // attempt to delete a different session user
        return errors.forbidden(res);
    }

    if (!(req.user.session &&
          req.user.session.id && req.user.session.token && req.user.session.sessionExpiry))
    {
        // missing information about the user
        return errors.missingData(res);
    }

    const userToDelete: Objects.TemporaryUser = {
        id: req.user.session.id,
        token: req.user.session.token,
        sessionExpiry: req.user.session.sessionExpiry,
    };

    sessionusers.deleteSessionUser(userToDelete)
        .then(() => {
            res.sendStatus(httpstatus.NO_CONTENT);
        })
        .catch((err) => {
            errors.unknownError(res, err);
        });
}




export default function registerApis(app: Express.Application) {

    // API for creating new try-it-now accounts so
    //  this API can't be an authenticated one
    app.post(urls.SESSION_USERS, createSessionUser);


    app.delete(urls.SESSION_USER,
        auth.authenticate,
        auth.checkValidUser,
        // @ts-ignore
        deleteSessionUser);

}
