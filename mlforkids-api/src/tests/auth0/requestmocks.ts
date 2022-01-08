/*eslint-env mocha */
/*eslint no-unused-vars: 0 */

import * as Objects from '../../lib/auth0/auth-types';

const TOKENS = {
    GOOD : 'eyJ0eXAiOiJKV1QiLCXXXciOiJSUzI1NYYYImtpZCI6Ik5VRkZRMEZFUlRVMk1qQXhNMEU1TXpaQ09FVkZRVVU1' +
           'UmpRMk1UazRPRU01TmpRek5ETTFRUSJ9.eyJpc3MiOiJodHRwczovL2RhbGVsYW5lLmV1LmF1dGgwLmNvbS8iLC' +
           'JzdWIiOiJ6bmdXWWJWdnNGbWUwQmF3amNyVXl4MmFlNmxneHh5VkBjbGllbnRzIiwiYXVkIjoiaHR0cHM6Ly9kY' +
           'WxlbGFuZS5ldS5hdXRoMC5jb20vYXBpL3YyLyIsImV4cCI6MTQ5MTE3MjMzNywiaWF0IjoxNDkxMDg1OTM3LCJz' +
           'Y29wZSI6InJlYWQ6dXNlcnMgdXBkYXRlOnVzZXJzIGRlbGV0ZTp1c2VycyBjcmVhdGU6dXNlcnMgcmVhZDp1c2V' +
           'yX2lkcF90b2tlbnMifQ.W1us_c9XbGrDSfa5pHzP1V1jj2rMqI_7xd2-iM_b8N2kfxkzPa5JGxrqtMOpuW9c-MO' +
           'kPGrEtFay_LdVWpI_S3xNOfEwULAs8Y6F2OrtBnTfKmSf-JY9JyzubStDvQMPB6noXlhR9a9WG91bdmvX9CKg3p' +
           '7ocbYQ_xxEdOUqNx6BWOXZbpLmpyyxxS3jgMzl5EgDsdjlCQ6nzCTFcWS6_aUMK-jpNjMr_tB25BTnfq23rEkMu' +
           'FmIY8KMZyj1_Y47BPjHhswkZvMFsWARfYntDefZujYCgniZcegGo8L6uvYvWEIL4IuQO8sOy9uxXUGT5Xl0kvVL' +
           '58-pFeRf7SX3Tg',
};


export const getOauthToken = {
    good : () => {
        return Promise.resolve({
            access_token : TOKENS.GOOD,
            expires_in : 86400,
            scope : 'read:users update:users delete:users create:users read:user_idp_tokens',
            token_type : 'Bearer',
        });
    },
};


export const getUser = {
    johndoe : (token: string, userid: string) => { // eslint-disable-line no-unused-vars
        const user: unknown = {
            email: 'bobbyball@do-not-require-emailaddresses-for-students.com',
            username: 'bobbyball',
            email_verified: true,
            user_id: 'auth0|58dd72d0b2e87002695249b6',
            picture: 'https://s.gravatar.com/avatar/6a7512080cf8cfd52c49e04a28997521',
            nickname: 'bobbyball',
            identities: [
                {
                    user_id: '58dd72d0b2e87002695249b6',
                    provider: 'auth0',
                    connection: 'ml-for-kids-users',
                    isSocial: false,
                },
            ],
            updated_at: '2017-04-16T23:29:12.445Z',
            created_at: '2017-03-30T21:04:16.866Z',
            name: 'bobbyball@do-not-require-emailaddresses-for-students.com',
            last_password_reset: '2017-04-16T23:29:09.355Z',
            app_metadata: {
                role: 'student',
                tenant: 'single',
            },
            last_ip: '87.114.106.231',
            last_login: '2017-04-16T23:29:12.445Z',
            logins_count: 2,
            blocked_for: [],
            guardian_enrollments: [],
        };
        return Promise.resolve(user as Objects.User);
    },
};

