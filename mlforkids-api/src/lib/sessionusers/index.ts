// local dependencies
import * as store from '../db/store';
import * as Objects from '../db/db-types';
import loggerSetup from '../utils/logger';

const log = loggerSetup();


/*
 * "Session Users" are temporary users, who are provided short-term access to
 *  use the site, without needing to register or provide any contact details /
 *  identification.
 *
 * A system class (named in @CLASS_NAME) is created in the tenants DB table, so
 *  limits that apply to session users can be modified at runtime by updating
 *  this class.
 */



export const CLASS_NAME = 'session-users';

// once the class is full, how long we should wait before checking again
const CHECK_WINDOW = 10 * 1000; // 10 seconds

const SESSION_LIFESPAN = 4 * 60 * 60 * 1000; // 4 hours

/** The number of users that can be created in this class. After this, the class is considered full.  */
const MAX_ALLOWED_USERS = 3200;

export const ERROR_MESSAGES = {
    CLASS_FULL : 'Class full',
};

// timestamps that the session users class was last checked and found to be full
let lastFullTimestampOther = 0;
let lastFullTimestampSA = 0;



export async function createSessionUser(requestOrigin?: string): Promise<Objects.TemporaryUser>
{
    const lastFullTimestamp = requestOrigin === 'SA' ? lastFullTimestampSA : lastFullTimestampOther;
    if (lastFullTimestamp + CHECK_WINDOW > Date.now()) {
        // assume that we are probably still full, to save the
        //  unnecessary hit on the database
        throw new Error(ERROR_MESSAGES.CLASS_FULL);
    }

    // is the session class full?
    const currentClassSize = await store.countTemporaryUsers();
    const limit = requestOrigin === 'SA' ? 2000 : MAX_ALLOWED_USERS;
    if (currentClassSize >= limit) {
        // record the current time so that we don't
        //  need to check again too soon
        if (requestOrigin === 'SA') {
            lastFullTimestampSA = Date.now();
        }
        else {
            lastFullTimestampOther = Date.now();
        }

        // report that the class is full
        throw new Error(ERROR_MESSAGES.CLASS_FULL);
    }

    const user = await store.storeTemporaryUser(SESSION_LIFESPAN);

    return user;
}


export async function checkSessionToken(id: string, token: string): Promise<boolean>
{
    const sessionuser = await store.getTemporaryUser(id);

    if (!sessionuser) {
        // user not known (may have expired, been explicitly deleted, or never existed)
        return false;
    }

    if (sessionuser.token !== token) {
        // invalid token
        return false;
    }

    if (sessionuser.sessionExpiry < new Date()) {
        // session expired
        return false;
    }

    // all checks passed - welcome
    return true;
}



export async function deleteSessionUser(user: Objects.TemporaryUser): Promise<void>
{
    await store.deleteEntireUser(user.id, CLASS_NAME);
    await store.storeDeleteUserObjectsJob(CLASS_NAME, user.id);
    await store.deleteTemporaryUser(user);
}



export async function cleanupExpiredSessionUsers(): Promise<void>
{
    // first batch of users to delete
    let expiredUsers = await store.getExpiredTemporaryUsers();

    while (expiredUsers.length > 0) {
        log.info({ count: expiredUsers.length }, 'expired session users to delete');

        // delete resources for each expired user
        for (const expiredUser of expiredUsers) {
            await store.deleteEntireUser(expiredUser.id, CLASS_NAME);
            await store.storeDeleteUserObjectsJob(expiredUser.id, CLASS_NAME);
        }

        // delete the expired users
        await store.bulkDeleteTemporaryUsers(expiredUsers);

        // get next batch of users to delete
        expiredUsers = await store.getExpiredTemporaryUsers();
    }
}
