// external dependencies
import * as Express from 'express';
import { status as httpstatus } from 'http-status';
// local dependencies
import * as errors from './errors';
import * as urls from './urls';



function generateError(req: Express.Request, res: Express.Response) {
    const errorcode = parseInt(req.params.errorcode as string, 10);
    switch (errorcode) {
        case httpstatus.BAD_REQUEST:
            return errors.missingData(res);
        case httpstatus.NOT_FOUND:
            return errors.notFound(res);
        case httpstatus.UNAUTHORIZED:
            return errors.notAuthorised(res);
        case httpstatus.FORBIDDEN:
            return errors.forbidden(res);
        case httpstatus.REQUEST_ENTITY_TOO_LARGE:
            return errors.requestTooLarge(res);
        case httpstatus.NOT_IMPLEMENTED:
            return errors.notImplemented(res);
        case httpstatus.SERVICE_UNAVAILABLE:
            return errors.siteInMaintenanceMode(req, res);
        case httpstatus.INTERNAL_SERVER_ERROR:
            return errors.unknownError(res, new Error('Sample error'));
        default:
            res.json({});
    }
}


export default function registerApis(app: Express.Application) {
    app.get(urls.ERROR_TEST, generateError);
}
