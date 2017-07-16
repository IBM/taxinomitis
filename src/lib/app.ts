// external dependencies
import * as express from 'express';
import * as httpstatus from 'http-status';
// local dependencies
import * as store from './db/store';
import * as cf from './utils/cf';
import * as conversation from './training/conversation';
import restApiSetup from './restapi/api';
import loggerSetup from './utils/logger';

const log = loggerSetup();


// create server
const app = express();
const host: string = process.env.HOST || '0.0.0.0';
const port: number = parseInt(process.env.PORT, 10) || 8000;

if (process.env.BLUEMIX_REGION) {
    // when running on Bluemix, need to look at use of HTTPS
    //  between browser and Bluemix (not between Bluemix proxy
    //  and the express app)
    app.enable('trust proxy');

    app.use((req, res, next) => {
        if (req.secure) {
            next();
        }
        else {
            res.redirect('https://' + req.headers.host + req.url);
        }
    });

    // when running on Bluemix, need to force non-www URLs as
    //  the auth-callbacks won't support use of www
    app.get('/*', (req, res, next) => {
        if (req.hostname.startsWith('www.')){
            res.redirect(httpstatus.MOVED_PERMANENTLY,
                         'https://' + req.headers.host.substr(4) + req.url);
        }
        else {
            next();
        }
    });
}

// UI setup
const uilocation: string = __dirname + '/../../web';
app.use(express.static(uilocation));

// setup server and run
store.init();
restApiSetup(app);
app.listen(port, host, () => {
    log.info({ host, port, uilocation }, 'Running');
});

// log any uncaught errors before crashing
process.on('uncaughtException', (err) => {
    log.error({ err, stack : err.stack }, 'Crash');
    process.exit(1);
});


// start scheduled cleanup tasks
const ONE_HOUR = 3600000;
if (cf.isPrimaryInstance()) {
    log.info('*** Scheduling clean-up task to run every hour');

    // delete any text classifiers which have expired, to free up
    //  the available workspaces for other students
    setInterval(conversation.cleanupExpiredClassifiers, ONE_HOUR);
}
