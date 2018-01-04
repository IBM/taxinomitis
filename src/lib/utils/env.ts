export const OBJECT_STORE_CREDS = 'OBJECT_STORE_CREDS';
export const OBJECT_STORE_BUCKET = 'OBJECT_STORE_BUCKET';

const ALL = [
    OBJECT_STORE_CREDS,
    OBJECT_STORE_BUCKET,
];

export function confirmRequiredEnvironment() {
    ALL.forEach(checkEnv);
}


function checkEnv(env: string) {
    if (!process.env[env]) {
        throw new Error('Missing required environment variable ' + env);
    }
}
