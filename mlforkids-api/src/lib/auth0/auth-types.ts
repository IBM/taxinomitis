export interface Auth0TokenPayload {
    readonly access_token: string;
}

export interface User {
    user_id: string;
    email: string;
    username: string;
    app_metadata: UserMetadata;
    last_login?: string;
    created_at: string;
    logins_count: number;
}

export interface UsersInfo {
    start: number;
    limit: number;
    length: number;
    users: any[];
    total: number;
}

export interface NewUser {
    email: string;
    username: string;
    password: string;
    app_metadata: UserMetadata;
    connection: string;
    verify_email: boolean;
    email_verified: boolean;
}

export type UserRole = 'student' | 'supervisor';

export type UserMetadata = TeacherMetadata | StudentMetadata;

export interface StudentMetadata {
    role: UserRole;
    tenant: string;
    group?: string;
}
export interface TeacherMetadata {
    role: UserRole;
    tenant: string;
    groups?: string[];
}

export interface Student {
    id: string;
    username: string;
    last_login?: string;
}

export interface UserCreds {
    id: string;
    username: string;
    password: string;
}

export type Modifications = ClassGroupsModifications | GroupModifications | PasswordModifications;

export interface ClassGroupsModifications {
    readonly app_metadata: {
        readonly groups: string[];
    };
}
export interface GroupModifications {
    readonly app_metadata: {
        readonly group: string | undefined | null;
    };
}
export interface PasswordModifications {
    readonly password: string;
}


export interface TenantInfo {
    readonly id: string;
    readonly supervisors: SupervisorInfo[];
    readonly is_managed: boolean;
    readonly credentials: BluemixCredentialsCounts;
}

export interface SupervisorInfo {
    readonly user_id: string;
    readonly email: string;
    readonly username: string;
    readonly created: Date;
    readonly last_login?: Date;
    readonly logins_count: number;
    readonly app_metadata: TeacherMetadata;
}

export interface BluemixCredentialsCounts {
    readonly conv: number;
    readonly total: number;
}





/** used in queries to retrieve students that have not been assigned to a particular group */
export const UNGROUPED_STUDENTS = undefined;
/** used in queries to retrieve all students, regardless of the groups they are in */
export const ALL_STUDENTS = 'ALL';
