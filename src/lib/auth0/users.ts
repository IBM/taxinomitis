// external dependencies
import * as randomstring from 'randomstring';
// local dependencies
import * as auth0requests from './requests';
import * as Objects from './auth-types';
import loggerSetup from '../utils/logger';


const log = loggerSetup();


async function getBearerToken(): Promise<string> {
    log.debug('getting a bearer token');
    const body = await auth0requests.getOauthToken();
    return body.access_token;
}


export async function getStudent(tenant: string, userid: string): Promise<Objects.Student> {
    try {
        const token = await getBearerToken();

        const response: Objects.User = await auth0requests.getUser(token, userid);

        const student = response.app_metadata;

        if (student.tenant !== tenant) {
            const invalidTenant: any = new Error('Invalid tenant');
            invalidTenant.statusCode = 404;
            invalidTenant.error = 'Not Found';
            invalidTenant.message = 'Userid with this tenant not found';
            invalidTenant.errorCode = 'inexistent_user';
            throw invalidTenant;
        }

        return {
            id: response.user_id,
            username: response.username,
            last_login: response.last_login,
        };
    }
    catch (err) {
        if (err && err.response && err.response.body) {
            throw err.response.body;
        }
        else {
            throw err;
        }
    }
}


export async function getStudents(tenant: string): Promise<Objects.Student[]> {
    const token = await getBearerToken();

    const students: Objects.User[] = await auth0requests.getUsers(token, tenant);

    return students
        .filter((student) => {
            return student.app_metadata.tenant === tenant;
        })
        .map((student) => {
            return {
                id : student.user_id,
                username : student.username,
                last_login : student.last_login,
            };
        });
}


export async function createStudent(tenant: string, username: string): Promise<Objects.UserCreds> {
    const password = randomstring.generate({ length : 9, readable : true });

    const token = await getBearerToken();

    const newUserDetails: Objects.NewUser = {
        email : username + '@do-not-require-emailaddresses-for-students.com',
        username,
        password,
        app_metadata : {
            role : 'student',
            tenant,
        },
    };

    const user = await auth0requests.createUser(token, newUserDetails);

    return {
        id : user.user_id,
        username : user.username,
        password,
    };
}


export async function deleteStudent(tenant: string, userid: string) {
    // will verify the tenant matches the student
    //   throwing an exception if there is a problem
    await getStudent(tenant, userid);

    const token = await getBearerToken();

    return auth0requests.deleteUser(token, userid);
}


export async function resetStudentPassword(tenant: string, userid: string): Promise<Objects.UserCreds> {
    const password = randomstring.generate({ length : 9, readable : true });

    // will verify the tenant matches the student
    //   throwing an exception if there is a problem
    await getStudent(tenant, userid);

    const token = await getBearerToken();

    const modifications = { password };

    const user = await auth0requests.modifyUser(token, userid, modifications);

    return {
        id : user.user_id,
        username : user.username,
        password,
    };
}

