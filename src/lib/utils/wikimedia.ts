// core dependencies
import * as url from 'url';
// external dependencies
import * as request from 'request-promise';
// local dependencies
import loggerSetup from './logger';



const log = loggerSetup();



export const FAIL = 'Unable to find smaller version of image';


export function isWikimedia(imageurl: string): boolean {
    return !!imageurl &&
           imageurl.startsWith('https://upload.wikimedia.org/wikipedia/commons/');
}



/**
 * Returns the URL of a thumbnail version of the provided Wikimedia image URL.
 *
 * @param imageurl
 * @param width
 */
export async function getThumbnail(imageurl: string, width: number): Promise<string> {
    const imagename = getImageName(imageurl);
    const imageinfo = await getImageInfo(imagename, width);
    if (isExpectedImageInfo(imageinfo)) {
        const latestversion = getMostRecentVersion(imageinfo);
        const thumbnail = getThumbUrl(imageinfo, latestversion);
        log.debug({ imageurl, thumbnail, width }, 'Found smaller version');
        return thumbnail;
    }
    else {
        log.error({ imageurl, imagename, imageinfo }, 'Failed to get image info');
        throw new Error(FAIL);
    }
}



/**
 * Given a Wikimedia image URL
 * (e.g. https://upload.wikimedia.org/wikipedia/commons/d/dc/BrownSpiderMonkey_%28edit2%29.jpg )
 * it returns the image name
 * (e.g. BrownSpiderMonkey_%28edit2%29.jpg )
 */
function getImageName(imageurl: string): string {
    const imageAddress = new url.URL(imageurl);
    if (imageAddress && imageAddress.pathname) {
        const segments = imageAddress.pathname.split('/');
        if (imageurl.startsWith('https://upload.wikimedia.org/wikipedia/commons/thumb/')) {
            return segments[segments.length - 2];
        }
        else {
            return segments[segments.length - 1];
        }
    }
    log.error({ imageurl }, 'Unable to extract image name');
    throw new Error(FAIL);
}


async function getImageInfo(name: string, width: number): Promise<any> {
    // using query parameters in the URL, instead of a qs object, as the
    // name parameter is already URL-encoded so we'd have to URL-decode it
    // to be able to use it in qs
    const apiUrl = 'https://commons.wikimedia.org/w/api.php?' +
                   'action=query&' +
                   'titles=Image:' + name + '&' +
                   'prop=imageinfo&' +
                   'iiprop=url&' +
                   'iiurlwidth=' + width + '&' +
                   'format=json';
    const apiHeaders = {
        'User-Agent' : 'https://machinelearningforkids.co.uk',
        'Accept': 'application/json',
    };

    const options = {
        headers : apiHeaders,
        json : true,
    };

    const body = await request.get(apiUrl, options);
    return body;
}

function getMostRecentVersion(response: any): string {
    const versions = Object.keys(response.query.pages);
    if (versions.length === 1 && versions[0] === '-1') {
        log.error({ response }, 'Failed to find image info');
        throw new Error(FAIL);
    }
    return versions[versions.length - 1];
}

function getThumbUrl(response: any, version: string) {
    if (response.query.pages[version].imageinfo &&
        response.query.pages[version].imageinfo.length > 0 &&
        response.query.pages[version].imageinfo[0].thumburl)
    {
        return response.query.pages[version].imageinfo[0].thumburl;
    }
    log.error({ response, version }, 'Failed to get thumbnail from response');
}

function isExpectedImageInfo(response: any): boolean {
    return !!response &&
           response.query &&
           response.query.pages &&
           Object.keys(response.query.pages).length > 0;
}
