// external dependencies
import * as httpstatus from 'http-status';
import * as Express from 'express';
// local dependencies
import * as auth0 from '../auth0/admin';
import * as auth from './auth';
import * as urls from './urls';
import * as errors from './errors';




export function getClasses(req: Express.Request, res: Express.Response) {
    return auth0.getTenants()
        .then((tenants) => {
            res.setHeader('Cache-Control', 'max-age=3600');

            return res.json(tenants);
        })
        .catch((err) => {
            return errors.unknownError(res, err);
        });
}




export default function registerApis(app: Express.Application) {

    app.get(urls.CLASSES,
        auth.authenticate,
        auth.requireSiteAdmin,
        getClasses);

}
