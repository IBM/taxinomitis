const store = require('../dist/lib/db/store');
const email = require('../dist/lib/notifications/email');
const iam = require('../dist/lib/iam');
const creds = require('../dist/lib/training/credentials');


iam.init();
store.init()
    .then(() => {
        return email.init();
    })
    .then(() => {
        return creds.checkBluemixCredentials();
    })
    .then(() => {
        console.log('check complete.');
        email.close();
        return store.disconnect();
    });

