// external dependencies
import * as Express from 'express';
import { status as httpstatus } from 'http-status';
// local dependencies
import * as urls from './urls';


function ping(req: Express.Request, res: Express.Response) {
    res.status(httpstatus.OK).json({});
}


/**
 * Sets up APIs required to run in Bluemix.
 */
export default function registerApis(app: Express.Application) {
    app.get(urls.K8S_PROBE, ping);
}
