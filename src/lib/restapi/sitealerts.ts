// external dependencies
import * as Express from 'express';
import * as httpstatus from 'http-status';
// local dependencies
import * as errors from './errors';
import * as urls from './urls';
import * as auth from './auth';
import * as store from '../db/store';
import * as sitealerts from '../sitealerts';
import * as headers from './headers';
import * as Types from '../db/db-types';
import loggerSetup from '../utils/logger';

const log = loggerSetup();





function createSiteAlert(req: Express.Request, res: Express.Response) {
    if (!req.body ||
        !req.body.message || !req.body.audience ||
        !req.body.severity || !req.body.expiry)
    {
        return res.status(httpstatus.BAD_REQUEST)
                  .send({ error : 'Missing required field' });
    }

    store.storeSiteAlert(req.body.message,
                         req.body.url,
                         req.body.audience,
                         req.body.severity,
                         req.body.expiry)
        .then(() => {
            return sitealerts.refreshCache();
        })
        .then((alert) => {
            return res.json(alert);
        })
        .catch((err) => {
            if (err.statusCode === httpstatus.BAD_REQUEST) {
                return res.status(httpstatus.BAD_REQUEST).json({ error : err.message });
            }
            log.error({ err, func : 'createSiteAlert' }, 'Server error');
            errors.unknownError(res, err);
        });
}


function refreshSiteAlertCache(req: Express.Request, res: Express.Response) {
    sitealerts.refreshCache()
        .then((alert) => {
            return res.json({ ...alert, instance : process.env.CF_INSTANCE_INDEX });
        })
        .catch((err) => {
            log.error({ err, func : 'refreshSiteAlertCache' }, 'Server error');
            errors.unknownError(res, err);
        });
}

function getSiteAlert(type: Types.SiteAlertAudienceLabel, req: Express.Request, res: Express.Response) {
    const alert = sitealerts.getSiteAlert(type);
    res.set(headers.CACHE_1MINUTE);
    if (alert) {
        return res.json([ alert ]);
    }
    else {
        return res.json([]);
    }
}



function getPublicSiteAlerts(req: Express.Request, res: Express.Response) {
    getSiteAlert('public', req, res);
}
function getStudentSiteAlerts(req: Express.Request, res: Express.Response) {
    getSiteAlert('student', req, res);
}
function getTeacherSiteAlerts(req: Express.Request, res: Express.Response) {
    getSiteAlert('supervisor', req, res);
}


export default function registerApis(app: Express.Application) {

    app.post(urls.SITEALERTS,
             auth.authenticate,
             auth.checkValidUser,
             auth.requireSiteAdmin,
             createSiteAlert);

    app.put(urls.SITEALERTS_REFRESH,
            auth.authenticate,
            auth.checkValidUser,
            auth.requireSiteAdmin,
            refreshSiteAlertCache);

    app.get(urls.SITEALERTS_PUBLIC,
            getPublicSiteAlerts);

    app.get(urls.SITEALERTS_STUDENT,
            auth.authenticate,
            auth.checkValidUser,
            getStudentSiteAlerts);

    app.get(urls.SITEALERTS_TEACHER,
            auth.authenticate,
            auth.checkValidUser,
            auth.requireSupervisor,
            getTeacherSiteAlerts);
}
