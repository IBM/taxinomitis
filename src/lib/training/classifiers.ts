// local dependencies
import * as store from '../db/store';
import * as conv from './conversation';
import { ClassTenant } from '../db/db-types';
import { ClassifierSummary, BluemixServiceType, BluemixCredentials } from './training-types';




export async function getUnknownTextClassifiers(tenant: ClassTenant): Promise<ClassifierSummary[]>
{
    const unknownTextClassifiers: ClassifierSummary[] = [];

    let credentialsPool: BluemixCredentials[] = [];

    // get all of the Bluemix credentials in the class
    try {
        credentialsPool = await store.getBluemixCredentials(tenant, 'conv');
    }
    catch (err) {
        if (err.message === 'Unexpected response when retrieving service credentials') {
            // class doesn't have any Watson Assistant credentials - which is
            // not necessarily an error in this context
            return unknownTextClassifiers;
        }
        // anything else is a legitimate error
        throw err;
    }

    // for each API key...
    for (const credentials of credentialsPool) {
        // get all of the classifiers according to Bluemix / Watson
        const bluemixClassifiers = await conv.getTextClassifiers(credentials);

        // for each Bluemix classifier...
        for (const bluemixClassifier of bluemixClassifiers) {
            // check if it is in the DB
            //  (unless it's in the list of classifiers we know won't be in the DB)
            if (!IGNORE.includes(bluemixClassifier.name)) {
                const classifierInfo = await store.getClassifierByBluemixId(bluemixClassifier.id);
                if (!classifierInfo) {
                    unknownTextClassifiers.push(bluemixClassifier);
                }
            }
        }
    }

    return unknownTextClassifiers;
}




export function deleteClassifier(
    type: BluemixServiceType,
    credentials: BluemixCredentials,
    classifierid: string,
): Promise<void>
{
    if (type === 'conv') {
        return conv.deleteClassifierFromBluemix(credentials, classifierid);
    }
    else {
        return Promise.resolve();
    }
}



/**
 * Names of classifiers that are automatically created by Bluemix services,
 *  and so likely to be found in accounts - not indicative of problems.
 */
export const IGNORE: string[] = [
    'Car Dashboard - Sample',
    'Customer Service - Sample',
];
