// external dependencies
import * as randomstring from 'randomstring';
// local dependencies
import * as auth0requests from './requests';
import * as Objects from './auth-types';
import * as passphrases from './passphrases';
import * as env from '../utils/env';
import * as notifications from '../notifications/slack';


export async function getBearerToken(): Promise<string> {
    const body = await auth0requests.getOauthToken();
    return body.access_token;
}


function verifyTenant(student: Objects.UserMetadata, tenant: string) {
    if (student.tenant !== tenant) {
        const invalidTenant: any = new Error('Invalid tenant');
        invalidTenant.statusCode = 404;
        invalidTenant.error = 'Not Found';
        invalidTenant.message = 'Userid with this tenant not found';
        invalidTenant.errorCode = 'inexistent_user';
        throw invalidTenant;
    }
}
function verifyRole(student: Objects.UserMetadata, role: Objects.UserRole) {
    if (student.role !== role) {
        const invalidUser: any = new Error('Invalid user role');
        invalidUser.statusCode = 404;
        invalidUser.error = 'Not Found';
        invalidUser.message = 'User with the specified userid and role not found';
        invalidUser.errorCode = 'inexistent_user';
        throw invalidUser;
    }
}

export async function getStudentUsingToken(token: string, tenant: string, userid: string): Promise<Objects.Student> {
    try {
        const response: Objects.User = await auth0requests.getUser(token, userid);

        const student = response.app_metadata;
        verifyTenant(student, tenant);
        verifyRole(student, 'student');

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

export function getStudent(tenant: string, userid: string): Promise<Objects.Student> {
    return getBearerToken()
        .then((token) => {
            return getStudentUsingToken(token, tenant, userid);
        });
}


async function getStudents(token: string, tenant: string, studentgroup: string | undefined, page: number): Promise<Objects.Student[]> {
    const students: Objects.User[] = await auth0requests.getUsers(token, tenant, studentgroup, page);

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


export async function getAllStudents(tenant: string, studentgroup: string | undefined): Promise<Objects.Student[]> {
    let page: number = 0;
    let allstudents: Objects.Student[] = [];
    let students: Objects.Student[] = [];

    const token = await getBearerToken();

    // the maximum size of a class is 255 students, so the most times
    //  this will ever loop is 3 times. plus each student is very small,
    //  so the overall memory implication of this loop isn't as bad
    //  as it looks

    students = await getStudents(token, tenant, studentgroup, page++);

    while (students.length === auth0requests.PAGE_SIZE) {
        allstudents = allstudents.concat(students);
        students = await getStudents(token, tenant, studentgroup, page++);
    }
    allstudents = allstudents.concat(students);


    return allstudents;
}


export async function getStudentsByUserId(tenant: string): Promise<{ [id: string]: Objects.Student }> {
    const students = await getAllStudents(tenant, Objects.ALL_STUDENTS);

    const studentsIndexedById: {[id: string]: Objects.Student } = {};

    students.forEach((student) => {
        studentsIndexedById[student.id] = student;
    });

    return studentsIndexedById;
}


export async function getTeacherByClassId(tenant: string): Promise<Objects.SupervisorInfo | undefined> {
    const token = await getBearerToken();

    return auth0requests.getSupervisor(token, tenant);
}

export async function getTeacherByEmail(email: string): Promise<Objects.SupervisorInfo | undefined> {
    const token = await getBearerToken();

    return auth0requests.getSupervisorByEmail(token, email);
}

export async function countUsers(tenant: string): Promise<number> {
    const token = await getBearerToken();
    const usersCountsInfo: Objects.UsersInfo = await auth0requests.getUserCounts(token, tenant);
    return usersCountsInfo.total;
}


async function createUser(newUserDetails: Objects.NewUser): Promise<Objects.UserCreds> {
    const token = await getBearerToken();
    const user = await auth0requests.createUser(token, newUserDetails);
    return {
        id : user.user_id,
        username : user.username,
        password : newUserDetails.password,
    };
}

export function createStudent(tenant: string, username: string, studentgroup?: string): Promise<Objects.UserCreds> {
    return createUser({
        email : username + '@do-not-require-emailaddresses-for-students.com',
        username,
        password : passphrases.generate(),
        verify_email : false,
        email_verified : true,
        connection : process.env[env.AUTH0_CONNECTION] as string,
        app_metadata : {
            role : 'student',
            tenant,
            group : studentgroup,
        },
    });
}

export function createStudentWithPwd(tenant: string, username: string, password: string, studentgroup?: string): Promise<Objects.UserCreds> {
    return createUser({
        email : username + '@do-not-require-emailaddresses-for-students.com',
        username, password,
        verify_email : false,
        email_verified : true,
        connection : process.env[env.AUTH0_CONNECTION] as string,
        app_metadata : {
            role : 'student',
            tenant,
            group : studentgroup,
        },
    });
}

export function createTeacher(tenant: string, username: string, email: string): Promise<Objects.UserCreds> {
    return createUser({
        email,
        username,
        password : randomstring.generate({ length : 12, readable : true }),
        verify_email : true,
        email_verified : false,
        connection : process.env[env.AUTH0_CONNECTION] as string,
        app_metadata : {
            role : 'supervisor',
            tenant,
        },
    });
}

export function createVerifiedTeacher(tenant: string, username: string, email: string): Promise<Objects.UserCreds> {
    return createUser({
        email,
        username,
        password : randomstring.generate({ length : 12, readable : true }),
        verify_email : true,
        email_verified : true,
        connection : process.env[env.AUTH0_CONNECTION] as string,
        app_metadata : {
            role : 'supervisor',
            tenant,
        },
    });
}



export async function deleteStudent(tenant: string, userid: string) {
    const token = await getBearerToken();

    // will verify the tenant matches the student
    //   throwing an exception if there is a problem
    await getStudentUsingToken(token, tenant, userid);

    return auth0requests.deleteUser(token, userid);
}

export async function deleteTeacher(tenant: string, userid: string) {
    const token = await getBearerToken();
    return auth0requests.deleteUser(token, userid);
}


async function resetPassword(
    tenant: string,
    userid: string, password: string,
    token: string,
): Promise<Objects.UserCreds>
{
    // will verify the tenant matches the student
    //   throwing an exception if there is a problem
    await getStudentUsingToken(token, tenant, userid);

    const user = await auth0requests.modifyUser(token, userid, { password });

    return {
        id : user.user_id,
        username : user.username,
        password,
    };
}


/**
 * Resets the password for a group of users.
 *
 * This is a very slow function, so it will return after
 * verifying that have generated the password and successfully
 * created the bearer token to use.
 *
 * @returns the password that the students will be given
 */
export async function resetStudentsPassword(tenant: string, userids: string[]): Promise<string>
{
    const password = passphrases.generate();

    const token = await getBearerToken();

    // Intentionally not using 'await' here - which means
    // the next line will continue without waiting for
    // the function to complete
    // This is because we don't want to force the client
    // to wait for this to finish
    backgroundResetPasswords(tenant, token, userids, password);

    return password;
}


async function backgroundResetPasswords(
    tenant: string, token: string,
    userids: string[], password: string,
): Promise<Objects.UserCreds[]>
{
    notifications.notify('Resetting passwords for ' + tenant,
                         notifications.SLACK_CHANNELS.PASSWORD_RESET);

    let backoffMs = 5;
    const MAX_BACKOFF_MS = 5000;

    const allCreds: Objects.UserCreds[] = [];

    // auth0 will reject a large number of concurrent requests, so
    //  we do this sequentially
    for (const userid of userids) {
        const creds = await resetPassword(tenant, userid, password, token);
        allCreds.push(creds);

        // auth0 rate-limits aggressively, so protect against
        //  large workloads by waiting increasingly long times
        //  for large requests
        await pause(backoffMs);
        backoffMs += 50;

        // set an upper limit for how long to wait between requests
        backoffMs = backoffMs > MAX_BACKOFF_MS ? MAX_BACKOFF_MS : backoffMs;
    }

    notifications.notify('Resetting passwords for ' + tenant + ' complete.',
                         notifications.SLACK_CHANNELS.PASSWORD_RESET);
    return allCreds;
}


function pause(delay: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, delay);
    });
}


