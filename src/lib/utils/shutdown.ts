import * as store from '../db/store';
import * as email from '../notifications/email';
import loggerSetup from './logger';

const log = loggerSetup();



/**
 * Cleanly shut down the application.
 */
export function now(): void {
    email.close();
    store.disconnect()
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
