// external dependencies
import * as request from 'request-promise';
// local dependencies
import * as env from './env';
import loggerSetup from './logger';


const log = loggerSetup();

export type Execution = 'openwhisk' | 'local' | 'unknown';


let executionType: Execution = 'unknown';


export const FUNCTIONS = {
    TEST : '/api/auth-check',
    RESIZE_IMAGE : '/api/resize-image',
    CREATE_ZIP : '/api/create-zip',
    DESCRIBE_MODEL : '/api/describe-model',
};


export function getUrl(func: string): string {
    return process.env[env.SERVERLESS_OPENWHISK_URL] + func;
}

export function getHeaders(): { [key: string]: string | undefined } {
    return {
        'X-MachineLearningForKids-Function-Client-Id' : process.env[env.SERVERLESS_OPENWHISK_KEY],
    };
}


/**
 * Checks for environment variables with details of
 * an OpenWhisk instance.
 *
 * If environment variables are found, a single test
 * GET request is made to make sure that the
 * environment variables are good.
 *
 * @returns true - if the OpenWhisk functions are ready to use
 *         false - if there are no environment variables, or
 *                  the environment variables did not work
 */
async function pingOpenWhisk(): Promise<boolean> {
    if (process.env[env.SERVERLESS_OPENWHISK_KEY] &&
        process.env[env.SERVERLESS_OPENWHISK_URL])
    {
        const url = getUrl(FUNCTIONS.TEST);
        const headers = getHeaders();

        try {
            const response = await request({
                url,
                json : true,
                headers : {
                    ...headers,
                    'Accept': 'application/json',
                    'User-Agent': 'machinelearningforkids.co.uk',
                },
            });
            if (response.ok === true) {
                log.info('Using OpenWhisk for expensive functions');
                return true;
            }

            log.error({ response }, 'Failed to verify OpenWhisk environment');
            return false;
        }
        catch (err) {
            log.error({ err }, 'Invalid OpenWhisk environment');
            return false;
        }
    }

    log.info('Running all functions locally');
    return Promise.resolve(false);
}



export async function isOpenWhiskConfigured(): Promise<boolean> {
    if (executionType === 'unknown') {
        const useOpenwhisk = await pingOpenWhisk();
        executionType = useOpenwhisk ? 'openwhisk' : 'local';
        return executionType === 'openwhisk';
    }
    return Promise.resolve(executionType === 'openwhisk');
}
