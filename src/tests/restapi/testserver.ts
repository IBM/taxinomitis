import * as express from 'express';
import restapi from '../../lib/restapi';

export default function setup(): express.Express {
    const app: express.Express = express();
    restapi(app);
    return app;
}
