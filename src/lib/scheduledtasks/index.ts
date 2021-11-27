// core dependencies
import { Server } from 'http';
// local dependencies
import * as cf from '../utils/cf';
import * as conversation from '../training/conversation';
import * as sessionusers from '../sessionusers';
import * as pendingjobs from '../pendingjobs/runner';
import * as constants from '../utils/constants';
import * as deployment from '../utils/deployment';
import * as shutdown from '../utils/shutdown';
import loggerSetup from '../utils/logger';

const log = loggerSetup();




export function run(server?: Server): void {

    // start scheduled cleanup tasks
    if (cf.isPrimaryInstance()) {


        log.info('Scheduling automatic expiry of session users');
        // delete any session users with a session expiry
        //   that has passed
        setInterval(() => {
            sessionusers.cleanupExpiredSessionUsers();
        }, constants.FIFTY_MINUTES);



        log.info('Scheduling clean-up task to run every hour');
        // delete any classifiers which have expired, to free up
        //  the available credentials for other students
        setInterval(async () => {
            await conversation.cleanupExpiredClassifiers();
        }, constants.ONE_HOUR);



        if (deployment.isProdDeployment()) {
            log.info('Scheduling image store cleanup to run every three hours');
            // delete any images from the S3 object storage, where
            //  they are no longer required for ML projects
            setInterval(() => {
                pendingjobs.run();
            }, constants.THREE_HOURS);
        }



        // run these immediately so we don't have to wait for them to
        //  be done (these tasks are more critical than the others)
        sessionusers.cleanupExpiredSessionUsers()
            .then(() => {
                if (deployment.isProdDeployment()) {
                    pendingjobs.run();
                }
            });
    }
    else {
        log.info('Secondary app instance. Not scheduling any tasks');
    }

    // restart every hour
    if (server && process.env.CF_INSTANCE_INDEX === '2') {
        setTimeout(() => {
            shutdown.now('TIMED', server);
        }, constants.ONE_HOUR);
    }
}
