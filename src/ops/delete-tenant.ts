/* eslint no-console: 0 */
/* tslint:disable: no-console max-line-length */
import * as store from '../lib/db/store';
import * as deleter from '../lib/classdeleter';

const opsArgs = process.argv.slice(2);

if (opsArgs.length !== 1) {
    console.log('usage: node delete-tenant.js tenantid');
    process.exit(-1); // eslint-disable-line
}

const tenantid  = opsArgs[0];

console.log('tenant           :', tenantid);

console.log('');
console.log('connecting to DB...');
store.init()
    .then(() => {
        console.log('deleting tenant record...');
        return deleter.deleteClass(tenantid);
    })
    .then(() => {
        console.log('deleted');
    })
    .catch((err) => {
        console.error(err);
    })
    .finally(() => {
        return store.disconnect();
    });
