// external dependencies
import * as httpstatus from 'http-status';
import * as Express from 'express';
// local dependencies
import * as auth from './auth';
import * as store from '../db/store';
import * as Types from '../db/db-types';
import * as dbobjects from '../db/objects';
import * as TrainingTypes from '../training/training-types';
import * as conversation from '../training/conversation';
import * as credentialsmgr from '../training/credentials';
import * as credentialscheck from '../training/credentialscheck';
import * as headers from './headers';
import * as urls from './urls';
import * as errors from './errors';
import loggerSetup from '../utils/logger';

const log = loggerSetup();



function returnConversationCredentials(credentials: TrainingTypes.BluemixCredentials) {
    if (conversation.getType(credentials) === 'legacy') {
        return {
            id : credentials.id,
            username : credentials.username,
            password : credentials.password,
            credstype : credentials.credstype,
        };
    }
    else {
        return {
            id : credentials.id,
            apikey : credentials.username + credentials.password,
            credstype : credentials.credstype,
        };
    }
}



async function getCredentials(reqWithTenant: auth.RequestWithTenant, res: Express.Response) {
    const servicetype: TrainingTypes.BluemixServiceType = reqWithTenant.query.servicetype as TrainingTypes.BluemixServiceType;

    if (!servicetype) {
        return res.status(httpstatus.BAD_REQUEST)
                    .json({ error : 'Missing required servicetype parameter' });
    }
    if (servicetype !== 'conv') {
        return res.status(httpstatus.BAD_REQUEST)
                   .json({ error : 'Unrecognised servicetype parameter' });
    }

    try {
        const credentials = await store.getBluemixCredentials(reqWithTenant.tenant, servicetype);
        switch (servicetype) {
        case 'conv':
            return res.json(credentials.map(returnConversationCredentials));
        }
    }
    catch (err){
        if (err.message === 'Unexpected response when retrieving service credentials') {
            return res.json([]);
        }
        log.error({ err }, 'Failed to get credentials');
        errors.unknownError(res, err);
    }
}



async function verifyCredentials(reqWithTenant: auth.RequestWithTenant, res: Express.Response) {
    const tenant = reqWithTenant.params.classid;
    const credsid = reqWithTenant.params.credentialsid;

    try {
        const credentials = await store.getBluemixCredentialsById(reqWithTenant.tenant.tenantType,
                                                                  credsid);
        if (credentials.classid !== tenant) {
            return errors.notFound(res);
        }

        if (credentials.servicetype === 'conv') {
            await conversation.getTextClassifiers(credentials);
        }

        return res.header(headers.CACHE_1HOUR)
                  .sendStatus(httpstatus.NO_CONTENT);
    }
    catch (err){
        if (err.message === 'Unexpected response when retrieving the service credentials') {
            return errors.notFound(res);
        }

        log.error({ err }, 'Failed to verify credentials');
        errors.unknownError(res, err);
    }
}



async function checkAvailableCredentials(req: Express.Request, res: Express.Response) {
    const tenant = req.params.classid;
    const type = req.params.type as Types.ProjectTypeLabel;

    try {
        const response = await credentialscheck.checkClass(tenant, type);

        let status: number = httpstatus.OK;
        let header = headers.CACHE_1HOUR;

        switch (response.code) {
        case 'MLCRED-OK':
        case 'MLCRED-MANAGED':
        case 'MLCRED-NUM':
        case 'MLCRED-SOUND':
        case 'MLCRED-TYPEUNK':
            status = httpstatus.OK;
            header = headers.CACHE_1YEAR;
            break;
        case 'MLCRED-TEXT-NOKEYS':
        case 'MLCRED-TEXT-INVALID':
            status = httpstatus.CONFLICT;
            header = headers.CACHE_1MINUTE;
            break;
        }

        return res.status(status).header(header).json(response);
    }
    catch (err){
        log.error({ err }, 'Failed to check available class credentials');
        return res.status(httpstatus.INTERNAL_SERVER_ERROR)
                .header(headers.CACHE_1MINUTE)
                .json({
                    code : 'MLCRED.FAIL',
                    message : err.message,
                });
    }
}



async function deleteCredentials(reqWithTenant: auth.RequestWithTenant, res: Express.Response) {
    const tenant = reqWithTenant.params.classid;
    const credsid = reqWithTenant.params.credentialsid;

    try {
        const credentials = await store.getBluemixCredentialsById(reqWithTenant.tenant.tenantType,
                                                                  credsid);
        if (credentials.classid !== tenant) {
            return errors.notFound(res);
        }

        await credentialsmgr.deleteBluemixCredentials(credentials);
        return res.sendStatus(httpstatus.NO_CONTENT);
    }
    catch (err){
        if (err.message === 'Unexpected response when retrieving the service credentials') {
            return errors.notFound(res);
        }

        log.error({ err }, 'Failed to delete credentials');
        errors.unknownError(res, err);
    }
}