export async function resetStudentPassword(tenant: string, userid: string): Promise<Objects.UserCreds> {
    const token = await getBearerToken();

    const password = passphrases.generate();

    // will verify the tenant matches the student
    //   throwing an exception if there is a problem
    await getStudentUsingToken(token, tenant, userid);

    const modifications = { password };

    const user = await auth0requests.modifyUser(token, userid, modifications);

    return {
        id : user.user_id,
        username : user.username,
        password,
    };
}

export async function addStudentsToGroup(tenant: string, userids: string[], studentgroup: string | undefined): Promise<Objects.User[]> {
    const token = await getBearerToken();

    return Promise.all(userids.map((userid) => {
        return addStudentToGroup(token, tenant, userid, studentgroup);
    }));
}

export async function addStudentToGroup(token: string, tenant: string, userid: string, studentgroup: string | undefined): Promise<Objects.User> {
    // will verify the tenant matches the student
    //   throwing an exception if there is a problem
    await getStudentUsingToken(token, tenant, userid);

    const modifications = {
        app_metadata : {
            group : studentgroup ? studentgroup : null,
        },
    };

    const user = await auth0requests.modifyUser(token, userid, modifications);

    return {
        user_id : user.user_id,
        username : user.username,
        email : user.email,

        logins_count : user.logins_count,
        created_at : user.created_at,
        app_metadata : user.app_metadata,
    };
}

