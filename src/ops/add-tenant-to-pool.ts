/* eslint no-console: 0 */
/* tslint:disable: no-console max-line-length */
import * as store from '../lib/db/store';
import * as dbtypes from '../lib/db/db-types';

const opsArgs = process.argv.slice(2);

if (opsArgs.length !== 2) {
    console.log('usage: node add-tenant-to-pool.js tenantid maxusers');
    process.exit(-1); // eslint-disable-line
}

const tenantid  = opsArgs[0];
const maxusers  = parseInt(opsArgs[1], 10);
const maxprojects = 2;

console.log('tenant           :', tenantid);
console.log('class students   :', maxusers);

console.log('');
console.log('connecting to DB...');
store.init()
    .then(() => {
        console.log('creating tenant record...');
        return store.storeManagedClassTenant(tenantid, maxusers, maxprojects, dbtypes.ClassTenantType.ManagedPool);
    })
    .then((newtenant) => {
        console.log('created:', newtenant);
    })
    .catch((err) => {
        console.error(err);
    })
    .finally(() => {
        return store.disconnect();
    });
