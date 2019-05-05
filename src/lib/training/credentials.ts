// local dependencies
import * as store from '../db/store';
import * as visrec from './visualrecognition';
import * as conv from './conversation';
import * as bluemixclassifiers from './classifiers';
import * as slack from '../notifications/slack';
import * as emails from '../notifications/email';
import loggerSetup from '../utils/logger';
import { ClassifierSummary, BluemixServiceType, BluemixCredentials, KnownErrorCondition } from './training-types';

const log = loggerSetup();



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




interface ExpectedErrors {
    unmanagedConvClassifiers: string[];
    unmanagedVisrecClassifiers: string[];
    badBluemixConvCredentials: string[];
    badBluemixVisrecCredentials: string[];
}




/**
 * Gets the flat list of known errors from the DB, and group
 *  them by type.
 */
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
        case KnownErrorCondition.UnmanagedBluemixClassifier:
            if (err.servicetype === 'conv') {
                indexedErrs.unmanagedConvClassifiers.push(err.objid);
            }
            else if (err.servicetype === 'visrec') {
                indexedErrs.unmanagedVisrecClassifiers.push(err.objid);
            }
            else {
                log.error({ err }, 'Unrecognised known error');
                slack.notify('Unrecognised known error service type ' + err.servicetype,
                             slack.SLACK_CHANNELS.CREDENTIALS);
            }
            break;
        case KnownErrorCondition.BadBluemixCredentials:
            if (err.servicetype === 'conv') {
                indexedErrs.badBluemixConvCredentials.push(err.objid);
            }
            else if (err.servicetype === 'visrec') {
                indexedErrs.badBluemixVisrecCredentials.push(err.objid);
            }
            else {
                log.error({ err }, 'Unrecognised known error');
                slack.notify('Unrecognised known error service type ' + err.servicetype,
                             slack.SLACK_CHANNELS.CREDENTIALS);
            }
            break;
        default:
            log.error({ err }, 'Unrecognised known error');
            slack.notify('Unrecognised known error type ' + err.type,
                         slack.SLACK_CHANNELS.CREDENTIALS);
        }
    }
    return indexedErrs;
}




export async function checkBluemixCredentials() {

    log.info('Checking Bluemix credentials');
    slack.notify('Checking Bluemix credentials',
                 slack.SLACK_CHANNELS.CREDENTIALS);

    // get the list of errors that the teacher have already been
    //  emailed a notification about, and so should be ignored
    const knownErrors = await getKnownErrors();


    //
    // checking Watson Conversation credentials...
    //
    const textCredentials = await store.getAllBluemixCredentials('conv');
    for (const credentials of textCredentials) {

        let classifiers: ClassifierSummary[] = [];

        // get all of the classifiers owned by these credentials
        try {
            classifiers = await conv.getTextClassifiers(credentials);
        }
        catch (err) {
            // these credentials didn't work.
            if (isErrorExpected(knownErrors, 'badBluemixCredentials', 'conv', credentials.id) === false) {
                await reportBadCredentials(err, credentials);
            }
        }

        // check each of the classifiers owned by these credentials
        const optOut = await store.hasTenantOptedOutOfNotifications(credentials.classid);
        if (optOut === false) {
            for (const classifier of classifiers) {
                const known = await isClassifierKnown(classifier, credentials, 'conv', knownErrors);
                if (known === false) {
                    await handleUnknownClassifier(credentials, classifier);
                }
            }
        }
    }


    //
    // checking Visual Recognition credentials...
    //
    const imageCredentials = await store.getAllBluemixCredentials('visrec');
    for (const credentials of imageCredentials) {

        let classifiers: ClassifierSummary[] = [];

        // get all of the classifiers owned by these credentials
        try {
            classifiers = await visrec.getImageClassifiers(credentials);
        }
        catch (err) {
            // these credentials didn't work.
            if (isErrorExpected(knownErrors, 'badBluemixCredentials', 'visrec', credentials.id) === false) {
                await reportBadCredentials(err, credentials);
            }
        }

        // check each of the classifiers owned by these credentials
        const optOut = await store.hasTenantOptedOutOfNotifications(credentials.classid);
        if (optOut === false) {
            for (const classifier of classifiers) {
                const known = await isClassifierKnown(classifier, credentials, 'visrec', knownErrors);
                if (known === false) {
                    await handleUnknownClassifier(credentials, classifier);
                }
            }
        }
    }


    reportMissingErrors(knownErrors);

    slack.notify('Check complete', slack.SLACK_CHANNELS.CREDENTIALS);
}




