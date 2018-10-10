// external dependencies
import * as Express from 'express';
// local dependencies
import * as auth0 from '../auth0/admin';
import * as auth from './auth';
import * as urls from './urls';
import * as errors from './errors';
import * as headers from './headers';




export function getClasses(req: Express.Request, res: Express.Response) {
    return auth0.getTenants()
        .then((tenants) => {
            return res.set(headers.CACHE_1HOUR)
                      .json(tenants);
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
