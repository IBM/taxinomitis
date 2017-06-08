// external dependencies
import * as express from 'express';
// local dependencies
import * as store from './db/store';
import restApiSetup from './restapi/api';
import loggerSetup from './utils/logger';

const log = loggerSetup();


// create server
const app = express();
const host: string = process.env.HOST || '0.0.0.0';
const port: number = process.env.PORT || 8000;

// UI setup
const uilocation: string = __dirname + '/../../public';
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