function reportMissingErrors(expectedErrors: ExpectedErrors): void {
    if (expectedErrors.badBluemixConvCredentials.length > 0) {
        slack.notify('Failed to find expected bad conv credentials : ' +
                     expectedErrors.badBluemixConvCredentials.join(', '),
                     slack.SLACK_CHANNELS.CREDENTIALS);
    }
    if (expectedErrors.badBluemixVisrecCredentials.length > 0) {
        slack.notify('Failed to find expected bad visrec credentials : ' +
                     expectedErrors.badBluemixVisrecCredentials.join(', '),
                     slack.SLACK_CHANNELS.CREDENTIALS);
    }
    if (expectedErrors.unmanagedConvClassifiers.length > 0) {
        slack.notify('Failed to find expected conv classifiers : ' +
                     expectedErrors.unmanagedConvClassifiers.join(', '),
                     slack.SLACK_CHANNELS.CREDENTIALS);
    }
    if (expectedErrors.unmanagedVisrecClassifiers.length > 0) {
        slack.notify('Failed to find expected visrec classifiers : ' +
                     expectedErrors.unmanagedVisrecClassifiers.join(', '),
                     slack.SLACK_CHANNELS.CREDENTIALS);
    }
}



async function reportBadCredentials(err: Error, credentials: BluemixCredentials): Promise<void> {
    log.warn({ err, credentials }, 'Failed to verify credentials');

    //
    // Notify site admin
    //

    let servicename: 'Watson Assistant' | 'Visual Recognition';
    if (credentials.servicetype === 'conv') {
        servicename = 'Watson Assistant';
    }
    else {
        servicename = 'Visual Recognition';
    }

    slack.notify('Test for ' + servicename +
                 ' credentials ' + credentials.id +
                 ' being used by ' + credentials.classid +
                 ' failed with error : ' + err.message,
                 slack.SLACK_CHANNELS.CREDENTIALS);


    //
    // special cases - ignore some errors
    //
    //  We don't want to notify teachers about these.

    if (err.message &&
        typeof err.message === 'string' &&
        (
        //  Visual Recognition will occassionally return the
        //   string 'unspecified error - please try again\n' with an HTTP 500 response code
        //   even when the credentials are fine
        err.message.startsWith('unspecified error - please try again') ||
        //  Occassionally there is a timeout when we try to poll
        //   the service API. This is usually a temporary thing.
        err.message === 'Error: ESOCKETTIMEDOUT' || err.message === 'ESOCKETTIMEDOUT' ||
        err.message === 'Error: ETIMEDOUT' || err.message === 'ETIMEDOUT'
        ))
    {
        return;
    }
    const errorPayload: any = err;
    if (errorPayload.code === 502 && errorPayload.statusCode === 502 &&
        errorPayload.error === 'Bad Gateway')
    {
        // this is indicative of a Watson infrastructure error
        //  and not bad credentials
        return;
    }
    if (errorPayload.code === 500 && errorPayload.statusCode === 500 &&
        errorPayload.error === 'Internal Server Error')
    {
        // this is indicative of a Watson infrastructure error
        //  and not bad credentials
        return;
    }
    if (!err.message || err.message !== 'string' || err.message.trim().length === 0)
    {
        // we don't have a useful error message to return so err on the
        // safe side and don't report
        return;
    }


    //
    // Notify the teacher responsible for the class
    //

    // store the report, so that we don't report this multiple times
    await store.storeNewKnownError(KnownErrorCondition.BadBluemixCredentials,
                                   credentials.servicetype,
                                   credentials.id);
    // send an email
    await emails.invalidCredentials(credentials.classid, {
        errormessage : err.message,
        servicename,
        userid : credentials.servicetype === 'conv' ?
                    credentials.username :
                    credentials.username + credentials.password,
    });
}


