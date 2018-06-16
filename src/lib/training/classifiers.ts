// local dependencies
import * as store from '../db/store';
import * as visrec from './visualrecognition';
import * as conv from './conversation';
import { ClassifierSummary, BluemixServiceType, BluemixCredentials } from './training-types';




export async function getUnknownTextClassifiers(classid: string): Promise<ClassifierSummary[]>
{
    const unknownTextClassifiers: ClassifierSummary[] = [];

    // get all of the Bluemix credentials in the class
    const credentialsPool = await store.getBluemixCredentials(classid, 'conv');
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



export async function getUnknownImageClassifiers(classid: string): Promise<ClassifierSummary[]>
{
    const unknownImageClassifiers: ClassifierSummary[] = [];

    // get all of the Bluemix credentials in the class
    const credentialsPool = await store.getBluemixCredentials(classid, 'visrec');
    // for each API key...
    for (const credentials of credentialsPool) {
        // get all of the classifiers according to Bluemix / Watson
        const bluemixClassifiers = await visrec.getImageClassifiers(credentials);

        // for each Bluemix classifier...
        for (const bluemixClassifier of bluemixClassifiers) {
            // check if it is in the DB
            const classifierInfo = await store.getClassifierByBluemixId(bluemixClassifier.id);
            if (!classifierInfo) {
                unknownImageClassifiers.push(bluemixClassifier);
            }
        }
    }

    return unknownImageClassifiers;
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
    else if (type === 'visrec') {
        return visrec.deleteClassifierFromBluemix(credentials, classifierid);
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
];

/**
 * IDs of tenants run by users who make regular usage of Bluemix API keys
 *  and do not need to be notified of usage outside of ML for Kids.
 */
export const IGNORE_TENANTS: string[] = [
    '1f1e7205-0c8f-4c53-bb33-ba630ef688f7',
    'fc688e7a-c358-4c8a-889a-e643b2f10938',
    'ravenscroftj',
    '7df31d96-0cfb-46b9-9108-1789facce449',
    'b78f710b-0374-430c-ba4a-2d73d81aa59f',
    '5f6f8ce6-47c0-4831-9335-deb59714fa12',
    '3380908e-737d-4280-9b45-0447dd76636b',
    '86c2c1a9-ba2c-43f7-9fa9-f15793f862a3',
    'f34f5d6e-c593-48b4-9535-8e4fcbfc793a',
    'b20fe2de-1d1f-4aa8-b32f-584090052eb1',
    '5c8e2aec-8d37-4c7f-acbf-1b95ffa72f2f',
    'cc71db35-92df-4e04-ab4e-09f1f3b63468',
    'c7553f55-8d03-4a54-bf38-4800c3d2a929',
    '0f1d4fd9-bbbe-4d7e-aa2a-57009f2db60b',
    '8db23317-b946-4e23-94f5-2e3f553dfc8a',
    '593598db-1fda-430d-8dbe-a02cbdc8459b',
    'db91ffb0-3c59-4cba-b149-9fc2fd929d56',
    '31176a49-8ef8-4f8a-9e6c-5212e2320ed6',
];
