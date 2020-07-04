/* eslint no-console: 0 */
/* tslint:disable: no-console max-line-length */
import * as store from '../lib/db/store';
import * as dbtypes from '../lib/db/db-types';
import * as auth0 from '../lib/auth0/users';
import * as authtypes from '../lib/auth0/auth-types';

const opsArgs = process.argv.slice(2);

if (opsArgs.length !== 4) {
    console.log('usage: node new-tenant.js tenantid teacherusername teacheremail maxusers');
    process.exit(-1); // eslint-disable-line
}

const tenantid  = opsArgs[0];
const username  = opsArgs[1];
const emailadd  = opsArgs[2];
const maxusers  = parseInt(opsArgs[3], 10);
const maxprojects = 2;

console.log('tenant           :', tenantid);
console.log('teacher username :', username);
console.log('teacher email    :', emailadd);
console.log('class students   :', maxusers);

let teacherobj: authtypes.UserCreds;

console.log('');
console.log('connecting to DB...');
store.init()
    .then(() => {
        console.log('creating teacher credentials...');
        return auth0.createVerifiedTeacher(tenantid, username, emailadd);
    })
    .then((newteacher) => {
        console.log('created:', newteacher);
        teacherobj = newteacher;

        console.log('creating tenant record...');
        return store.storeManagedClassTenant(tenantid, maxusers, maxprojects, dbtypes.ClassTenantType.ManagedPool);
    })
    .then((newtenant) => {
        console.log('created:', newtenant);
        console.log('');
        console.log('--------------------------------------------------------------------');
        console.log('Thanks very much for getting in touch. ');
        console.log(' ');
        console.log('I\'ve set up a class account you can access using: ');
        console.log('    username:  ' + username + ' ');
        console.log('    password:  ' + teacherobj.password + ' ');
        console.log(' ');
        console.log('You can download a PDF which describes how you can get started at ');
        console.log('https://github.com/IBM/taxinomitis-docs/raw/master/docs/pdf/machinelearningforkids-schools.pdf ');
        console.log(' ');
        console.log('Please let me know if there is anything I can do to help. ');
        console.log(' ');
        console.log('Kind regards ');
        console.log(' ');
        console.log('D');
        console.log('--------------------------------------------------------------------');
    })
    .catch((err) => {
        console.error(err);
    })
    .finally(() => {
        return store.disconnect();
    });
