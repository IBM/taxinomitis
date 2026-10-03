// external dependencies
import * as Express from 'express';
// local dependencies
import * as store from '../db/store';
import * as DbObjects from '../db/db-types';
import * as TrainingObjects from './training-types';
import loggerSetup from '../utils/logger';

const log = loggerSetup();


//
// Records how text models are trained and used, to collect
//  requirements for how text models could be hosted in future.
//
// Only sizes, counts and timings are recorded - never the text
//  that students use to train or test their models.
//



// requests from the main ML for Kids website
export const WEBSITE: DbObjects.WaUsageClient = { source : 'website' };

// actions not recorded with the request that triggered them, such as deleting models
export const SERVER: DbObjects.WaUsageClient = { source : 'server' };


/**
 * Identifies the client making a Scratch key API request.
 *
 * The Scratch extensions identify themselves with an X-User-Agent header.
 *  Other clients (e.g. Python, App Inventor) can only be identified by
 *  their User-Agent header.
 */
export function getScratchKeyClient(req: Express.Request): DbObjects.WaUsageClient {
    return {
        source : 'scratchkey',
        useragent : req.header('User-Agent'),
        xuseragent : req.header('X-User-Agent'),
        origin : req.header('Origin'),
    };
}


/**
 * Summarises the size of a set of training data.
 */
export function describeTraining(training: TrainingObjects.ConversationTrainingData): { labels: number, examples: number, chars: number } {
    let examples = 0;
    let chars = 0;
    for (const intent of training.intents) {
        examples += intent.examples.length;
        for (const example of intent.examples) {
            chars += example.text.length;
        }
    }
    return { labels : training.intents.length, examples, chars };
}


/**
 * Stores a usage event in the background.
 *
 * Failing to record usage should never affect the request that
 *  is being recorded, so this doesn't wait for the event to be
 *  stored, and errors are logged rather than thrown.
 */
export function record(event: DbObjects.WaUsageEvent): void {
    store.storeWaUsageEvent(event)
        .catch((err) => {
            log.warn({ err, event : event.event }, 'Failed to record text model usage');
        });
}
