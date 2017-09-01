import * as express from 'express';
import restapiSetup from '../../lib/restapi/api';
import * as serverSetup from '../../lib/restapi/server';

export default function setup() {
    const app = express();
    serverSetup.setupForBluemix(app);
    serverSetup.setupUI(app);
    restapiSetup(app);
    return app;
}
