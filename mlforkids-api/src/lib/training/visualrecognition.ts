// local dependencies
import * as store from '../db/store';
import * as objectstore from '../objectstore';
import * as DbObjects from '../db/db-types';
import * as wikimedia from '../utils/wikimedia';
import * as downloader from '../utils/download';
import * as urlchecker from '../utils/urlchecker';
import loggerSetup from '../utils/logger';

const log = loggerSetup();


export const ERROR_MESSAGES = {
    INVALID_URL : 'Invalid URL for a test image'
};


/** The size of the largest file that we are willing to download for putting into a training zip. */
const MAX_IMAGE_FILE_SIZE_BYTES = 8388608;
export function getMaxImageFileSize(): number {
    return MAX_IMAGE_FILE_SIZE_BYTES;
}

//
// These dimensions are chosen because it's what the Visual Recognition service uses.
//  It will skew the aspect ratio of images that aren't already square - but that's
//  what the Visual Recognition service will do anyway.
// The benefit of doing the resizing locally (rather than uploading the images in their
//  original size and leaving the Visual Recognition service to resize it to these
//  dimensions) is that it dramatically reduces the disk overhead for running the
//  site. (Albeit at a increased cost in memory overhead)
//
/** The width that training files are resized to before putting into a training zip. */
export const IMAGE_WIDTH_PIXELS = 224;
/** The height that training files are resized to before putting into a training zip. */
export const IMAGE_HEIGHT_PIXELS = 224;




/**
 * Returns image data for a single training item, resized so that it is
 *  ready for use in training.
 *
 * @param project - student project
 * @param id  - id for the training item
 */
export async function getTrainingItemData(project: DbObjects.Project, id: string): Promise<Buffer> {
    // this will throw an exception if the id is not recognized
    const trainingitem = await store.getImageTrainingItem(project.id, id);
    if (trainingitem.isstored) {
        const trainingImage = await objectstore.getImage(getImageStoreSpec(project, trainingitem).spec);
        return downloader.resizeBuffer(trainingImage.body, IMAGE_WIDTH_PIXELS, IMAGE_HEIGHT_PIXELS);
    }
    else {
        const trainingImageInfo = await getImageDownloadSpec(id, trainingitem.imageurl);
        return downloader.resizeUrl(trainingImageInfo.url, IMAGE_WIDTH_PIXELS, IMAGE_HEIGHT_PIXELS)
            .catch((err) => {
                const errWithLocation: any = err as unknown;
                errWithLocation.location = trainingImageInfo;
                throw errWithLocation;
            });
    }
}


export type ImageDownload = RetrieveFromStorage | DownloadFromWeb;

interface RetrieveFromStorage {
    readonly type: 'retrieve';
    readonly spec: ObjectStorageSpec;
}
interface ObjectStorageSpec {
    readonly objectid: string;
    readonly projectid: string;
    readonly userid: string;
    readonly classid: string;
}
interface DownloadFromWeb {
    readonly type: 'download';
    readonly url: string;
    readonly imageid: string;
}

function getImageStoreSpec(project: DbObjects.Project, trainingitem: DbObjects.ImageTraining): RetrieveFromStorage {
    return {
        type : 'retrieve',
        spec : {
            objectid : trainingitem.id,
            projectid : project.id,
            userid : trainingitem.userid ? trainingitem.userid : project.userid,
            classid : project.classid,
        },
    };
}


export async function getImageDownloadSpec(imageid: string, imageurl: string): Promise<DownloadFromWeb> {
    if (wikimedia.isWikimedia(imageurl)) {
        try {
            const thumb = await wikimedia.getThumbnail(imageurl, 400);
            return {
                type : 'download',
                imageid,
                url : thumb,
            };
        }
        catch (err) {
            log.error({ err, imageid, imageurl }, 'getImageDownloadSpec fail');
            return {
                type : 'download',
                imageid,
                url : imageurl,
            };
        }
    }
    else {
        try {
            const fromWeb: DownloadFromWeb = {
                type : 'download',
                imageid,
                url : urlchecker.check(imageurl),
            };
            return Promise.resolve(fromWeb);
        }
        catch (err) {
            log.debug({ err, imageurl }, 'Invalid URL received');
            throw new Error(ERROR_MESSAGES.INVALID_URL);
        }
    }
}