async function reportUnmanagedClassifier(
    classifier: ClassifierSummary,
    creds: BluemixCredentials,
): Promise<void>
{
    log.warn({ classifier, creds }, 'Unmanaged Bluemix classifier detected');

    //
    // Notify site admin
    //

    slack.notify('Unmanaged Bluemix classifier detected! ' +
                 ' name:' + classifier.name +
                 ' type:' + classifier.type +
                 ' id:' + classifier.id +
                 ' creds: ' + creds.id +
                 ' class: ' + creds.classid,
                 slack.SLACK_CHANNELS.CREDENTIALS);


    //
    // Notify the teacher responsible for the class
    //

    // store the report, so we don't report this multiple times
    await store.storeNewKnownError(KnownErrorCondition.UnmanagedBluemixClassifier,
                                   creds.servicetype,
                                   classifier.id);
    // send an email
    if (creds.servicetype === 'conv') {
        await emails.unknownConvClassifier(creds.classid, {
            workspace : classifier.id,
        });
    }
    else if (creds.servicetype === 'visrec') {
        await emails.unknownVisrecClassifier(creds.classid, {
            classifier : classifier.id,
        });
    }

}





/**
 * Checks if the specified error is in the provided list of known/acknowledged errors.
 *
 *  If true, the error will be removed from the provided list, allowing what's left
 *  in the list at the end of this to be used as a list of expected-but-not-encountered errors.
 *
 * @returns true if the error was expected / known / acknowledged
 */
function isErrorExpected(
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






/**
 * Checks a classifier that was found in Bluemix, to see if information
 *  about it is stored in the DB.
 *
 * @returns true if the classifier is known
 */
async function isClassifierKnown(
    classifier: ClassifierSummary,
    creds: BluemixCredentials,
    expected: BluemixServiceType,
    expectedErrors: ExpectedErrors,
): Promise<boolean>
{
    try {
        const classifierInfo = await store.getClassifierByBluemixId(classifier.id);

            // if the classifier wasn't found in the DB...
        if (!classifierInfo &&
            // ... and it isn't a classifier that everyone gets as a sample out of the box ...
            bluemixclassifiers.IGNORE.indexOf(classifier.name) === -1 &&
            // ... and we haven't already notified the teacher about this...
            isErrorExpected(expectedErrors, 'unmanagedClassifiers', expected, classifier.id) === false)
        {
            // then classifier is not known!
            return false;
        }

        return true;
    }
    catch (err) {
        log.error({ err, classifier, creds, credid: creds.id }, 'Failed to get classifier info from DB');
        slack.notify('Failed to verify ' + expected + ' classifier ' + classifier.id,
                     slack.SLACK_CHANNELS.CREDENTIALS);

        // Okay... so the classifier isn't known, so we're about to lie here.
        //  but it's not really lying, it's more optimistic. We haven't been
        //  able to successfully confirm that the classifier isn't in the DB,
        //  so let's assume that it's probably there.
        // (With a prod on Slack so it can be investigated properly).
        return true;
    }
}


/**
 * We found an unknown classifier in IBM Cloud.
 * This function handles that.
 * Handling that means two things:
 *
 * 1) If this is a managed class, we own the Bluemix credentials, so there is
 *     no appropriate way that this could have happened. We just delete the
 *     classifier (and notify siteadmin through Slack as it suggests something
 *     went wrong somewhere)
 * 2) If this is an unmanaged class, we notify the class teacher, as they
 *     might have done this on purpose.
 */
async function handleUnknownClassifier(credentials: BluemixCredentials, classifier: ClassifierSummary): Promise<void> {
    const classPolicy = await store.getClassTenant(credentials.classid);

    if (classPolicy.isManaged) {
        // no good reason for this - delete it

        slack.notify('DELETING UNKNOWN ' + classifier.type + ' classifier ' +
                     ' id : ' + classifier.id +
                     ' name : ' + classifier.name +
                     ' from class ' + credentials.classid,
                     slack.SLACK_CHANNELS.CREDENTIALS);
        await bluemixclassifiers.deleteClassifier(classifier.type, credentials, classifier.id);
    }
    else {
        // possibly a good reason for this - report it

        await reportUnmanagedClassifier(classifier, credentials);
    }
}



