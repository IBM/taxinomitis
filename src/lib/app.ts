// external dependencies
import * as express from 'express';
import * as httpstatus from 'http-status';
// local dependencies
import * as store from './db/store';
import * as cf from './utils/cf';
import * as conversation from './training/conversation';
import setupAPI from './restapi/api';
import * as server from './restapi/server';
import * as constants from './utils/constants';
import loggerSetup from './utils/logger';

const log = loggerSetup();

// create server
const app = express();
const host: string = process.env.HOST || '0.0.0.0';
const port: number = parseInt(process.env.PORT, 10) || 8000;

// force HTTPS when running on Bluemix
server.setupForBluemix(app);

// UI setup
server.setupUI(app);

// setup server and run
store.init();
setupAPI(app);
app.listen(port, host, () => {
    log.info({ host, port }, 'Running');
});


// log any uncaught errors before crashing
process.on('uncaughtException', (err) => {
    log.error({ err, stack : err.stack }, 'Crash');
    process.exit(1);
});


// start scheduled cleanup tasks
if (cf.isPrimaryInstance()) {
    log.info('Scheduling clean-up task to run every hour');

    // delete any text classifiers which have expired, to free up
    //  the available workspaces for other students
    setInterval(conversation.cleanupExpiredClassifiers, constants.ONE_HOUR);
}
