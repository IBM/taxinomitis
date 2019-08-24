// external dependencies
import * as bodyParser from 'body-parser';
import * as Express from 'express';
import * as helmet from 'helmet';
import * as query from 'connect-query';
// local dependencies
import registerBluemixApis from './bluemix';
import registerUserApis from './users';
import registerProjectApis from './projects';
import registerTrainingApis from './training';
import registerImageApis from './images';
import registerSoundApis from './sounds';
import registerModelApis from './models';
import registerScratchApis from './scratch';
import registerAppInventorApis from './appinventor';
import registerWatsonApis from './watsonapis';
import registerClassifierApis from './classifiers';
import registerSessionUserApis from './sessionusers';
import registerSiteAlertApis from './sitealerts';
import * as URLS from './urls';
import * as serverConfig from './config';
import * as errors from './errors';
import loggerSetup from '../utils/logger';


const log = loggerSetup();


/**
 * Sets up all of the REST API endpoints.
 */
export default function setup(app: Express.Application): void {
    log.info('Setting up REST API');

    // force HTTPS when running on Bluemix
    serverConfig.setupForBluemix(app);

    // third-party middleware
    app.use(query());
    app.use(helmet());

    // UI setup
    serverConfig.setupUI(app);

    // body types
    app.use(URLS.SCRATCHKEY_CLASSIFY, bodyParser.json({ limit : '3mb' }));
    app.use(URLS.SOUNDS, bodyParser.json({ limit : '400kb' }));
    app.use(URLS.TRAININGITEMS, bodyParser.json({ limit : '400kb' }));
    app.use(URLS.ROOT, bodyParser.json({ limit : '100kb' }));

    // API route handlers
    registerBluemixApis(app);
    registerUserApis(app);
    registerProjectApis(app);
    registerTrainingApis(app);
    registerImageApis(app);
    registerSoundApis(app);
    registerModelApis(app);
    registerScratchApis(app);
    registerAppInventorApis(app);
    registerWatsonApis(app);
    registerClassifierApis(app);
    registerSessionUserApis(app);
    registerSiteAlertApis(app);

    // error handling
    errors.registerErrorHandling(app);
    errors.register404Handler(app);
}

