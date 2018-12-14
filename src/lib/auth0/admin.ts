// local dependencies
import * as auth0requests from './requests';
import * as Objects from './auth-types';
import * as db from '../db/store';
import * as DbTypes from '../db/db-types';



async function getBearerToken(): Promise<string> {
    const body = await auth0requests.getOauthToken();
    return body.access_token;
}



async function getTenantSettings(): Promise<{ [id: string]: DbTypes.ClassTenant }>
{
    const tenants = await db.getClassTenants();

    const indexed: { [id: string]: DbTypes.ClassTenant } = {};
    for (const tenant of tenants) {
        indexed[tenant.id] = tenant;
    }
    return indexed;
}

async function getAllSupervisors(token: string): Promise<Objects.User[]>
{
    const BATCHSIZE = 100;
    let batch = 0;

    let response = await auth0requests.getSupervisors(token, batch++, BATCHSIZE);

    const target = response.total;

    let supervisors = response.users;

    while (supervisors.length < target) {
        response = await auth0requests.getSupervisors(token, batch++, BATCHSIZE);
        supervisors = supervisors.concat(response.users);
    }

    return supervisors;
}


export async function getTenants(): Promise<Objects.TenantInfo[]> {
    const token = await getBearerToken();

    const supervisors = await getAllSupervisors(token);
    const settings = await getTenantSettings();
    const creds = await db.countGlobalBluemixCredentials();

    const tenants = supervisors.map((supervisor) => {

        const tenantId = supervisor.app_metadata.tenant;

        const tenantSettings = settings[tenantId];
        const tenantCreds = creds[tenantId];

        let isManaged = false;
        if (tenantSettings) {
            isManaged = tenantSettings.isManaged;
        }

        let credentials = { conv : 0, visrec : 0, total : 0 };
        if (tenantCreds) {
            credentials = tenantCreds;
        }


        const supervisorInfo: Objects.SupervisorInfo = {
            user_id: supervisor.user_id,
            email: supervisor.email,
            username: supervisor.username,
            created: new Date(supervisor.created_at),
            last_login: supervisor.last_login ? new Date(supervisor.last_login) : undefined,
            logins_count: supervisor.logins_count ? supervisor.logins_count : 0,
        };

        const tenant: Objects.TenantInfo = {
            id: tenantId,
            supervisors: [ supervisorInfo ],
            is_managed: isManaged,
            credentials,
        };

        return tenant;
    });

    // this is okay as long as the demo class doesn't have more than 100 students in
    const demousers = await auth0requests.getUsers(token, 'demo', 0);

    return tenants.concat(demousers.map((demouser) => {
        return {
            id : 'demo',
            supervisors: [
                {
                    user_id : demouser.user_id,
                    email : demouser.email,
                    username : demouser.username,
                    created : new Date(demouser.created_at),
                    last_login : demouser.last_login ? new Date(demouser.last_login) : undefined,
                    logins_count : demouser.logins_count ? demouser.logins_count : 0,
                },
            ],
            is_managed : true,
            credentials : creds.demo,
        };
    }));

}
