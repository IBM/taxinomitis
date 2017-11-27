// local dependencies
import * as store from '../db/store';
import * as visrec from './visualrecognition';
import * as conv from './conversation';
import * as notifications from '../notifications/slack';
import loggerSetup from '../utils/logger';
import { ClassifierSummary, BluemixServiceType, BluemixCredentials } from './training-types';

const log = loggerSetup();




export async function checkBluemixCredentials() {

    log.info('Checking Bluemix credentials');
    notifications.notify('Checking Bluemix credentials');

    const textCredentials = await store.getAllBluemixCredentials('conv');
    for (const credentials of textCredentials) {
        try {
            const classifiers = await conv.getTextClassifiers(credentials);
            log.info({ classifiers }, 'Classifiers');
            await verifyClassifiers(classifiers, 'conv', credentials);
        }
        catch (err) {
            log.error({ err, credentials }, 'Failed to verify credentials');
            notifications.notify('Test for Conversation credentials ' + credentials.id + ' ' +
                                 'being used by ' + credentials.classid + ' ' +
                                 'failed with error : ' + err.message);
        }
    }

    const imageCredentials = await store.getAllBluemixCredentials('visrec');
    for (const credentials of imageCredentials) {
        try {
            const classifiers = await visrec.getImageClassifiers(credentials);
            log.info({ classifiers }, 'Classifiers');
            await verifyClassifiers(classifiers, 'visrec', credentials);
        }
        catch (err) {
            log.error({ err, credentials }, 'Failed to verify credentials');
            notifications.notify('Test for Visual Recognition credentials ' + credentials.id + ' ' +
                                 'being used by ' + credentials.classid + ' ' +
                                 'failed with error : ' + err.message + ' ' + err.description);
        }
    }
}


const IGNORE: string[] = [
    'Car Dashboard - Sample',
];


async function verifyClassifiers(
    classifiers: ClassifierSummary[],
    expected: BluemixServiceType,
    creds: BluemixCredentials,
): Promise<void>
{
    for (const classifier of classifiers) {
        try {
            const classifierInfo = await store.getClassifierByBluemixId(classifier.id);
            if (!classifierInfo && IGNORE.indexOf(classifier.name) === -1) {
                log.error({ classifier, creds, expected }, 'Unmanaged Bluemix classifier detected');
                notifications.notify('Unmanaged Bluemix classifier detected! ' +
                                     ' name:' + classifier.name +
                                     ' type:' + expected +
                                     ' id:' + classifier.id +
                                     ' creds: ' + creds.id +
                                     ' class: ' + creds.classid);
            }
        }
        catch (err) {
            log.error({ err, classifier }, 'Failed to get classifier info from DB');
            notifications.notify('Failed to verify ' + expected + ' classifier ' + classifier.id);
        }
    }
}