function teacherGroups(teacher: Objects.SupervisorInfo): string[] {
    if (teacher &&
        teacher.app_metadata &&
        teacher.app_metadata.role === 'supervisor' &&
        teacher.app_metadata.groups &&
        Array.isArray(teacher.app_metadata.groups))
    {
        return teacher.app_metadata.groups;
    }
    return [];
}

export async function addGroupToClass(tenant: string, newgroup: string): Promise<void> {
    if (newgroup !== Objects.ALL_STUDENTS && newgroup !== 'ungrouped') {
        const token = await getBearerToken();

        const teachers = await auth0requests.getClassSupervisors(token, tenant);
        const groups: Set<string> = new Set();
        for (const teacheruser of teachers) {
            teacherGroups(teacheruser).forEach((existinggroup: string) => groups.add(existinggroup));
        }

        groups.add(newgroup);

        const updateGroups: Objects.ClassGroupsModifications = {
            app_metadata : {
                groups : Array.from(groups),
            },
        };
        for (const teacheruser of teachers) {
            await auth0requests.modifyUser(token, teacheruser.user_id, updateGroups);
        }
    }
}

export async function removeGroupFromClass(tenant: string, grouptodelete: string): Promise<void> {
    const token = await getBearerToken();

    const students = await getStudents(token, tenant, grouptodelete, 0);
    if (students.length > 0) {
        throw new Error('Groups cannot be deleted while they still have students');
    }

    const teachers = await auth0requests.getClassSupervisors(token, tenant);
    const groups: Set<string> = new Set();
    for (const teacheruser of teachers) {
        teacherGroups(teacheruser).forEach((existinggroup: string) => groups.add(existinggroup));
    }

    groups.delete(grouptodelete);

    const updateGroups: Objects.ClassGroupsModifications = {
        app_metadata : {
            groups : Array.from(groups),
        },
    };
    for (const teacheruser of teachers) {
        await auth0requests.modifyUser(token, teacheruser.user_id, updateGroups);
    }
}
