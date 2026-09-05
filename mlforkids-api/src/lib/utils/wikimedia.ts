// core dependencies
import * as url from 'url';
// local dependencies
import loggerSetup from './logger';



const log = loggerSetup();



export const FAIL = 'Unable to find smaller version of image';


export function isWikimedia(imageurl: string): boolean {
    return !!imageurl &&
           (imageurl.startsWith('https://upload.wikimedia.org/wikipedia/commons/') ||
            imageurl.startsWith('https://thumb.wikimedia.org/wikipedia/commons/'));
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
        if (imageurl.startsWith('https://upload.wikimedia.org/wikipedia/commons/thumb/') ||
            imageurl.startsWith('https://thumb.wikimedia.org/wikipedia/commons/thumb/')) {
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

    const response = await fetch(apiUrl, {
        headers: apiHeaders,
    });

    if (!response.ok) {
        log.error({ status : response.status }, 'HTTP error');
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
}

function getMostRecentVersion(response: any): string {
    const versions = Object.keys(response.query.pages);
    if (versions.length === 1 && versions[0] === '-1') {
        log.error({ response }, 'Failed to find image info');
        throw new Error(FAIL);
    }
    return versions[versions.length - 1];
}

function getThumbUrl(response: any, version: string): string {
    if (response.query.pages[version].imageinfo &&
        response.query.pages[version].imageinfo.length > 0 &&
        response.query.pages[version].imageinfo[0].thumburl)
    {
        return removeTrackingParameters(response.query.pages[version].imageinfo[0].thumburl);
    }
    // this used to fall off the end and return undefined, which getThumbnail
    //  would then hand back as if it were a string. Throwing matches how the
    //  rest of this module reports not being able to find a smaller image, and
    //  callers already fall back to the full-size URL when it happens.
    log.error({ response, version }, 'Failed to get thumbnail from response');
    throw new Error(FAIL);
}


/**
 * Wikimedia appends its own analytics parameters to the thumbnail URLs it
 *  returns, e.g.
 *    ...250px-Narval.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail
 *
 * They are not needed to fetch the image, and they make the URL we hand back
 *  depend on Wikimedia's analytics choices rather than on the image itself, so
 *  they are removed.
 *
 * Only utm_* parameters are dropped. Anything else is left alone, in case a
 *  thumbnail URL ever genuinely needs a query parameter to resolve.
 */
function removeTrackingParameters(thumburl: string): string {
    try {
        const parsed = new url.URL(thumburl);
        for (const param of Array.from(parsed.searchParams.keys())) {
            if (param.startsWith('utm_')) {
                parsed.searchParams.delete(param);
            }
        }
        return parsed.toString();
    }
    catch (err) {
        // not worth failing the whole lookup over - the URL works either way
        log.error({ err, thumburl }, 'Unable to parse thumbnail url to remove tracking parameters');
        return thumburl;
    }
}

function isExpectedImageInfo(response: any): boolean {
    return !!response &&
           response.query &&
           response.query.pages &&
           Object.keys(response.query.pages).length > 0;
}
