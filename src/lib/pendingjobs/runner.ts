// local dependencies
import * as db from '../db/store';
import * as processor from './processor';
import * as notifications from '../notifications/slack';
import * as constants from '../utils/constants';
import loggerSetup from '../utils/logger';
import * as Types from '../db/db-types';

const log = loggerSetup();




export async function run(): Promise<void> {
    let nextJob: Types.PendingJob | undefined;
    try {
        const start = new Date();

        nextJob = await db.getNextPendingJob();

        while (nextJob) {
            await processor.processJob(nextJob);
            await db.deletePendingJob(nextJob);

            nextJob = await db.getNextPendingJob();
        }

        const end = new Date();

        const durationMs = end.getTime() - start.getTime();

        log.info({ durationMs }, 'No pending jobs remain');

        if (durationMs > constants.THREE_HOURS) {
            notifications.notify('Processing pending jobs took longer than THREE HOURS',
                                 notifications.SLACK_CHANNELS.CRITICAL_ERRORS);
        }
    }
    catch (err) {
        log.error({ err, nextJob }, 'Pending job failure');
        notifications.notify('Critical failure in processing pending jobs: ' + err.message,
                             notifications.SLACK_CHANNELS.CRITICAL_ERRORS);

        if (nextJob) {
            db.recordUnsuccessfulPendingJobExecution(nextJob);
        }
    }
}


