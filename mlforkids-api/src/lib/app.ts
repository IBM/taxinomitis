// startup logging for debugging
console.log('[STARTUP] Application starting...');
console.log('[STARTUP] Node version:', process.version);
console.log('[STARTUP] Environment:', process.env.NODE_ENV || 'development');

// external dependencies
import * as express from 'express';
import { Server } from 'http';
// local dependencies
import * as store from './db/store';
import * as objectstore from './objectstore';
import * as iamcache from './iam';
import * as sitealerts from './sitealerts';
import restapi from './restapi';
import * as credentialscheck from './training/credentialscheck';
import * as slack from './notifications/slack';
import * as email from './notifications/email';
import { confirmRequiredEnvironment } from './utils/env';
import * as shutdown from './utils/shutdown';
import * as env from './utils/env';
import loggerSetup from './utils/logger';

const log = loggerSetup();
let server: Server | undefined;

// log any uncaught errors before crashing
process.on('uncaughtException', (err: Error) => {
    console.error('[STARTUP] Uncaught exception:');
    console.error('[STARTUP]', err.message);
    console.error(err.stack);
    shutdown.crash(err);
});

// terminate quickly if we get a SIGTERM signal
process.on('SIGTERM', () => { shutdown.now('SIGTERM', server); server = undefined; });
process.on('SIGINT', () => { shutdown.now('SIGINT', server); server = undefined; });

console.log('[STARTUP] Confirming required environment variables...');
// do this before doing anything!
try {
    confirmRequiredEnvironment();
    console.log('[STARTUP] Environment variables confirmed successfully');
} catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[STARTUP] FATAL: Failed to confirm required environment variables');
    console.error('[STARTUP] ERROR:', errorMsg);
    if (log && typeof log.error === 'function') {
        log.error(err, 'Failed to confirm required environment variables');
    }
    process.exit(1);
}

// check if the site is running in read-only mode
if (env.inMaintenanceMode()) {
    log.error('Site is running in maintenance mode');
}

console.log('[STARTUP] Initializing services...');
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

console.log('[STARTUP] Connecting to database...');
// connect to DB
store.init()
    .then(() => {
        console.log('[STARTUP] Database connected successfully');
        console.log('[STARTUP] Refreshing site alerts cache...');
        // check for current site alerts
        return sitealerts.refreshCache();
    })
    .then(() => {
        console.log('[STARTUP] Creating Express server...');
        // create server
        const app = express();
        const host: string = process.env.HOST || '0.0.0.0';
        const port: number = env.getPortNumber();

        console.log('[STARTUP] Setting up REST API...');
        // setup server and run
        restapi(app);
        
        console.log('[STARTUP] Starting server on', host, ':', port);
        server = app.listen(port, host, () => {
            console.log('[STARTUP] Server is now listening');
            log.info({ host, port }, 'Running');
        });
    })
    .catch((err) => {
        console.error('[STARTUP] FATAL: Error during initialization');
        console.error('[STARTUP] Error type:', err instanceof Error ? err.constructor.name : typeof err);
        console.error('[STARTUP] Error message:', err instanceof Error ? err.message : String(err));
        if (err instanceof Error && err.stack) {
            console.error('[STARTUP] Stack trace:');
            console.error(err.stack);
        }
        log.error({ err }, 'Failed to initialize application');
        process.exit(1);
    });
