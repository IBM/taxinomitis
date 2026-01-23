// local dependencies
import * as Objects from './auth-types';
import * as authvalues from './values';

// NO LOGIC IN HERE!
//  PUTTING ONLY XHR REQUESTS IN ONE PLACE MAKES IT EASIER TO STUB OUT AUTH0 FOR TEST PURPOSES
//  ANYTHING THAT LOOKS LIKE APP LOGIC SHOULDN'T GO IN HERE AS IT WON'T BE TESTED AS MUCH

async function handleFetchError(response: Response): Promise<never> {
    const errorBody = await response.json().catch(() => ({})) as any;
    const error: any = new Error(errorBody.message || `HTTP ${response.status}`);
    error.statusCode = response.status;
    error.response = { body: errorBody, statusCode: response.status };
    throw error;
}

export async function getOauthToken(): Promise<Objects.Auth0TokenPayload> {
    const url = 'https://' + authvalues.DOMAIN + '/oauth/token';
    const body = {
        client_id : authvalues.API_CLIENTID,
        client_secret : authvalues.API_CLIENTSECRET,
        audience : 'https://' + authvalues.DOMAIN + '/api/v2/',
        grant_type : 'client_credentials',
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        await handleFetchError(response);
    }

    return await response.json() as Objects.Auth0TokenPayload;
}

export async function getUser(token: string, userid: string): Promise<Objects.User> {
    const url = new URL('https://' + authvalues.DOMAIN + '/api/v2/users/' + userid);
    url.searchParams.append('fields', 'user_id,username,app_metadata');

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            authorization : 'Bearer ' + token,
        },
    });

    if (!response.ok) {
        await handleFetchError(response);
    }

    return await response.json() as Objects.User;
}


async function searchForSupervisor(token: string, query: string): Promise<Objects.SupervisorInfo | undefined> {
    const url = new URL('https://' + authvalues.DOMAIN + '/api/v2/users');
    url.searchParams.append('q', query);
    url.searchParams.append('per_page', '1');
    url.searchParams.append('search_engine', 'v3');

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            authorization : 'Bearer ' + token,
        },
    });

    if (!response.ok) {
        await handleFetchError(response);
    }

    const users = await response.json() as Objects.SupervisorInfo[];
    if (users.length > 0) {
        return users[0];
    }
    return undefined;
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
    const url = new URL('https://' + authvalues.DOMAIN + '/api/v2/users');
    url.searchParams.append('q', 'app_metadata.role:"supervisor"');
    url.searchParams.append('include_totals', 'true');
    url.searchParams.append('page', batch.toString());
    url.searchParams.append('per_page', batchsize.toString());
    url.searchParams.append('search_engine', 'v3');

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            authorization : 'Bearer ' + token,
        },
    });

    if (!response.ok) {
        await handleFetchError(response);
    }

    const data = await response.json() as { users: Objects.User[], total: number };
    return {
        users : data.users,
        total : data.total,
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
    const url = new URL('https://' + authvalues.DOMAIN + '/api/v2/users');
    url.searchParams.append('q', 'app_metadata.role:"student" AND app_metadata.tenant:"' + tenant + '"' + generateGroupQuery(studentgroup));
    url.searchParams.append('per_page', PAGE_SIZE.toString());
    url.searchParams.append('page', page.toString());
    url.searchParams.append('search_engine', 'v3');

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            authorization : 'Bearer ' + token,
        },
    });

    if (!response.ok) {
        await handleFetchError(response);
    }

    return await response.json() as Objects.User[];
}


export async function getClassSupervisors(token: string, tenant: string): Promise<Objects.SupervisorInfo[]> {
    const url = new URL('https://' + authvalues.DOMAIN + '/api/v2/users');
    url.searchParams.append('q', 'app_metadata.role:"supervisor" AND app_metadata.tenant:"' + tenant + '"');
    url.searchParams.append('per_page', PAGE_SIZE.toString());
    url.searchParams.append('search_engine', 'v3');

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            authorization : 'Bearer ' + token,
        },
    });

    if (!response.ok) {
        await handleFetchError(response);
    }

    return await response.json() as Objects.SupervisorInfo[];
}



export async function getUserCounts(token: string, tenant: string): Promise<Objects.UsersInfo> {
    const url = new URL('https://' + authvalues.DOMAIN + '/api/v2/users');
    url.searchParams.append('q', 'app_metadata.tenant:"' + tenant + '"');
    url.searchParams.append('fields', 'id');
    url.searchParams.append('include_fields', 'true');
    url.searchParams.append('include_totals', 'true');
    url.searchParams.append('search_engine', 'v3');

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            authorization : 'Bearer ' + token,
        },
    });

    if (!response.ok) {
        await handleFetchError(response);
    }

    return await response.json() as Objects.UsersInfo;
}



export async function createUser(token: string, newuser: Objects.NewUser): Promise<Objects.User> {
    const url = 'https://' + authvalues.DOMAIN + '/api/v2/users';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            authorization : 'Bearer ' + token,
            'content-type': 'application/json',
        },
        body: JSON.stringify(newuser),
    });

    if (!response.ok) {
        await handleFetchError(response);
    }

    return await response.json() as Objects.User;
}


export async function deleteUser(token: string, userid: string): Promise<void> {
    const url = 'https://' + authvalues.DOMAIN + '/api/v2/users/' + userid;

    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            authorization : 'Bearer ' + token,
        },
    });

    if (!response.ok) {
        await handleFetchError(response);
    }
}

export async function modifyUser(token: string, userid: string, modifications: Objects.Modifications)
    : Promise<Objects.User>
{
    const url = 'https://' + authvalues.DOMAIN + '/api/v2/users/' + userid;

    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            authorization : 'Bearer ' + token,
            'content-type': 'application/json',
        },
        body: JSON.stringify(modifications),
    });

    if (!response.ok) {
        await handleFetchError(response);
    }

    return await response.json() as Objects.User;
}

