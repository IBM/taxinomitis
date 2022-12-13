// local dependencies
import * as deployment from './deployment';
import portNumber from './port';

export const OBJECT_STORE_CREDS = 'OBJECT_STORE_CREDS';
export const OBJECT_STORE_BUCKET = 'OBJECT_STORE_BUCKET';
export const AUTH0_DOMAIN = 'AUTH0_DOMAIN';
export const AUTH0_CUSTOM_DOMAIN = 'AUTH0_CUSTOM_DOMAIN';
export const AUTH0_CONNECTION = 'AUTH0_CONNECTION';
export const AUTH0_CLIENT_SECRET = 'AUTH0_CLIENT_SECRET';
export const AUTH0_CALLBACK_URL = 'AUTH0_CALLBACK_URL';
export const AUTH0_API_CLIENTID = 'AUTH0_API_CLIENTID';
export const AUTH0_API_CLIENTSECRET = 'AUTH0_API_CLIENTSECRET';
export const AUTH0_AUDIENCE = 'AUTH0_AUDIENCE';
export const POSTGRESQLHOST = 'POSTGRESQLHOST';
export const POSTGRESQLPORT = 'POSTGRESQLPORT';
export const POSTGRESQLUSER = 'POSTGRESQLUSER';
export const POSTGRESQLPASSWORD = 'POSTGRESQLPASSWORD';
export const POSTGRESQLDATABASE = 'POSTGRESQLDATABASE';
export const POSTGRESQLCERT = 'POSTGRESQLCERT';
export const NUMBERS_SERVICE = 'NUMBERS_SERVICE';
export const NUMBERS_SERVICE_USER = 'NUMBERS_SERVICE_USER';
export const NUMBERS_SERVICE_PASS = 'NUMBERS_SERVICE_PASS';
export const SLACK_WEBHOOK_URL = 'SLACK_WEBHOOK_URL';
export const SITE_HOST_URL = 'SITE_HOST_URL';
export const SMTP_HOST = 'SMTP_HOST';
export const SMTP_PORT = 'SMTP_PORT';
export const SMTP_USER = 'SMTP_USER';
export const SMTP_PASS = 'SMTP_PASS';
export const SMTP_REPLY_TO = 'SMTP_REPLY_TO';
export const SERVERLESS_OPENWHISK_URL = 'SERVERLESS_OPENWHISK_URL';
export const SERVERLESS_OPENWHISK_KEY = 'SERVERLESS_OPENWHISK_KEY';
export const SPOTIFY_CLIENT_ID = 'SPOTIFY_CLIENT_ID';
export const SPOTIFY_CLIENT_SECRET = 'SPOTIFY_CLIENT_SECRET';
const MAINTENANCE_MODE = 'MAINTENANCE_MODE';


const DEFAULT = [
    POSTGRESQLHOST, POSTGRESQLPORT, POSTGRESQLUSER, POSTGRESQLDATABASE,
];

const PROD = [
    OBJECT_STORE_CREDS, OBJECT_STORE_BUCKET,
    AUTH0_DOMAIN, AUTH0_CUSTOM_DOMAIN, AUTH0_CONNECTION, AUTH0_CLIENT_SECRET,
    AUTH0_CALLBACK_URL, AUTH0_API_CLIENTID, AUTH0_API_CLIENTSECRET,
    AUTH0_AUDIENCE,
    POSTGRESQLHOST, POSTGRESQLPORT, POSTGRESQLUSER, POSTGRESQLPASSWORD, POSTGRESQLDATABASE,
    NUMBERS_SERVICE, NUMBERS_SERVICE_USER, NUMBERS_SERVICE_PASS,
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_REPLY_TO,
    // optional - not required for prod
    // SLACK_WEBHOOK_URL,
    // SERVERLESS_OPENWHISK_URL, SERVERLESS_OPENWHISK_KEY,
    // MAINTENANCE_MODE,
    // SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
];

export function confirmRequiredEnvironment() {
    if (deployment.isProdDeployment()) {
        PROD.forEach(checkEnv);
    }
    else {
        DEFAULT.forEach(checkEnv);
    }
}


function checkEnv(env: string) {
    if (!process.env[env]) {
        throw new Error('Missing required environment variable ' + env);
    }
}

export function inMaintenanceMode() {
    return process.env[MAINTENANCE_MODE] === 'true';
}

export function getSiteHostUrl() {
    if (process.env[SITE_HOST_URL]) {
        return process.env[SITE_HOST_URL];
    }
    return 'http://localhost:' + getPortNumber();
}

export function getPortNumber(): number {
    return portNumber(process.env.PORT, 8000);
}
