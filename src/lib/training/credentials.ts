// local dependencies
import * as store from '../db/store';
import * as visrec from './visualrecognition';
import * as conv from './conversation';
import * as notifications from '../notifications/slack';
import loggerSetup from '../utils/logger';

const log = loggerSetup();




export async function checkBluemixCredentials() {

    log.info('Checking Bluemix credentials');
    notifications.notify('Checking Bluemix credentials');

    const textCredentials = await store.getAllBluemixCredentials('conv');
    for (const credentials of textCredentials) {
        try {
            const classifiers = await conv.getTextClassifiers(credentials);
            log.info({ classifiers }, 'Classifiers');
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
        }
        catch (err) {
            log.error({ err, credentials }, 'Failed to verify credentials');
            notifications.notify('Test for Visual Recognition credentials ' + credentials.id + ' ' +
                                 'being used by ' + credentials.classid + ' ' +
                                 'failed with error : ' + err.message);
        }
    }
}