export const getUsers = {
    empty : (token: string, tenant: string) => { // eslint-disable-line no-unused-vars
        return Promise.resolve([]);
    },
    single : (token: string, tenant: string): Promise<Objects.User[]> => { // eslint-disable-line no-unused-vars
        const role: Objects.UserRole = 'student';
        return Promise.resolve([
            {
                email: 'bobbyball@do-not-require-emailaddresses-for-students.com',
                username: 'bobbyball',
                email_verified: true,
                user_id: 'auth0|58dd72d0b2e87002695249b6',
                picture: 'https://s.gravatar.com/avatar/6a7512080cf8cfd52c49e04a28997521',
                nickname: 'bobbyball',
                identities: [
                    {
                        user_id: '58dd72d0b2e87002695249b6',
                        provider: 'auth0',
                        connection: 'ml-for-kids-users',
                        isSocial: false,
                    },
                ],
                updated_at: '2017-04-16T23:29:12.445Z',
                created_at: '2017-03-30T21:04:16.866Z',
                name: 'bobbyball@do-not-require-emailaddresses-for-students.com',
                last_password_reset: '2017-04-16T23:29:09.355Z',
                app_metadata: {
                    role,
                    tenant: 'single',
                },
                last_ip: '87.114.106.231',
                last_login: '2017-04-16T23:29:12.445Z',
                logins_count: 2,
                blocked_for: [],
                guardian_enrollments: [],
            },
        ]);
    },
    error : (token: string, tenant: string) => { // eslint-disable-line no-unused-vars
        throw new Error('Failed to get users');
    },
};


export const getUserCounts = (token: string, tenant: string) => { // eslint-disable-line no-unused-vars
    return Promise.resolve({
        start : 0,
        limit : 50,
        length : 5,
        total : 5,
        users : [ {}, {}, {}, {}, {} ],
    });
};

export const createUser = {
    good : (token: string, newuser: Objects.NewUser) => {
        const placeholder: unknown = {
            email : newuser.email,
            username : newuser.username,
            app_metadata : newuser.app_metadata,
            identities : [
                {
                    connection : newuser.connection,
                    user_id: '58f53e68d5a7f96b05b72c70',
                    provider: 'auth0',
                    isSocial: false,
                },
            ],
            email_verified : false,
            user_id : 'auth0|58f53e68d5a7f96b05b72c70',
            picture: 'https://s.gravatar.com/avatar/e3c2ee5413cf2a34ec3f9d3f605b9067',
            updated_at: '2017-04-17T22:15:04.536Z',
            created_at: '2017-04-17T22:15:04.536Z',
        };
        return Promise.resolve(placeholder as Objects.User);
    },
};

export const deleteUser = {
    good : (token: string, userid: string) => { // eslint-disable-line no-unused-vars
        return Promise.resolve();
    },
};

export const modifyUser = {
    good : (token: string, userid: string, modifications: object) => { // eslint-disable-line no-unused-vars
        const placeholder: unknown = {
            email: 'bobbyball@do-not-require-emailaddresses-for-students.com',
            username: 'bobbyball',
            email_verified: true,
            user_id: userid,
            picture: 'https://s.gravatar.com/avatar/6a7512080cf8cfd52c49e04a28997521',
            nickname: 'bobbyball',
            identities:
            [ { user_id: userid,
                provider: 'auth0',
                connection: 'ml-for-kids-users',
                isSocial: false } ],
            updated_at: '2017-04-16T23:29:12.445Z',
            created_at: '2017-03-30T21:04:16.866Z',
            name: 'bobbyball@do-not-require-emailaddresses-for-students.com',
            last_password_reset: '2017-04-16T23:29:09.355Z',
            app_metadata: { role: 'student', tenant: 'apple' },
            last_ip: '87.114.106.231',
            last_login: '2017-04-16T23:29:12.445Z',
            logins_count: 2,
        };
        return Promise.resolve(placeholder as Objects.User);
    },
};
