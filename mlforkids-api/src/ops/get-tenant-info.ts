/* eslint no-console: 0 */
/* tslint:disable: no-console quotemark */
import * as store from '../lib/db/store';
import * as auth0 from '../lib/auth0/users';

const opsArgs = process.argv.slice(2);

if (opsArgs.length !== 1) {
    console.log('usage: node get-tenant-info.js teacher@email.com');
    process.exit(-1); // eslint-disable-line
}

const email = opsArgs[0];

let tenant;

store.init()
    .then(() => {
        return auth0.getTeacherByEmail(email);
    })
    .then((supervisor: any) => {
        if (!supervisor) {
            throw new Error('Teacher not found');
        }
        tenant = supervisor.app_metadata.tenant;
        console.log('');
        console.log('tenant              :', tenant);
        console.log('teacher username    :', supervisor.username);
        console.log('teacher email       :', supervisor.email);
        console.log('email verified      :', supervisor.email_verified);
        console.log('tenant created      :', supervisor.created_at);
        console.log('logins count        :', supervisor.logins_count ? supervisor.logins_count : 'NEVER');
        console.log('last login          :', supervisor.last_login ? supervisor.last_login : 'NEVER');
        console.log('last password change:', supervisor.last_password_reset ? supervisor.last_password_reset : 'never');

        return store.getClassTenant(tenant);
    })
    .then((classinfo) => {
        console.log('tenant type         :', getTenantType(classinfo.tenantType));
        console.log('users limit         :', classinfo.maxUsers);
        console.log('projects per user   :', classinfo.maxProjectsPerUser);
        console.log('supported projects  :', classinfo.supportedProjectTypes);
        console.log('text models expiry  :', classinfo.textClassifierExpiry);

        if (classinfo.tenantType === 0) {
            console.log("\nIBM Cloud credentials");
            return getCloudCreds(classinfo);
        }
    })
    .then((ibmcloudcreds) => {
        if (ibmcloudcreds) {
            console.log(ibmcloudcreds);
        }
    })
    .catch((err) => {
        console.error(err);
    })
    .finally(() => {
        return store.disconnect();
    });

function getTenantType(val: number) {
    switch (val) {
    case 0:
        return 'unmanaged';
    case 1:
        return 'managed';
    case 2:
        return 'pool';
    default:
        return 'unknown';
    }
}

async function getCloudCreds(tenantinfo: any) {
    let assistant: any[] = [];
    try {
        assistant = await store.getBluemixCredentials(tenantinfo, 'conv');
    }
    catch (err) { /* */ }
    return { assistant };
}
