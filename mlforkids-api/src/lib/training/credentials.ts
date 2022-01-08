// local dependencies
import * as store from '../db/store';
import { BluemixCredentials } from './training-types';


/**
 * Removes a set of Bluemix credentials from the DB, and any
 * references to them.
 */
export async function deleteBluemixCredentials(credentials: BluemixCredentials): Promise<void>
{
    // reset scratch keys that have a copy of the credentials in them
    await store.removeCredentialsFromScratchKeys(credentials);

    // delete references to classifiers that rely on the credentials
    await store.deleteClassifiersByCredentials(credentials);

    // delete the credentials from the DB
    await store.deleteBluemixCredentials(credentials.id);
}
