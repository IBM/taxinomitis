/* eslint no-console: 0 */
/* tslint:disable: no-console max-line-length */
import * as store from '../lib/db/store';
import * as deleter from '../lib/classdeleter';

const opsArgs = process.argv.slice(2);

if (opsArgs.length !== 2) {
    console.log('usage: node delete-student.js tenantid studentid');
    process.exit(-1); // eslint-disable-line
}

const tenantid  = opsArgs[0];
const studentid = opsArgs[1];

console.log('tenant           :', tenantid);
console.log('student          :', studentid);

console.log('');
console.log('connecting to DB...');
store.init()
    .then(() => {
        console.log('deleting student data...');
        return deleter.deleteStudents(tenantid, [ studentid ]);
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
