// local dependencies
import * as store from './db/store';
import * as objectstore from './objectstore';
import * as iamcache from './iam';
import * as credentialscheck from './training/credentialscheck';
import * as slack from './notifications/slack';
import * as email from './notifications/email';
import * as scheduledtasks from './scheduledtasks';
import { confirmRequiredEnvironment } from './utils/env';
import * as shutdown from './utils/shutdown';

// do this before doing anything!
confirmRequiredEnvironment();

// log any uncaught errors before crashing
process.on('uncaughtException', shutdown.crash);

// prepare Slack API for reporting alerts
slack.init();
// prepare SMTP pool for sending notification emails
email.init();

// connect to S3 object storage used to store images and sounds
objectstore.init();

// initialise the cache for tokens from Bluemix IAM
iamcache.init();

// initialise the cache for checking API key requirements
credentialscheck.init();

// connect to DB
store.init()
    .then(() => {
        // run batch jobs
        return scheduledtasks.run();
    })
    .then(() => {
        // close everything to allow process to terminate
        slack.close();
        email.close();

        return store.disconnect();
    });
