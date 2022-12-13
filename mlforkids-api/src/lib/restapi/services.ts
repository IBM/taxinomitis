// external dependencies
import * as Express from 'express';
import * as cors from 'cors';
// local dependencies
import * as spotify from '../spotify';
import * as urls from './urls';
import * as errors from './errors';
import * as headers from './headers';
import loggerSetup from '../utils/logger';

const log = loggerSetup();



async function getSpotifyToken(req: Express.Request, res: Express.Response) {
    try {
        const token = await spotify.getToken();
        res.set(headers.CACHE_6MINUTES)
            .json({ token });
    }
    catch (err) {
        log.error({ err }, 'Failed to get spotify token');
        errors.unknownError(res, err);
    }
}


const CORS_CONFIG = {
    origin: /machinelearningforkids\.co\.uk$/,
};


export default function registerApis(app: Express.Application) {
    app.get(urls.SPOTIFY_TOKEN, cors(CORS_CONFIG), getSpotifyToken);
}