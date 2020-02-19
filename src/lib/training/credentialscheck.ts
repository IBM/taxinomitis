// external dependencies
import * as LRU from 'lru';
// local dependencies
import * as Types from '../db/db-types';
import * as TrainingTypes from './training-types';
import * as constants from '../utils/constants';
import * as store from '../db/store';
import * as sessionusers from '../sessionusers';
import * as conversation from './conversation';
import * as visualRecognition from './visualrecognition';



let checkOutcomesCache: any;



export function init() {
    checkOutcomesCache = new LRU({
        max: 200,
        maxAge: constants.ONE_DAY_PLUS_A_BIT,
    });
}



const OK: TrainingTypes.CredentialsSupportResponse = {
    code: 'MLCRED-OK',
    message: 'ok',
};

export async function checkClass(tenant: string, type: Types.ProjectTypeLabel): Promise<TrainingTypes.CredentialsSupportResponse>
{
    // don't test session-users
    if (tenant === sessionusers.CLASS_NAME) {
        return OK;
    }

    const cacheCheck = getCachedOutcome(tenant, type);
    if (cacheCheck) {
        return cacheCheck;
    }


    // don't cache these three response types as they are
    // easy to work out without DB or IBM Cloud access

    if (type === 'numbers') {
        return {
            code : 'MLCRED-NUM',
            message : 'Watson API keys are not required for numbers projects',
        };
    }
    if (type === 'sounds') {
        return {
            code : 'MLCRED-SOUND',
            message : 'Watson API keys are not required for sounds projects',
        };
    }
    if (type !== 'text' && type !== 'images') {
        return {
            code : 'MLCRED-TYPEUNK',
            message : 'Unsupported project type',
        };
    }


    const classInfo = await store.getClassTenant(tenant);
    if (classInfo.isManaged) {
        // classes rarely change from managed/unmanaged so it
        //  should be safe to cache this
        return addOutcomeToCache(tenant, type, {
            code: 'MLCRED-MANAGED',
            message: 'Managed classes do not need to verify credentials',
        });
    }


    let servicetype: TrainingTypes.BluemixServiceType;
    if (type === 'text') {
        servicetype = 'conv';
    }
    else { // if (type === 'images') {
        servicetype = 'visrec';
    }

    let credentials: TrainingTypes.BluemixCredentials[] = [];
    try {
        credentials = await store.getBluemixCredentials(tenant, servicetype);
    }
    catch (err) {
        // no credentials in the DB surfaces as an "Unexpected response..." so
        //  we catch and swallow that error, but throw anything else
        if (err.message !== 'Unexpected response when retrieving service credentials') {
            throw err;
        }
    }
    if (credentials.length === 0) {
        // don't cache this as the teacher may quickly add an API key
        if (type === 'text') {
            return {
                code: 'MLCRED-TEXT-NOKEYS',
                message: 'There are no Watson Assistant credentials in this class',
            };
        }
        else { // if (type === 'images') {
            return {
                code: 'MLCRED-IMG-NOKEYS',
                message: 'There are no Visual Recognition credentials in this class',
            };
        }
    }

    if (type === 'text') {
        const txtpass = await conversation.testMultipleCredentials(credentials);
        if (!txtpass) {
            // don't cache this as the teacher may quickly add a valid API key
            return {
                code: 'MLCRED-TEXT-INVALID',
                message : 'No valid Watson Assistant credentials in this class',
            };
        }
    }
    else { // if (type === 'images') {
        const imgpass = await visualRecognition.testMultipleCredentials(credentials);
        if (!imgpass) {
            // don't cache this as the teacher may quickly add a valid API key
            return {
                code: 'MLCRED-IMG-INVALID',
                message : 'No valid Visual Recognition credentials in this class',
            };
        }
    }

    // no problems found!
    //  cache this so we don't need to check again very soon

    return addOutcomeToCache(tenant, type, OK);
}




function cacheKey(classid: string, type: Types.ProjectTypeLabel): string {
    return classid + '/' + type;
}


function addOutcomeToCache(classid: string, type: Types.ProjectTypeLabel,
                           outcome: TrainingTypes.CredentialsSupportResponse ): TrainingTypes.CredentialsSupportResponse
{
    checkOutcomesCache.set(cacheKey(classid, type), outcome);
    return outcome
}

function getCachedOutcome(classid: string, type: Types.ProjectTypeLabel): TrainingTypes.CredentialsSupportResponse | undefined {
    return checkOutcomesCache.get(cacheKey(classid, type));
}
