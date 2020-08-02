// external dependencies
import * as express from 'express';
// local dependencies
import * as store from './db/store';
import * as objectstore from './objectstore';
import * as iamcache from './iam';
import * as sitealerts from './sitealerts';
import restapi from './restapi';
import * as credentialscheck from './training/credentialscheck';
import * as slack from './notifications/slack';
import * as email from './notifications/email';
import * as scheduledtasks from './scheduledtasks';
import { confirmRequiredEnvironment } from './utils/env';
import * as shutdown from './utils/shutdown';
import * as env from './utils/env';
import portNumber from './utils/port';
import loggerSetup from './utils/logger';

const log = loggerSetup();

// do this before doing anything!
confirmRequiredEnvironment();

// log any uncaught errors before crashing
process.on('uncaughtException', shutdown.crash);

// terminate quickly if Cloud Foundry sends a SIGTERM signal
process.on('SIGTERM', shutdown.now);
process.on('SIGINT', shutdown.now);

// check if the site is running in read-only mode
if (env.inMaintenanceMode()) {
    log.error('Site is running in maintenance mode');
}

// prepare Slack API for reporting alerts
slack.init();
// prepare SMTP pool for sending notification emails
email.init();

// connect to S3 object storage used to store images and sounds
objectstore.init();

// initialise the cache for tokens from Bluemix IAM
iamcache.init();

// initialise the cache for checking API key requirements
credentialscheck.init();

// connect to DB
store.init()
    .then(() => {
        // check for current site alerts
        sitealerts.refreshCache();

        // create server
        const app = express();
        const host: string = process.env.HOST || '0.0.0.0';
        const port: number = portNumber(process.env.PORT, 8000);

        // setup server and run
        restapi(app);
        app.listen(port, host, () => {
            log.info({ host, port }, 'Running');
        });

        // start scheduled cleanup tasks
        scheduledtasks.run();
    });



