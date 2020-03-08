// external dependencies
import { v4 as uuid } from 'uuid';
// local dependencies
import * as env from '../utils/env';



const AUTH0_CLIENT_SECRET = process.env[env.AUTH0_CLIENT_SECRET] ?
                                process.env[env.AUTH0_CLIENT_SECRET] :
                                uuid();

const AUTH0_DOMAIN = process.env[env.AUTH0_DOMAIN] ?
                         process.env[env.AUTH0_DOMAIN] :
                         uuid();

const AUTH0_CUSTOM_DOMAIN = process.env[env.AUTH0_CUSTOM_DOMAIN] ?
                                process.env[env.AUTH0_CUSTOM_DOMAIN] :
                                uuid();

const AUTH0_AUDIENCE = process.env[env.AUTH0_AUDIENCE] ?
                           process.env[env.AUTH0_AUDIENCE] :
                           uuid();

const AUTH0_API_CLIENTID = process.env[env.AUTH0_API_CLIENTID] ?
                               process.env[env.AUTH0_API_CLIENTID] :
                               uuid();

const AUTH0_API_CLIENTSECRET = process.env[env.AUTH0_API_CLIENTSECRET] ?
                                   process.env[env.AUTH0_API_CLIENTSECRET] :
                                   uuid();


export const CLIENT_SECRET = AUTH0_CLIENT_SECRET;
export const DOMAIN = AUTH0_DOMAIN;
export const CUSTOM_DOMAIN = AUTH0_CUSTOM_DOMAIN;
export const AUDIENCE = AUTH0_AUDIENCE;
export const API_CLIENTID = AUTH0_API_CLIENTID;
export const API_CLIENTSECRET = AUTH0_API_CLIENTSECRET;
