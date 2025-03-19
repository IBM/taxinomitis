// external dependencies
import * as Express from 'express';
// local dependencies
import * as urls from './urls';


function ping(req: Express.Request, res: Express.Response) {
    res.json({});
}


/**
 * Sets up APIs required to run in Bluemix.
 */
export default function registerApis(app: Express.Application) {
    app.get(urls.K8S_PROBE, ping);
}
