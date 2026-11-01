// external dependencies
import { status as httpStatus } from 'http-status';
// local dependencies
import * as textmodels from './textmodels';
import * as TrainingObjects from './training-types';
import * as request from '../utils/request';
import * as env from '../utils/env';
import * as notifications from '../notifications/slack';
import loggerSetup from '../utils/logger';

const log = loggerSetup();


// how long to wait for the service to train a model
//  the largest trainings are expected to take 40-60 seconds,
//  and this must stay below the 100 second timeout in CIS
const TRAINING_TIMEOUT_MS = 90 * 1000;


/**
 * Trains a text model using the mlforkids-text service.
 *
 * Used for both new models and retraining, as the service
 *  returns a new model (with a new model id) every time.
 */
export async function train(training: TrainingObjects.ConversationTrainingData): Promise<TrainedModel>
{
    const req: request.RequestPromiseOptions = {
        auth : getAuth(),
        json : true,
        timeout : TRAINING_TIMEOUT_MS,
        body : {
            language : training.language,
            labels : training.intents.map((intent) => {
                return {
                    label : intent.intent,
                    examples : intent.examples.map((example) => example.text),
                };
            }),
        },
    };

    const DO_NOT_RETRY = false;

    let body: TrainResponse;
    try {
        body = await request.post(getServiceUrl() + '/models', req, DO_NOT_RETRY);
    }
    catch (err) {
        throw getTrainingError(err);
    }

    return {
        modelid : body.modelid,
        head : Buffer.from(body.model, 'base64'),
    };
}



/**
 * Returns the error to throw to the user for a failed training.
 *
 * The error from the request includes the request options, which
 *  contain the credentials and training data, so a new error is
 *  created with just the message.
 */
function getTrainingError(err: any): Error {
    if (isServiceError(err, httpStatus.BAD_REQUEST, 'training-too-large') ||
        err.statusCode === httpStatus.REQUEST_ENTITY_TOO_LARGE)
    {
        // expected to be very rare, as the service limits are much
        //  larger than any training seen so far, so how often this
        //  happens shows if the limits are right
        const detail = getSafeErrorDetail(err);
        log.warn(detail, 'Training too large for text service');
        notifications.notify('Training too large for mlforkids-text : ' + JSON.stringify(detail),
                             notifications.SLACK_CHANNELS.TRAINING_ERRORS);
        return new Error(textmodels.ERROR_MESSAGES.TRAINING_TOO_LARGE);
    }
    if (isServiceError(err, httpStatus.SERVICE_UNAVAILABLE, 'busy')) {
        // expected when the service is at its limit for trainings at
        //  once, but how often this happens is useful for deciding
        //  how to scale the service, so notify the Slack bot
        log.warn(getSafeErrorDetail(err), 'Text service busy');
        notifications.notify('mlforkids-text was too busy to train a text model',
                             notifications.SLACK_CHANNELS.TRAINING_ERRORS);
        return new Error(textmodels.ERROR_MESSAGES.SERVICE_BUSY);
    }

    reportUnexpectedFailure('train text model', err);

    if (isTimeout(err)) {
        return new Error(textmodels.ERROR_MESSAGES.UNKNOWN);
    }
    if (isServiceUnavailable(err)) {
        return new Error(textmodels.ERROR_MESSAGES.SERVICE_ERROR);
    }
    return new Error(textmodels.ERROR_MESSAGES.UNKNOWN);
}



/**
 * Classifies text using a model trained by the mlforkids-text service.
 *
 * @param getHead - returns the model's head, which is only needed if
 *  the service doesn't have the model cached
 *
 * @returns every label, highest confidence first
 */
export async function classify(
    modelid: string, classifierTimestamp: Date,
    text: string,
    getHead: () => Promise<Buffer>,
): Promise<TrainingObjects.Classification[]>
{
    const url = getServiceUrl() + '/models/' + encodeURIComponent(modelid) + '/classify';

    let body: ClassifyResponse;
    try {
        // try without the head first, as the service is likely
        //  to have the model cached - this saves reading the
        //  head from the DB
        body = await submitClassify(url, { text });
    }
    catch (err) {
        if (!isServiceError(err, httpStatus.NOT_FOUND, 'model-not-cached')) {
            throw getClassifyError(err, modelid);
        }

        // the service doesn't have the model cached, so try
        //  again, this time sending the model with the request
        // (failures to get the head aren't from the service,
        //  so they're returned unchanged)
        const head = await getHead();
        try {
            body = await submitClassify(url, { text, model : head.toString('base64') });
        }
        catch (retryErr) {
            throw getClassifyError(retryErr, modelid);
        }
    }

    return body.classes.map((item: ClassifyResponseClass) => {
        return {
            class_name : item.label,
            confidence : Math.round(item.confidence * 100),
            classifierTimestamp,
        };
    });
}



/**
 * Returns the error to throw to the user for a failed classify.
 *
 * The error from the request includes the request options, which
 *  contain the credentials, text and head, so a new error is
 *  created with just the message.
 */
