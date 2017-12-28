import * as express from 'express';
import restapi from '../../lib/restapi';
import * as serverConfig from '../../lib/restapi/config';

export default function setup(): express.Express {
    const app: express.Express = express();
    restapi(app);
    return app;
}
