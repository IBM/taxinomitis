import * as store from '../lib/db/store';
import * as objectstore from '../lib/objectstore';
import * as iamcache from '../lib/iam';
import * as credentialscheck from '../lib/training/credentialscheck';
import * as classdeleter from '../lib/classdeleter';


// connect to S3 object storage used to store images and sounds
objectstore.init();

// initialise the cache for tokens from Bluemix IAM
iamcache.init();


// initialise the cache for checking API key requirements
credentialscheck.init();

// connect to DB
store.init()
    .then(() => {
        return classdeleter.deleteClass('');
    });