function getClassifyError(err: any, modelid: string): Error {
    if (isServiceError(err, httpStatus.CONFLICT, 'needs-retraining')) {
        // expected after a planned change to the encoder, so the
        //  student needs to train a new model
        log.warn({ ...getSafeErrorDetail(err), modelid }, 'Text model needs retraining');
        return new Error(textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND);
    }

    reportUnexpectedFailure('classify text', err, modelid);

    if (isServiceError(err, httpStatus.BAD_REQUEST, 'text-too-long') ||
        err.statusCode === httpStatus.REQUEST_ENTITY_TOO_LARGE)
    {
        return new Error(textmodels.ERROR_MESSAGES.TEXT_TOO_LONG);
    }
    if (isServiceError(err, httpStatus.BAD_REQUEST, 'invalid-model') ||
        isServiceError(err, httpStatus.NOT_FOUND, 'model-not-cached'))
    {
        return new Error(textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND);
    }
    if (isServiceUnavailable(err)) {
        return new Error(textmodels.ERROR_MESSAGES.SERVICE_ERROR);
    }
    return new Error(textmodels.ERROR_MESSAGES.UNKNOWN);
}



function submitClassify(url: string, body: { text: string, model?: string }): Promise<ClassifyResponse> {
    const req: request.RequestPromiseOptions = {
        auth : getAuth(),
        json : true,
        body,
    };

    const RETRY_ON_TIMEOUT = true;

    return request.post(url, req, RETRY_ON_TIMEOUT);
}


/**
 * Checks if an exception is an error response from the service,
 *  with the provided HTTP status code and error code.
 */
function isServiceError(err: any, statusCode: number, errorCode: string): boolean {
    return err &&
           err.statusCode === statusCode &&
           err.error && err.error.error === errorCode;
}



/**
 * Checks if an exception was caused by the request timing out.
 *
 * request.isTimeoutErrorCode isn't used, as it also counts
 *  connection resets (which request.ts also uses for network
 *  failures without a code) as timeouts.
 */
function isTimeout(err: any): boolean {
    if (err.statusCode) {
        return false;
    }
    const code = getErrorCode(err);
    return code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT';
}

/**
 * Checks if an exception means that the service couldn't be used,
 *  rather than that it rejected the request.
 *
 * Bad credentials are included because it means that the service
 *  is misconfigured, not that there is a problem with the request.
 */
function isServiceUnavailable(err: any): boolean {
    if (err.statusCode) {
        return err.statusCode === httpStatus.UNAUTHORIZED ||
               err.statusCode >= httpStatus.INTERNAL_SERVER_ERROR;
    }
    // no response from the service
    return true;
}


function getErrorCode(err: any): string | undefined {
    if (err.code) {
        return err.code;
    }
    if (err.cause && err.cause.code) {
        return err.cause.code;
    }
    return undefined;
}


/**
 * Returns details about an exception that are safe to log.
 *
 * Exceptions from requests include the request options, which
 *  contain the credentials and the text, training data or head
 *  that was sent, so they must never be logged.
 *
 * Error responses from the service never include student text.
 */
function getSafeErrorDetail(err: any): SafeErrorDetail {
    const detail: SafeErrorDetail = {};
    if (err.statusCode) {
        detail.statusCode = err.statusCode;
        if (err.error && typeof err.error.error === 'string') {
            detail.error = err.error.error;
        }
    }
    else {
        detail.code = getErrorCode(err);
    }
    return detail;
}


function reportUnexpectedFailure(action: string, err: any, modelid?: string): void {
    const detail = getSafeErrorDetail(err);
    log.error({ ...detail, modelid }, 'Failed to ' + action);

    notifications.notify('Unexpected failure to ' + action + ' using mlforkids-text : ' +
                         JSON.stringify(detail) +
                         (modelid ? ' for model : ' + modelid : ''),
                         notifications.SLACK_CHANNELS.TRAINING_ERRORS);
}



function getServiceUrl(): string {
    return process.env[env.TEXT_SERVICE] as string;
}

function getAuth(): { user: string | undefined, pass: string | undefined } {
    return {
        user : process.env[env.TEXT_SERVICE_USER],
        pass : process.env[env.TEXT_SERVICE_PASS],
    };
}



export interface TrainedModel {
    readonly modelid: string;
    readonly head: Buffer;
}

/**
 * The only details about a failed request that are safe to log.
 */
interface SafeErrorDetail {
    // HTTP status code of the error response from the service
    statusCode?: number;
    // error code from the service's error response
    error?: string;
    // network error code, if there was no response
    code?: string;
}

interface TrainResponse {
    readonly modelid: string;
    readonly model: string;
    readonly labels: string[];
    readonly calibration: string;
}
interface ClassifyResponse {
    readonly modelid: string;
    readonly classes: ClassifyResponseClass[];
}
interface ClassifyResponseClass {
    readonly label: string;
    readonly confidence: number;
}
