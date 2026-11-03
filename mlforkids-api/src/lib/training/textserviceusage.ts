// external dependencies
import * as Express from 'express';
// local dependencies
import * as store from '../db/store';
import * as DbObjects from '../db/db-types';
import * as cloudflare from '../cloudflare/country';
import * as env from '../utils/env';
import loggerSetup from '../utils/logger';

const log = loggerSetup();


//
// Records how the text service (mlforkids-text) is used.
//
// Only sizes, counts, outcomes and timings are recorded - never the
//  text or label names that students use.
//


export function getWebsiteClient(req: Express.Request): DbObjects.TextServiceUsageClient {
    return {
        source : 'website',
        country : cloudflare.getCountry(req),
    };
}

export function getScratchKeyClient(req: Express.Request): DbObjects.TextServiceUsageClient {
    return {
        source : 'scratchkey',
        country : cloudflare.getCountry(req),
    };
}


/**
 * Stores a usage event in the background.
 *
 * Failing to record usage should never affect the request that
 *  is being recorded, so this doesn't wait for the event to be
 *  stored, and errors are logged rather than thrown.
 */
export function record(event: DbObjects.TextServiceUsageEvent): void {
    const region = process.env[env.CE_REGION];
    const withRegion = region ? { ...event, region } : event;
    store.storeTextServiceUsageEvent(withRegion)
        .catch((err) => {
            log.warn({ err, event : event.event }, 'Failed to record text service usage');
        });
}
