// external dependencies
import * as Express from 'express';



/**
 * Returns the two-letter code for the country that a request came from.
 *
 * Cloudflare adds a cf-ipcountry header to incoming requests, but it
 *  doesn't reach the app through the Cloudflare in front of Code Engine,
 *  so the edge worker copies it to an X-MLforKids-Country header.
 *
 * cf-ipcountry is kept as a fallback, in case requests don't come
 *  through the edge worker.
 */
export function getCountry(req: Express.Request): string | undefined {
    return req.header('X-MLforKids-Country') || req.header('cf-ipcountry');
}
