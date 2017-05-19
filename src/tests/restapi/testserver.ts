import * as express from 'express';
import restapiSetup from '../../lib/restapi/api';

export default function setup() {
    const app = express();
    restapiSetup(app);
    return app;
}
