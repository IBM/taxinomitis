// external dependencies
import * as Express from 'express';
import * as httpStatus from 'http-status';
// local dependencies
import * as auth from '../auth';
import * as store from '../../objectstore';
import * as db from '../../db/store';
import * as errors from '../errors';
import * as urls from '../urls';
import * as parse from './urlparse';
import loggerSetup from '../../utils/logger';
// type definitions
import * as StoreTypes from '../../objectstore/types';


const log = loggerSetup();



/**
 * Sets up API required to allow sound uploads.
 */
export default function registerApis(app: Express.Application) {

    // register route handler
    app.post(urls.SOUNDS,
             auth.authenticate,
             auth.checkValidUser,
             auth.verifyProjectAccess,
             // @ts-ignore
             handleUpload);
}




export const MAX_AUDIO_POINTS = 20000;



async function handleUpload(req: auth.RequestWithProject, res: Express.Response) {

    // make sure this is an images project before we proceed
    if (req.project.type !== 'sounds') {
        return res.status(httpStatus.BAD_REQUEST).json({
            error : 'Only sounds projects allow sound uploads',
        });
    }

    if (!req.body ||
        !req.body.label ||
        typeof req.body.label !== 'string' ||
        req.body.label.trim().length === 0)
    {
        return res.status(httpStatus.BAD_REQUEST).json({
            error : 'Audio label not provided',
        });
    }
    if (req.project.labels.includes(req.body.label) === false) {
        return res.status(httpStatus.BAD_REQUEST).json({
            error : 'Unrecognised label',
        });
    }

    if (!req.body.data || !Array.isArray(req.body.data)) {
        return errors.missingData(res);
    }

    if (req.body.data.length === 0) {
        return res.status(httpStatus.BAD_REQUEST).json({
            error : 'Empty audio is not allowed',
        });
    }

    if (req.body.data.length > MAX_AUDIO_POINTS) {
        return res.status(httpStatus.BAD_REQUEST).json({
            error : 'Audio exceeds maximum allowed length',
        });
    }

    const invalidAudio = req.body.data.some((item: number) => typeof item !== 'number' || isNaN(item));
    if (invalidAudio) {
        return res.status(httpStatus.BAD_REQUEST).json({
            error : 'Invalid audio input',
        });
    }


    let soundSpec: StoreTypes.ObjectSpec | undefined;
    let etag: string | undefined;

    try {
        soundSpec = parse.soundsUrl(req);
        const soundLabel = req.body.label.trim();

        etag = await store.storeSound(soundSpec, req.body.data);

        const training = await db.storeSoundTraining(
            soundSpec.projectid,
            parse.createSoundUrl(soundSpec),
            soundLabel,
            soundSpec.objectid);

        if (etag) {
            res.setHeader('ETag', etag);
        }

        res.status(httpStatus.CREATED).json(training);
    }
    catch (storeErr) {
        if (soundSpec && etag && storeErr &&
            storeErr.message === 'Project already has maximum allowed amount of training data')
        {
            // we've already stored the sound data in objectstorage, but
            //  we failed to store the info about the sound in the DB as
            //  the user has reached the project limit
            // so we need to delete the spectogram from sound data again
            //  (but we'll do that in the background rather than synchronously)
            removeStoredSound(soundSpec);

            return res.status(httpStatus.CONFLICT).json({
                error : 'Project already has maximum allowed amount of training data',
            });
        }

        log.error({ err : storeErr, projectid : req.project.id }, 'Store fail');
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            error : storeErr.message,
            details : storeErr,
        });
    }
}



function removeStoredSound(sound: StoreTypes.ObjectSpec): void {
    db.storeDeleteObjectJob(sound.classid, sound.userid, sound.projectid, sound.objectid)
        .catch((err) => {
            log.error({ err, sound }, 'Failed to clean-up sound');
        });
}
