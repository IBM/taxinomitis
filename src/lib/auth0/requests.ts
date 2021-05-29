// external dependencies
import * as request from 'request-promise';
// local dependencies
import * as Objects from './auth-types';
import * as authvalues from './values';

// NO LOGIC IN HERE!
//  PUTTING ONLY XHR REQUESTS IN ONE PLACE MAKES IT EASIER TO STUB OUT AUTH0 FOR TEST PURPOSES
//  ANYTHING THAT LOOKS LIKE APP LOGIC SHOULDN'T GO IN HERE AS IT WON'T BE TESTED AS MUCH


export function getOauthToken(): Promise<Objects.Auth0TokenPayload> {
    const options = {
        method: 'POST',
        url: 'https://' + authvalues.DOMAIN + '/oauth/token',
        headers: { 'content-type': 'application/json' },
        json : true,
        body: {
            client_id : authvalues.API_CLIENTID,
            client_secret : authvalues.API_CLIENTSECRET,
            audience : 'https://' + authvalues.DOMAIN + '/api/v2/',
            grant_type : 'client_credentials',
        },
    };

    const resp = request.post(options) as unknown;
    return resp as Promise<Objects.Auth0TokenPayload>;
}

export async function getUser(token: string, userid: string): Promise<Objects.User> {
    const getoptions = {
        method: 'GET',
        url: 'https://' + authvalues.DOMAIN + '/api/v2/users/' + userid,
        headers: {
            authorization : 'Bearer ' + token,
        },
        qs : {
            fields : 'user_id,username,app_metadata',
        },
        json : true,
    };

    const user = await request.get(getoptions);
    return user;
}


function searchForSupervisor(token: string, query: string): Promise<Objects.SupervisorInfo | undefined> {
    const getoptions = {
        method: 'GET',
        url: 'https://' + authvalues.DOMAIN + '/api/v2/users',
        headers: {
            authorization : 'Bearer ' + token,
        },
        qs : {
            q : query,
            per_page : 1,

            search_engine : 'v3',
        },
        json : true,
    };

    return request.get(getoptions)
        .then((users) => {
            if (users.length > 0) {
                return users[0];
            }
        });
}

export function getSupervisorByEmail(token: string, email: string): Promise<Objects.SupervisorInfo | undefined> {
    return searchForSupervisor(token, 'email:"' + email + '"');
}

/**
 * Returns the registered teacher for the specified class.
 *  If there is more than one supervisor for a class, only the
 *  first user account returned by Auth0 will be returned.
 */
export function getSupervisor(token: string, tenant: string): Promise<Objects.SupervisorInfo | undefined> {
    return searchForSupervisor(token, 'app_metadata.role:"supervisor" AND app_metadata.tenant:"' + tenant + '"');
}


export async function getSupervisors(
    token: string,
    batch: number, batchsize: number,
): Promise<{ total: number, users: Objects.User[]}>
{
    const getoptions = {
        method: 'GET',
        url: 'https://' + authvalues.DOMAIN + '/api/v2/users',
        headers: {
            authorization : 'Bearer ' + token,
        },
        qs : {
            q : 'app_metadata.role:"supervisor"',
            include_totals : true,

            page: batch,
            per_page : batchsize,

            search_engine : 'v3',
        },
        json : true,
    };

    const response = await request.get(getoptions);
    return {
        users : response.users,
        total : response.total,
    };
}

function generateGroupQuery(studentgroup: string | undefined): string {
    switch (studentgroup) {
    // all students, regardless of group
    case Objects.ALL_STUDENTS:
        return '';
    // students not assigned to any group
    case Objects.UNGROUPED_STUDENTS:
    case '':
        return 'AND NOT app_metadata.group:*';
    // students assigned to a group
    default:
        return 'AND app_metadata.group:"' + studentgroup + '"';
    }
}



export const PAGE_SIZE = 100;

export async function getUsers(token: string, tenant: string, studentgroup: string | undefined, page: number): Promise<Objects.User[]> {
    const getoptions = {
        method: 'GET',
        url: 'https://' + authvalues.DOMAIN + '/api/v2/users',
        headers: {
            authorization : 'Bearer ' + token,
        },
        qs : {
            q : 'app_metadata.role:"student" AND app_metadata.tenant:"' + tenant + '"' + generateGroupQuery(studentgroup),
            per_page : PAGE_SIZE,
            page,

            search_engine : 'v3',
        },
        json : true,
    };

    const users = await request.get(getoptions);
    return users;
}


export async function getClassSupervisors(token: string, tenant: string): Promise<Objects.SupervisorInfo[]> {
    const getoptions = {
        method: 'GET',
        url: 'https://' + authvalues.DOMAIN + '/api/v2/users',
        headers: {
            authorization : 'Bearer ' + token,
        },
        qs : {
            q : 'app_metadata.role:"supervisor" AND app_metadata.tenant:"' + tenant + '"',
            per_page : PAGE_SIZE,

            search_engine : 'v3',
        },
        json : true,
    };

    const users = await request.get(getoptions);
    return users;
}



export async function getUserCounts(token: string, tenant: string): Promise<Objects.UsersInfo> {
    const getoptions = {
        method: 'GET',
        url: 'https://' + authvalues.DOMAIN + '/api/v2/users',
        headers: {
            authorization : 'Bearer ' + token,
        },
        qs : {
            q : 'app_metadata.tenant:"' + tenant + '"',
            fields : 'id',
            include_fields : true,
            include_totals : true,

            search_engine : 'v3',
        },
        json : true,
    };

    const usersInfo = await request.get(getoptions);
    return usersInfo;
}



export async function createUser(token: string, newuser: Objects.NewUser): Promise<Objects.User> {
    const createoptions = {
        method: 'POST',
        url: 'https://' + authvalues.DOMAIN + '/api/v2/users',
        headers: {
            authorization : 'Bearer ' + token,
        },
        body : newuser,
        json : true,
    };

    const userInfo = await request.post(createoptions);
    return userInfo;
}


export async function deleteUser(token: string, userid: string): Promise<void> {
    const deleteoptions = {
        method: 'DELETE',
        url: 'https://' + authvalues.DOMAIN + '/api/v2/users/' + userid,
        headers: {
            authorization : 'Bearer ' + token,
        },
    };

    await request.delete(deleteoptions);
}

export async function modifyUser(token: string, userid: string, modifications: Objects.Modifications)
    : Promise<Objects.User>
{
    const modifyoptions = {
        method: 'PATCH',
        url: 'https://' + authvalues.DOMAIN + '/api/v2/users/' + userid,
        headers: {
            authorization : 'Bearer ' + token,
        },
        body : modifications,
        json : true,
    };

    const userInfo = await request.patch(modifyoptions);
    return userInfo;
}

