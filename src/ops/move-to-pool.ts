/* eslint no-console: 0 */
/* tslint:disable: no-console max-line-length */
import * as store from '../lib/db/store';
import * as trainingtypes from '../lib/training/training-types';

const opsArgs = process.argv.slice(2);

if (opsArgs.length !== 1) {
    console.log('usage: node move-to-pool.js tenantid');
    process.exit(-1); // eslint-disable-line
}

const tenantid  = opsArgs[0];
console.log('tenant           :', tenantid);

let tenantObj;

console.log('');
console.log('connecting to DB...');
store.init()
    .then(() => {
        return store.getClassTenant(tenantid);
    })
    .then((tenant) => {
        tenantObj = tenant;
        console.log(tenantObj);
        return store.getDetailedBluemixCredentialsForClass(tenantObj.id);
    })
    .then(async (creds) => {
        console.log('Managed credentials:');
        console.log(creds);

        for (const cred of creds) {
            const convpool: trainingtypes.BluemixCredentialsPoolDbRow = {
                id: cred.id,
                classid: cred.classid,
                lastfail: new Date(),
                username: cred.username,
                password: cred.password,
                servicetype: cred.servicetype,
                url: cred.url,
                credstypeid: cred.credstypeid,
                notes: cred.notes,
            };
            console.log('-------------------------------------');
            console.log('Moving...');
            console.log(convpool);
            await store.storeBluemixCredentialsPool(convpool);
            await store.deleteBluemixCredentials(cred.id);
            console.log('');

            await sleep();
        }

        return store.moveToPool(tenantid);
    })
    .then(() => {
        console.log('-------------------------------------');
        console.log('move complete.');
        console.log('-------------------------------------');
    })
    .catch((err) => {
        console.error(err);
    })
    .finally(() => {
        return store.disconnect();
    });

function sleep() {
    return new Promise((resolve) => {
        setTimeout(resolve, 1500);
    });
}
