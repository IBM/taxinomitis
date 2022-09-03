// external dependencies
import * as Express from 'express';


function ping(req: Express.Request, res: Express.Response) {
    res.json({});
}


/**
 * Sets up APIs required to run in Bluemix.
 */
export default function registerApis(app: Express.Application) {
    app.get('/api', ping);
}
