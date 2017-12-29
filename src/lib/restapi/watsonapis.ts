// external dependencies
import * as httpstatus from 'http-status';
import * as Express from 'express';
// local dependencies
import * as auth0 from '../auth0/users';
import * as auth from './auth';
import * as store from '../db/store';
import * as dbobjects from '../db/objects';
import * as TrainingTypes from '../training/training-types';
import * as conversation from '../training/conversation';
import * as visualRecognition from '../training/visualrecognition';
import * as urls from './urls';
import * as headers from './headers';
import * as errors from './errors';
import loggerSetup from '../utils/logger';

const log = loggerSetup();



function returnVisualRecognitionCredentials(credentials: TrainingTypes.BluemixCredentials) {
    return {
        id : credentials.id,
        apikey : credentials.username + credentials.password,
    };
}
function returnConversationCredentials(credentials: TrainingTypes.BluemixCredentials) {
    return {
        id : credentials.id,
        username : credentials.username,
        password : credentials.password,
    };
}



async function getCredentials(req: Express.Request, res: Express.Response) {
    const tenant = req.params.classid;
    const servicetype: TrainingTypes.BluemixServiceType = req.query.servicetype;

    if (!servicetype) {
        return res.status(httpstatus.BAD_REQUEST)
                    .json({ error : 'Missing required servicetype parameter' });
    }
    if (servicetype !== 'visrec' && servicetype !== 'conv') {
        return res.status(httpstatus.BAD_REQUEST)
                   .json({ error : 'Unrecognised servicetype parameter' });
    }

    try {
        const credentials = await store.getBluemixCredentials(tenant, servicetype);
        switch (servicetype) {
        case 'conv':
            return res.json(credentials.map(returnConversationCredentials));
        case 'visrec':
            return res.json(credentials.map(returnVisualRecognitionCredentials));
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


async function deleteCredentials(req: Express.Request, res: Express.Response) {
    const tenant = req.params.classid;
    const credsid = req.params.credentialsid;

    try {
        const credentials = await store.getBluemixCredentialsById(credsid);
        if (credentials.classid !== tenant) {
            return errors.notFound(res);
        }

        await store.deleteBluemixCredentials(credsid);
        return res.sendStatus(httpstatus.NO_CONTENT);
    }
    catch (err){
        log.error({ err }, 'Failed to delete credentials');
        errors.unknownError(res, err);
    }
}



async function addCredentials(req: Express.Request, res: Express.Response) {
    const tenant = req.params.classid;

    let newCredentials: TrainingTypes.BluemixCredentials;
    try {
        newCredentials = dbobjects.createBluemixCredentials(
            req.body.servicetype, tenant,
            req.body.apikey,
            req.body.username, req.body.password);
    }
    catch (err) {
        return res.status(httpstatus.BAD_REQUEST).json({ error : err.message });
    }

    try {
        if (newCredentials.servicetype === 'conv') {
            await conversation.getTextClassifiers(newCredentials);
        }
        else if (newCredentials.servicetype === 'visrec') {
            await visualRecognition.getImageClassifiers(newCredentials);
        }
    }
    catch (err) {
        if (err.statusCode === httpstatus.UNAUTHORIZED ||
            err.statusCode === httpstatus.FORBIDDEN)
        {
            return res.status(httpstatus.BAD_REQUEST).json({ error : 'Watson credentials could not be verified' });
        }
        log.error({ err }, 'Failed to validate credentials');
        return errors.unknownError(res, err);
    }

    try {
        const credsObj = await store.storeBluemixCredentials(tenant, newCredentials);
        res.status(httpstatus.CREATED).json(
            credsObj.servicetype === 'visrec' ?
                returnVisualRecognitionCredentials(credsObj) :
                returnConversationCredentials(credsObj),
        );
    }
    catch (err) {
        log.error({ err }, 'Failed to add credentials');
        errors.unknownError(res, err);
    }
}





export default function registerApis(app: Express.Application) {
    app.get(urls.BLUEMIX_CREDENTIALS,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        auth.ensureUnmanaged,
        getCredentials);

    app.delete(urls.BLUEMIX_CREDENTIAL,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        auth.ensureUnmanaged,
        deleteCredentials);

    app.post(urls.BLUEMIX_CREDENTIALS,
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        auth.ensureUnmanaged,
        addCredentials);
}
