// external dependencies
import * as express from 'express';
// local dependencies
import * as store from './db/store';
import * as cf from './utils/cf';
import * as conversation from './training/conversation';
import * as visualrec from './training/visualrecognition';
import restapi from './restapi';
import * as constants from './utils/constants';
import * as credentials from './training/credentials';
import * as notifications from './notifications/slack';
import { confirmRequiredEnvironment } from './utils/env';
import portNumber from './utils/port';
import loggerSetup from './utils/logger';

const log = loggerSetup();

// do this before doing anything!
confirmRequiredEnvironment();

// create server
const app = express();
const host: string = process.env.HOST || '0.0.0.0';
const port: number = portNumber(process.env.PORT, 8000);

// setup server and run
store.init();
restapi(app);
app.listen(port, host, () => {
    log.info({ host, port }, 'Running');
});


// log any uncaught errors before crashing
process.on('uncaughtException', (err) => {
    log.error({ err, stack : err.stack }, 'Crash');
    process.exit(1);   // eslint-disable-line
});


// prepare Slack API
notifications.init();


// start scheduled cleanup tasks
if (cf.isPrimaryInstance()) {
    log.info('Scheduling clean-up task to run every hour');

    // delete any classifiers which have expired, to free up
    //  the available credentials for other students
    setInterval(() => {
        conversation.cleanupExpiredClassifiers()
            .then(() => {
                visualrec.cleanupExpiredClassifiers();
            });
    }, constants.ONE_HOUR);

    // check that the Bluemix credentials stored in
    //   the tool are still valid
    setInterval(() => {
        credentials.checkBluemixCredentials();
    }, constants.ONE_DAY_PLUS_A_BIT);
}