async function addCredentials(req: Express.Request, res: Express.Response) {
    const tenant = req.params.classid;

    //
    // check that we've been given something that at least looks like
    //  a set of Bluemix credentials
    //
    let newCredentials: TrainingTypes.BluemixCredentials;
    try {
        newCredentials = dbobjects.createBluemixCredentials(
            req.body.servicetype, tenant,
            req.body.apikey,
            req.body.username, req.body.password,
            req.body.credstype);
    }
    catch (err) {
        return res.status(httpstatus.BAD_REQUEST).json({ error : err.message });
    }

    //
    // check that the credentials work by trying to use them in a
    //  Bluemix API call without failure
    //
    try {
        if (newCredentials.servicetype === 'conv') {
            const workingUrl = await conversation.identifyRegion(newCredentials.username,
                                                                 newCredentials.password);
            newCredentials.url = workingUrl;
        }
    }
    catch (err) {
        if (err.statusCode === httpstatus.UNAUTHORIZED ||
            err.statusCode === httpstatus.FORBIDDEN)
        {
            return res.status(httpstatus.BAD_REQUEST).json({
                error : 'Watson credentials could not be verified',
            });
        }
        log.error({ err }, 'Failed to validate credentials');
        return errors.unknownError(res, err);
    }

    //
    // validated! store the credentials as they look good
    //
    try {
        const credsObj = await store.storeBluemixCredentials(tenant, dbobjects.getCredentialsAsDbRow(newCredentials));
        res.status(httpstatus.CREATED).json(returnConversationCredentials(credsObj));
    }
    catch (err) {
        log.error({ err }, 'Failed to add credentials');
        errors.unknownError(res, err);
    }
}


async function modifyCredentials(req: Express.Request, res: Express.Response) {
    const tenant = req.params.classid;
    const credsid = req.params.credentialsid;

    let patch;
    try {
        patch = getCredentialsPatch(req);
    }
    catch (err) {
        return res.status(httpstatus.BAD_REQUEST)
                  .json({
                      error : err.message,
                  });
    }

    try {
        await store.setBluemixCredentialsType(tenant, credsid, patch.value.servicetype, patch.value.credstype);

        return res.sendStatus(httpstatus.NO_CONTENT);
    }
    catch (err) {
        if (err.message === 'Unrecognised credentials type') {
            return res.status(httpstatus.BAD_REQUEST).json({ error : err.message });
        }
        if (err.message === 'Bluemix credentials not updated') {
            return errors.notFound(res);
        }
        log.error({ err }, 'Failed to modify credentials');
        errors.unknownError(res, err);
    }
}




function getCredentialsPatch(req: Express.Request): ValidPatch {
    const patchRequests = req.body;

    if (Array.isArray(patchRequests) === false) {
        throw new Error('PATCH body should be an array');
    }

    if (patchRequests.length !== 1) {
        throw new Error('Only individual PATCH requests are supported');
    }

    const patchRequest = patchRequests[0];

    if (patchRequest.path !== '/credstype') {
        throw new Error('Only modifications to credentials type are supported');
    }

    if (!patchRequest.op) {
        throw new Error('PATCH requests must include an op');
    }
    const op: string = patchRequest.op;

    if (!patchRequest.value) {
        throw new Error('PATCH requests must include a value');
    }
    const value = patchRequest.value;
    if (op === 'replace') {
        if (value.servicetype &&
            value.servicetype === 'conv' &&
            value.credstype)
        {
            if (value.credstype.startsWith('conv') === false)
            {
                throw new Error('Invalid credentials type');
            }
            // valid
        }
        else {
            throw new Error('PATCH requests must specify the service type and credentials type');
        }
    }
    else {
        throw new Error('Invalid PATCH op');
    }

    return { op, value };
}


interface ValidPatch {
    readonly op: 'replace';
    readonly value: {
        readonly servicetype: 'conv';
        readonly credstype: TrainingTypes.BluemixCredentialsTypeLabel;
    };
}


export default function registerApis(app: Express.Application) {
    app.get(urls.BLUEMIX_CREDENTIALS,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        auth.ensureUnmanagedTenant,
        // @ts-ignore
        getCredentials);

    app.get(urls.BLUEMIX_CREDENTIAL,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        auth.ensureUnmanagedTenant,
        // @ts-ignore
        verifyCredentials);

    app.delete(urls.BLUEMIX_CREDENTIAL,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        auth.ensureUnmanagedTenant,
        // @ts-ignore
        deleteCredentials);

    app.patch(urls.BLUEMIX_CREDENTIAL,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        auth.ensureUnmanagedTenant,
        modifyCredentials);

    app.post(urls.BLUEMIX_CREDENTIALS,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        auth.ensureUnmanagedTenant,
        addCredentials);

    app.get(urls.BLUEMIX_SUPPORT,
        auth.authenticate,
        auth.checkValidUser,
        checkAvailableCredentials);
}
