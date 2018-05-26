const store = require('../dist/lib/db/store');
const iam = require('../dist/lib/iam');
const creds = require('../dist/lib/training/credentials');


iam.init();
store.init()
    .then(() => {
        return creds.checkBluemixCredentials();
    })
    .then(() => {
        console.log('check complete.');
        return store.disconnect();
    });

/*

Unmanaged Bluemix classifier detected (expected=conv)

INSERT INTO knownsyserrors
    (id, type, servicetype, objid)
    VALUES('001', 1, 'conv', classifier.id);



Failed to verify credentials (conversation)

INSERT INTO knownsyserrors
    (id, type, servicetype, objid)
    VALUES('012', 2, 'conv', credentials.id);

 */
