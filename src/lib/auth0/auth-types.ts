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

export interface UserMetadata {
    role: UserRole;
    tenant: string;
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

export interface Modifications {
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
}

export interface BluemixCredentialsCounts {
    readonly conv: number;
    readonly visrec: number;
    readonly total: number;
}
