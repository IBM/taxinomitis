import * as store from '../db/store';
import * as email from '../notifications/email';


/**
 * Cleanly shut down the application.
 */
export function now(): void {
    email.close();
    store.disconnect()
        .then(() => {
            process.exit(0);
        })
        .catch((err) => {
            process.exit(-1);
        });
}
