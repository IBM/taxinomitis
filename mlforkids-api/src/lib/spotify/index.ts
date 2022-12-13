// internal dependencies
import * as request from '../utils/request';
import * as constants from '../utils/constants';
import * as env from '../utils/env';
import loggerSetup from '../utils/logger';

const log = loggerSetup();


let spotifyAuthHeader: string;
let accessToken: string;
let accessTokenExpiry: number;



export function init() {
    const spotifyClientId: string | undefined = process.env[env.SPOTIFY_CLIENT_ID];
    const spotifyClientSecret: string | undefined = process.env[env.SPOTIFY_CLIENT_SECRET];
    if (spotifyClientId && spotifyClientSecret) {
        log.debug('preparing Spotify auth header');
        spotifyAuthHeader = 'Basic ' + Buffer.from(spotifyClientId + ':' + spotifyClientSecret).toString('base64');
    }
    else {
        log.debug('no Spotify credentials available');
    }
}

export async function getToken(): Promise<string>
{
    if (!spotifyAuthHeader) {
        throw new Error('Spotify module not initialized');
    }
    if (accessToken && Date.now() < accessTokenExpiry) {
        return Promise.resolve(accessToken);
    }

    accessToken = await getTokenFromSpotify();
    accessTokenExpiry = Date.now() + constants.FIFTY_MINUTES;
    return accessToken;
}


async function getTokenFromSpotify(): Promise<string> {
    const options = {
        method: 'POST',
        url: 'https://accounts.spotify.com/api/token',
        headers: { Authorization: spotifyAuthHeader },
        form: {
            grant_type: 'client_credentials'
        },
        json: true
    };
    const body = await request.post('https://accounts.spotify.com/api/token', options, true);
    return body.access_token;
}
