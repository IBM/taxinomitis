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
    'c1238de5-99fb-4654-9a1c-1cdd10ac7438',
    '23be807a-2601-45d2-a40f-5eb7ab6fb9cf',
    '6df99ba2-b46d-4b55-99e3-09055499120e',
    '9562a3c7-395a-415e-a3d0-90333c737673',
    '28f339fa-4818-4930-9406-e62be1342a87',
    '369871fe-4b3e-4a20-baca-4ca835ee7b4f',
    'ee30cabc-eefc-49c6-a7fe-c696fc7d8dc2',
    '06de7a53-5160-4aa2-9eed-ad7d460cd8a3',
    '7109ac5e-9ad4-44fa-947d-8c05e39458ac',
    '8b479081-101e-4e08-87a5-072fc6c3b71c',
    '5246a2cf-b598-402d-9d98-09b62b7ef060',
    '074222dc-5073-4965-9853-838470cbe613',
    'a2bbef3e-0098-4cb7-871e-d9b04baabf03',
    'a840d746-bd28-434d-a76a-69b011fafefc',
    'eecca1d2-783c-4f5d-95a5-a84c1e6dfbe9',
    'b476f3b9-3a80-4f08-beda-10071915c3f5',
    '958aeaea-a8e0-474f-82b6-5fc0c8883df4',
    '77e749fb-2ad9-464c-b004-f0325f214afa',
    'a6833549-5dd4-4679-b6ba-d4cd8367e31a',
    '2ae5addb-4225-4f8e-8637-3c26f85f768e',
    'd52e17f2-0ce8-4c11-804b-7bce1cf1c3e4',
    '3c5d76d9-d13e-453f-950d-38b24e76808a',
    'd3bbddcf-bb75-4e26-bcc1-31534b224f2e',
    'd860259d-ecce-4c62-bd79-9bbd8ff79e78',
    '5b034876-62c1-47a3-bfc8-27bfdf8ba037',
    '8e0977e5-984e-45d9-9689-6f6193085add',
    'b2847fbf-ca05-44c9-b123-d72627e31dda',
    '422e9727-ea2e-444d-9643-3f43961b9e8f',
    '19cd2132-b021-432f-8542-8760e256930d',
    '141c3983-56a8-42a2-a4b0-b9d3c5b78bc0',
    '07f85f37-2451-4cbf-81b5-4358fe27fcb6',
    '12efff7e-ab03-41f0-bb8a-c0aedc3357cb',
    'ab05513f-8023-45f2-b344-2e92a496d233',
    '9579b0ef-9513-4813-9345-7e4328a37e78',
    'f19a8ec5-befa-4744-8d27-6dfad1546097',
];
