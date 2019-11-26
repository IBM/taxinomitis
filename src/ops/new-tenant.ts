/* eslint no-console: 0 */
/* tslint:disable: no-console max-line-length */
import * as util from 'util';
import * as child_process from 'child_process';
import * as store from '../lib/db/store';
import * as dbobjects from '../lib/db/objects';
import * as trainingtypes from '../lib/training/training-types';
import * as auth0 from '../lib/auth0/users';

const exec = util.promisify(child_process.exec);


const opsArgs = process.argv.slice(2);

if (opsArgs.length !== 6) {
    console.log('usage: node new-tenant.js tenantid teacherusername teacheremail maxusers numconv numvisrec');
    process.exit(-1); // eslint-disable-line
}

const tenantid  = opsArgs[0];
const username  = opsArgs[1];
const emailadd  = opsArgs[2];
const maxusers  = parseInt(opsArgs[3], 10);
const numconv   = parseInt(opsArgs[4], 10);
const numvisrec = parseInt(opsArgs[5], 10);


console.log('tenant           :', tenantid);
console.log('teacher username :', username);
console.log('teacher email    :', emailadd);
console.log('class students   :', maxusers);


function createAssistantCredentials(tenant: string): Promise<trainingtypes.BluemixCredentials> {
    console.log('creating Watson Assistant credentials...');
    return exec('./ops/conv-creds.sh')
        .then((response) => {
            if (response.stderr) {
                console.error(response.stderr);
                throw new Error('Failed to create credentials');
            }
            const output = response.stdout.split('\n');
            if (output.length !== 3) {
                console.log(response.stdout);
                throw new Error('Unexpected response when creating credentials');
            }
            const apikey = output[0];
            const notes  = output[1];

            const credentials = dbobjects.createBluemixCredentials(
                'conv',
                tenant,
                apikey,
                undefined, undefined,
                'conv_standard');

            credentials.url = 'https://gateway.watsonplatform.net/assistant/api';
            credentials.notes = notes;

            return store.storeBluemixCredentials(tenant, dbobjects.getCredentialsAsDbRow(credentials));
        });
}

function createVisualRecognitionCredentials(tenant: string): Promise<trainingtypes.BluemixCredentials> {
    console.log('creating Visual Recognition credentials...');
    return exec('./ops/visrec-creds.sh')
        .then((response) => {
            if (response.stderr) {
                console.error(response.stderr);
                throw new Error('Failed to create credentials');
            }
            const output = response.stdout.split('\n');
            if (output.length !== 3) {
                console.log(response.stdout);
                throw new Error('Unexpected response when creating credentials');
            }
            const apikey = output[0];
            const notes  = output[1];

            const credentials = dbobjects.createBluemixCredentials(
                'visrec',
                tenant,
                apikey,
                undefined, undefined,
                'visrec_standard');

            credentials.url = 'https://gateway.watsonplatform.net/visual-recognition/api';
            credentials.notes = notes;

            return store.storeBluemixCredentials(tenant, dbobjects.getCredentialsAsDbRow(credentials));
        });
}

async function createMultipleAssistantCredentials(tenant: string, num: number): Promise<trainingtypes.BluemixCredentials[]>
{
    const credentials: trainingtypes.BluemixCredentials[] = [];
    for (let i = 0; i < num; i++) {
        credentials.push(await createAssistantCredentials(tenant));
    }
    console.log(credentials);
    return credentials;
}
async function createMultipleVisualRecognitionCredentials(tenant: string, num: number): Promise<trainingtypes.BluemixCredentials[]>
{
    const credentials: trainingtypes.BluemixCredentials[] = [];
    for (let i = 0; i < num; i++) {
        credentials.push(await createVisualRecognitionCredentials(tenant));
    }
    console.log(credentials);
    return credentials;
}



console.log('');
console.log('connecting to DB...');
store.init()
    .then(() => {
        return store.storeManagedClassTenant(tenantid, maxusers);
    })
    .then((newtenant) => {
        console.log('created:', newtenant);
        return auth0.createVerifiedTeacher(tenantid, username, emailadd);
    })
    .then((newteacher) => {
        console.log('created:', newteacher);
        console.log('');
        console.log('--------------------------------------------------------------------');
        console.log('Thanks very much for getting in touch. ');
        console.log(' ');
        console.log('I\'ve set up a class account you can access using: ');
        console.log('    username:  ' + username + ' ');
        console.log('    password:  ' + newteacher.password + ' ');
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

        return createMultipleAssistantCredentials(tenantid, numconv);
    })
    .then(() => {
        return createMultipleVisualRecognitionCredentials(tenantid, numvisrec);
    })
    .catch((err) => {
        console.error(err);
    })
    .finally(() => {
        return store.disconnect();
    });
