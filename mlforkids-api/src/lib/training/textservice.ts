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
//  about 1.5 times the longest expected call: a cold start
//  without the image (about 70 seconds), plus up to 60 seconds
//  waiting in the service, plus about 46 seconds training
const TRAINING_TIMEOUT_MS = 180 * 1000;

// how long to wait for the service to classify text
//  covers a cold start without the image (about 70 seconds),
//  and must stay below the 100 second timeout in CIS, as
//  classifying is synchronous for students
const CLASSIFY_TIMEOUT_MS = 80 * 1000;


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
 * A failed training, with the message to show to the user, and
 *  whether the same training could succeed if it is sent again.
 */
export class TextServiceTrainingError extends Error {
    name = 'TextServiceTrainingError';
    readonly retryable: boolean;
    // how long the service asked for before trying again (only
    //  for busy responses, and only if the service said)
    readonly retryAfterMs?: number;

    constructor(message: string, retryable: boolean, retryAfterMs?: number) {
        super(message);
        this.retryable = retryable;
        this.retryAfterMs = retryAfterMs;
        Object.setPrototypeOf(this, TextServiceTrainingError.prototype);
    }
}


/**
 * Returns the error to throw to the user for a failed training.
 *
 * The error from the request includes the request options, which
 *  contain the credentials and training data, so a new error is
 *  created with just the message.
 */
function getTrainingError(err: any): TextServiceTrainingError {
    return new TextServiceTrainingError(getTrainingErrorMessage(err),
                                        isRetryableTrainingFailure(err),
                                        getRetryAfterMs(err));
}


/**
 * Checks if a training that failed could succeed if it is sent
 *  again unchanged. Resending is safe, as the service doesn't
 *  keep any state from a training.
 */
function isRetryableTrainingFailure(err: any): boolean {
    if (err.statusCode) {
        // busy, starting, and any other errors from the service
        //  itself (rather than from the request) can be retried
        return err.statusCode >= httpStatus.INTERNAL_SERVER_ERROR;
    }
    // timeouts, dropped connections, and no response at all
    return true;
}


/**
 * How long the service asked for before trying again, from the
 *  Retry-After header (in seconds) of a busy response.
 */
function getRetryAfterMs(err: any): number | undefined {
    if (!isServiceError(err, httpStatus.SERVICE_UNAVAILABLE, 'busy')) {
        return undefined;
    }
    const header = err.response && err.response.headers ?
        err.response.headers.get('retry-after') :
        null;
    if (header && /^\d+$/.test(header.trim())) {
        return parseInt(header.trim(), 10) * 1000;
    }
    return undefined;
}


function getTrainingErrorMessage(err: any): string {
    if (isServiceError(err, httpStatus.BAD_REQUEST, 'training-too-large') ||
        err.statusCode === httpStatus.REQUEST_ENTITY_TOO_LARGE)
    {
        // expected to be very rare, as the service limits are much
        //  larger than any training seen so far, so how often this
        //  happens shows if the limits are right
        const detail = getSafeErrorDetail(err);
        log.warn(detail, 'Training too large for text service');
        notifications.notify('Training too large for mlforkids-text : ' + JSON.stringify(detail),
                             notifications.SLACK_CHANNELS.TEXT_SERVICE);
        return textmodels.ERROR_MESSAGES.TRAINING_TOO_LARGE;
    }
    if (isServiceError(err, httpStatus.SERVICE_UNAVAILABLE, 'busy')) {
        // expected when the service is at its limit for trainings at
        //  once, but how often this happens is useful for deciding
        //  how to scale the service, so notify the Slack bot
        log.warn(getSafeErrorDetail(err), 'Text service busy');
        notifications.notify('mlforkids-text was too busy to train a text model',
                             notifications.SLACK_CHANNELS.TEXT_SERVICE);
        return textmodels.ERROR_MESSAGES.SERVICE_BUSY;
    }

    reportUnexpectedFailure('train text model', err);

    if (isTimeout(err)) {
        return textmodels.ERROR_MESSAGES.UNKNOWN;
    }
    if (isServiceUnavailable(err)) {
        return textmodels.ERROR_MESSAGES.SERVICE_ERROR;
    }
    return textmodels.ERROR_MESSAGES.UNKNOWN;
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
        timeout : CLASSIFY_TIMEOUT_MS,
        body,
    };

    // a retry after the timeout would go past the timeout in CIS
    //  (request.ts also counts connection resets as timeouts, so
    //  they aren't retried either - the student can try again)
    const DO_NOT_RETRY = false;

    return request.post(url, req, DO_NOT_RETRY);
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

    // the model id is only logged, so that repeated alerts are the
    //  same, and are collapsed by the notifications module
    notifications.notify('Unexpected failure to ' + action + ' using mlforkids-text : ' +
                         JSON.stringify(detail),
                         notifications.SLACK_CHANNELS.TEXT_SERVICE);
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
