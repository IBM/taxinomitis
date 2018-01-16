// local dependencies
import * as store from '../db/store';
import * as visrec from './visualrecognition';
import * as conv from './conversation';
import * as Types from './training-types';
import * as notifications from '../notifications/slack';
import loggerSetup from '../utils/logger';
import { ClassifierSummary, BluemixServiceType, BluemixCredentials } from './training-types';

const log = loggerSetup();



interface ExpectedErrors {
    unmanagedConvClassifiers: string[];
    unmanagedVisrecClassifiers: string[];
    badBluemixConvCredentials: string[];
    badBluemixVisrecCredentials: string[];
}




async function getKnownErrors(): Promise<ExpectedErrors> {
    const errs = await store.getAllKnownErrors();
    const indexedErrs: ExpectedErrors = {
        unmanagedConvClassifiers: [],
        unmanagedVisrecClassifiers: [],
        badBluemixConvCredentials: [],
        badBluemixVisrecCredentials: [],
    };
    for (const err of errs) {
        switch (err.type) {
        case Types.KnownErrorCondition.UnmanagedBluemixClassifier:
            if (err.servicetype === 'conv') {
                indexedErrs.unmanagedConvClassifiers.push(err.objid);
            }
            else if (err.servicetype === 'visrec') {
                indexedErrs.unmanagedVisrecClassifiers.push(err.objid);
            }
            else {
                log.error({ err }, 'Unrecognised known error');
                notifications.notify('Unrecognised known error service type ' + err.servicetype);
            }
            break;
        case Types.KnownErrorCondition.BadBluemixCredentials:
            if (err.servicetype === 'conv') {
                indexedErrs.badBluemixConvCredentials.push(err.objid);
            }
            else if (err.servicetype === 'visrec') {
                indexedErrs.badBluemixVisrecCredentials.push(err.objid);
            }
            else {
                log.error({ err }, 'Unrecognised known error');
                notifications.notify('Unrecognised known error service type ' + err.servicetype);
            }
            break;
        default:
            log.error({ err }, 'Unrecognised known error');
            notifications.notify('Unrecognised known error type ' + err.type);
        }
    }
    return indexedErrs;
}




export async function checkBluemixCredentials() {

    log.info('Checking Bluemix credentials');
    notifications.notify('Checking Bluemix credentials');

    const knownErrors = await getKnownErrors();

    const textCredentials = await store.getAllBluemixCredentials('conv');
    for (const credentials of textCredentials) {
        try {
            const classifiers = await conv.getTextClassifiers(credentials);
            log.info({ classifiers }, 'Classifiers');
            await verifyClassifiers(classifiers, 'conv', credentials, knownErrors);
        }
        catch (err) {
            if (checkIfErrorExpected(knownErrors, 'badBluemixCredentials', 'conv', credentials.id) === false) {
                log.error({ err, credentials }, 'Failed to verify credentials');
                notifications.notify('Test for Conversation credentials ' + credentials.id + ' ' +
                                    'being used by ' + credentials.classid + ' ' +
                                    'failed with error : ' + err.message);
            }
        }
    }

    const imageCredentials = await store.getAllBluemixCredentials('visrec');
    for (const credentials of imageCredentials) {
        try {
            const classifiers = await visrec.getImageClassifiers(credentials);
            log.info({ classifiers }, 'Classifiers');
            await verifyClassifiers(classifiers, 'visrec', credentials, knownErrors);
        }
        catch (err) {
            if (checkIfErrorExpected(knownErrors, 'badBluemixCredentials', 'visrec', credentials.id) === false) {
                log.error({ err, credentials }, 'Failed to verify credentials');
                notifications.notify('Test for Visual Recognition credentials ' + credentials.id + ' ' +
                                    'being used by ' + credentials.classid + ' ' +
                                    'failed with error : ' + err.message + ' ' + err.description);
            }
        }
    }


    reportMissingErrors(knownErrors);

    notifications.notify('Check complete');
}



function reportMissingErrors(expectedErrors: ExpectedErrors): void {
    if (expectedErrors.badBluemixConvCredentials.length > 0) {
        notifications.notify('Failed to find expected bad conv credentials : ' +
                             expectedErrors.badBluemixConvCredentials.join(', '));
    }
    if (expectedErrors.badBluemixVisrecCredentials.length > 0) {
        notifications.notify('Failed to find expected bad visrec credentials : ' +
                             expectedErrors.badBluemixVisrecCredentials.join(', '));
    }
    if (expectedErrors.unmanagedConvClassifiers.length > 0) {
        notifications.notify('Failed to find expected conv classifiers : ' +
                             expectedErrors.unmanagedConvClassifiers.join(', '));
    }
    if (expectedErrors.unmanagedVisrecClassifiers.length > 0) {
        notifications.notify('Failed to find expected visrec classifiers : ' +
                             expectedErrors.unmanagedVisrecClassifiers.join(', '));
    }
}



const IGNORE: string[] = [
    'Car Dashboard - Sample',
];



function checkIfErrorExpected(
    expectedErrors: ExpectedErrors,
    errortype: 'unmanagedClassifiers' | 'badBluemixCredentials',
    servicetype: BluemixServiceType,
    id: string,
): boolean
{
    if (errortype === 'badBluemixCredentials') {
        if (servicetype === 'conv') {
            if (expectedErrors.badBluemixConvCredentials.includes(id)) {
                expectedErrors.badBluemixConvCredentials =
                    expectedErrors.badBluemixConvCredentials.filter((expectedid) => {
                        return id !== expectedid;
                    });
                return true;
            }
            return false;
        }

        if (servicetype === 'visrec') {
            if (expectedErrors.badBluemixVisrecCredentials.includes(id)) {
                expectedErrors.badBluemixVisrecCredentials =
                    expectedErrors.badBluemixVisrecCredentials.filter((expectedid) => {
                        return id !== expectedid;
                    });
                return true;
            }
            return false;
        }
    }

    if (errortype === 'unmanagedClassifiers') {
        if (servicetype === 'conv') {
            if (expectedErrors.unmanagedConvClassifiers.includes(id)) {
                expectedErrors.unmanagedConvClassifiers =
                    expectedErrors.unmanagedConvClassifiers.filter((expectedid) => {
                        return id !== expectedid;
                    });
                return true;
            }
            return false;
        }

        if (servicetype === 'visrec') {
            if (expectedErrors.unmanagedVisrecClassifiers.includes(id)) {
                expectedErrors.unmanagedVisrecClassifiers =
                    expectedErrors.unmanagedVisrecClassifiers.filter((expectedid) => {
                        return id !== expectedid;
                    });
                return true;
            }
            return false;
        }
    }

    return false;
}



async function verifyClassifiers(
    classifiers: ClassifierSummary[],
    expected: BluemixServiceType,
    creds: BluemixCredentials,
    expectedErrors: ExpectedErrors,
): Promise<void>
{
    for (const classifier of classifiers) {
        try {
            const classifierInfo = await store.getClassifierByBluemixId(classifier.id);
            if (!classifierInfo &&
                IGNORE.indexOf(classifier.name) === -1 &&
                checkIfErrorExpected(expectedErrors, 'unmanagedClassifiers', expected, classifier.id) === false)
            {
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
