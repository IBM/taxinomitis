/* eslint-disable no-console */

// external dependencies
import { Server } from 'http';
// local dependencies
import * as store from '../db/store';
import * as email from '../notifications/email';
import loggerSetup from './logger';

const log = loggerSetup();



/**
 * Cleanly shut down the application.
 */
export function now(signal: 'SIGINT' | 'SIGTERM' | 'TIMED', server?: Server): void {
    log.info({ signal }, 'Handling shutdown signal');
    gracefulServerShutdown(server)
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
