// external dependencies
import * as express from 'express';
// local dependencies
import * as store from './db/store';
import * as imagestore from './imagestore';
import * as iamcache from './iam';
import restapi from './restapi';
import * as notifications from './notifications/slack';
import * as scheduledtasks from './scheduledtasks';
import { confirmRequiredEnvironment } from './utils/env';
import portNumber from './utils/port';
import loggerSetup from './utils/logger';

const log = loggerSetup();

// do this before doing anything!
confirmRequiredEnvironment();

// log any uncaught errors before crashing
process.on('uncaughtException', (err) => {
    log.error({ err, stack : err.stack }, 'Crash');
    process.exit(1);   // eslint-disable-line
});

// prepare Slack API for reporting alerts
notifications.init();

// connect to S3 object storage used to store images
imagestore.init();

// initialise the cache for tokens from Bluemix IAM
iamcache.init();

// connect to MySQL DB
store.init()
    .then(() => {
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



