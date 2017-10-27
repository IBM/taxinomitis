export interface User {
    user_id: string;
    email: string;
    username: string;
    app_metadata: UserMetadata;
    last_login?: string;
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

