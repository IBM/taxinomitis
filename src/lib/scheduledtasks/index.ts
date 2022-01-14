// local dependencies
import * as conversation from '../training/conversation';
import * as sessionusers from '../sessionusers';
import * as pendingjobs from '../pendingjobs/runner';
import loggerSetup from '../utils/logger';

const log = loggerSetup();




export function run(): Promise<void> {
    log.info('deleting session users with a session expiry time that has passed');
    return sessionusers.cleanupExpiredSessionUsers()
        .then(() => {
            log.info('deleting data from S3 object storage that is no longer needed');
            return pendingjobs.run();
        })
        .then(() => {
            log.info('deleting expired Watson Assistant workspaces');
            return conversation.cleanupExpiredClassifiers();
        })
        .then(() => {
            log.info('cleanup complete');
        });
}
