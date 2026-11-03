/* eslint-disable no-console */

// external dependencies
import { Server } from 'http';
// local dependencies
import * as store from '../db/store';
import * as email from '../notifications/email';
import * as textmodels from '../training/textmodels';
import loggerSetup from './logger';

const log = loggerSetup();


// how long after the shutdown signal to wait for text model trainings
//  running on this instance to finish, before recording the rest as
//  failed - this must be safely inside the grace period that Code
//  Engine gives the app to stop
const TRAINING_SHUTDOWN_CUTOFF_MS = 240 * 1000;

// set by the first shutdown signal, so that a second signal
//  (e.g. SIGINT after SIGTERM) doesn't start another shutdown
let shutdownStarted = false;


/**
 * Cleanly shut down the application.
 */
export function now(signal: 'SIGINT' | 'SIGTERM' | 'TIMED', server?: Server): void {
    if (shutdownStarted) {
        log.info({ signal }, 'Ignoring shutdown signal, as already shutting down');
        return;
    }
    shutdownStarted = true;

    log.info({ signal }, 'Handling shutdown signal');
    const trainingCutoff = new Date(Date.now() + TRAINING_SHUTDOWN_CUTOFF_MS);
    // straight away, rather than once the server has closed, so that no
    //  training starts a retry that might not finish before the cut-off
    textmodels.startShutdown();
    gracefulServerShutdown(server)
        .then(() => {
            return textmodels.stopTrainings(trainingCutoff);
        })
        .then(() => {
            email.close();
            return store.disconnect();
        })
        .then(() => {
            process.exit(0); // eslint-disable-line
        })
        .catch((err) => {
            log.error({ err }, 'Failure in stopping DB client');
            process.exit(-1); // eslint-disable-line
        });
}

/**
 * Immediately terminate after an uncaught exception.
 */
export function crash(err: Error): void {
    log.error({ err, stack : err.stack }, 'Crash');
    process.exit(1);   // eslint-disable-line
}


/**
 * Stop accepting any new requests, wait until processing of
 *  inflight requests has completed, and then shut down the
 *  HTTP server.
 */
function gracefulServerShutdown(server?: Server): Promise<void> {
    return new Promise((resolve) => {
        if (server) {
            // tslint:disable-next-line:no-console
            console.log('Shutting down API server');

            server.close((err) => {
                if (err) {
                    // tslint:disable-next-line:no-console
                    console.log('Problem shutting down API server', err);
                }
                else {
                    // tslint:disable-next-line:no-console
                    console.log('API server stopped');
                }
                resolve();
            });
        }
        else {
            // tslint:disable-next-line:no-console
            console.log('No API server to shutdown');
            resolve();
        }
    });
}
