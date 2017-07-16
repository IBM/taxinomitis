// external dependencies
import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import * as Express from 'express';
import * as helmet from 'helmet';
import * as query from 'connect-query';
// local dependencies
import registerBluemixApis from './bluemix';
import registerUserApis from './users';
import registerProjectApis from './projects';
import registerTrainingApis from './training';
import registerModelApis from './models';
import registerScratchApis from './scratch';
import * as errors from './errors';
import loggerSetup from '../utils/logger';


const log = loggerSetup();


/**
 * Sets up all of the REST API endpoints.
 */
export default function setup(app: Express.Application): void {
    log.info('Setting up REST API');

    app.use(query());
    app.use(helmet());
    app.use(cors());
    app.use(bodyParser.json());

    registerBluemixApis(app);
    registerUserApis(app);
    registerProjectApis(app);
    registerTrainingApis(app);
    registerModelApis(app);
    registerScratchApis(app);

    errors.registerErrorHandling(app);
}

