// external dependencies
import * as request from 'request-promise';
// local dependencies
import * as Objects from './auth-types';

// NO LOGIC IN HERE!
//  PUTTING ONLY XHR REQUESTS IN ONE PLACE MAKES IT EASIER TO STUB OUT AUTH0 FOR TEST PURPOSES
//  ANYTHING THAT LOOKS LIKE APP LOGIC SHOULDN'T GO IN HERE AS IT WON'T BE TESTED AS MUCH


export function getOauthToken() {
    const options = {
        method: 'POST',
        url: 'https://' + process.env.AUTH0_DOMAIN + '/oauth/token',
        headers: { 'content-type': 'application/json' },
        json : true,
        body: {
            client_id : process.env.AUTH0_API_CLIENTID,
            client_secret : process.env.AUTH0_API_CLIENTSECRET,
            audience : 'https://' + process.env.AUTH0_DOMAIN + '/api/v2/',
            grant_type : 'client_credentials',
        },
    };

    return request.post(options);
}

export async function getUser(token: string, userid: string): Promise<Objects.User> {
    const getoptions = {
        method: 'GET',
        url: 'https://' + process.env.AUTH0_DOMAIN + '/api/v2/users/' + userid,
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

export async function getUsers(token: string, tenant: string): Promise<Objects.User[]> {
    const getoptions = {
        method: 'GET',
        url: 'https://' + process.env.AUTH0_DOMAIN + '/api/v2/users',
        headers: {
            authorization : 'Bearer ' + token,
        },
        qs : {
            q : 'app_metadata.role:"student" AND app_metadata.tenant:"' + tenant + '"',
        },
        json : true,
    };

    const users = await request.get(getoptions);
    return users;
}




export async function getUserCounts(token: string, tenant: string): Promise<Objects.UsersInfo> {
    const getoptions = {
        method: 'GET',
        url: 'https://' + process.env.AUTH0_DOMAIN + '/api/v2/users',
        headers: {
            authorization : 'Bearer ' + token,
        },
        qs : {
            q : 'app_metadata.tenant:"' + tenant + '"',
            fields : 'id',
            include_fields : true,
            include_totals : true,
        },
        json : true,
    };

    const usersInfo = await request.get(getoptions);
    return usersInfo;
}



export function createUser(token: string, newuser: Objects.NewUser) {
    const createoptions = {
        method: 'POST',
        url: 'https://' + process.env.AUTH0_DOMAIN + '/api/v2/users',
        headers: {
            authorization : 'Bearer ' + token,
        },
        body : newuser,
        json : true,
    };

    return request.post(createoptions)
        .catch((resp) => {
            if (resp.error) {
                throw resp.error;
            }
            else {
                throw resp;
            }
        });
}


export function deleteUser(token: string, userid: string) {
    const deleteoptions = {
        method: 'DELETE',
        url: 'https://' + process.env.AUTH0_DOMAIN + '/api/v2/users/' + userid,
        headers: {
            authorization : 'Bearer ' + token,
        },
    };

    return request.delete(deleteoptions);
}

export function modifyUser(token: string, userid: string, modifications) {
    const modifyoptions = {
        method: 'PATCH',
        url: 'https://' + process.env.AUTH0_DOMAIN + '/api/v2/users/' + userid,
        headers: {
            authorization : 'Bearer ' + token,
        },
        body : modifications,
        json : true,
    };

    return request.patch(modifyoptions);
}

