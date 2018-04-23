// local dependencies
import * as store from '../db/store';
import * as Objects from '../db/db-types';


/*
 * "Session Users" are temporary users, who are provided short-term access to
 *  use the site, without needing to register or provide any contact details /
 *  identification.
 *
 * A system class (named in @CLASS_NAME) is created in the tenants DB table, so
 *  limits that apply to session users can be modified at runtime by updating
 *  this class.
 *
 * Note that the current implementation only queries the tenants DB table once,
 *  so a rolling restart is needed to apply any policy modifications.
 */



export const CLASS_NAME = 'session-users';

const SESSION_LIFESPAN = 4 * 60 * 60 * 1000; // 4 hours

export const ERROR_MESSAGES = {
    CLASS_FULL : 'Class full',
};



let sessionClassPolicyChecked = false;

let MAX_ALLOWED_USERS = 0;



async function checkSessionClassPolicy(): Promise<void> {
    if (sessionClassPolicyChecked === false) {

        const policy = await store.getClassTenant(CLASS_NAME);

        MAX_ALLOWED_USERS = policy.maxUsers;

        sessionClassPolicyChecked = true;
    }
}



export async function createSessionUser(): Promise<Objects.TemporaryUser>
{
    await checkSessionClassPolicy();

    // is the session class full?
    const currentClassSize = await store.countTemporaryUsers();
    if (currentClassSize >= MAX_ALLOWED_USERS) {
        throw new Error(ERROR_MESSAGES.CLASS_FULL);
    }

    return store.storeTemporaryUser(SESSION_LIFESPAN);
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
    await store.deleteTemporaryUser(user);
}



export async function cleanupExpiredSessionUsers(): Promise<void>
{
    // first batch of users to delete
    let expiredUsers = await store.getExpiredTemporaryUsers();

    while (expiredUsers.length > 0) {
        // delete resources for each expired user
        for (const expiredUser of expiredUsers) {
            await store.deleteEntireUser(expiredUser.id, CLASS_NAME);
        }

        // delete the expired users
        await store.bulkDeleteTemporaryUsers(expiredUsers);

        // get next batch of users to delete
        expiredUsers = await store.getExpiredTemporaryUsers();
    }
}
