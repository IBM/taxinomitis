export interface RetrieveFromStorage {
    readonly type: 'retrieve';
    readonly spec: ObjectStorageSpec;
}
export interface ObjectStorageSpec {
    readonly objectid: string;
    readonly projectid: string;
    readonly userid: string;
    readonly classid: string;
}
export interface DownloadFromWeb {
    readonly type: 'download';
    readonly url: string;
    readonly imageid: string;
}

export type ImageDownload = RetrieveFromStorage | DownloadFromWeb;

export interface ImageStoreInfo {
    readonly credentials: ImageStoreCredentials;
    readonly bucketid: string;
}

export interface ImageStoreCredentials {
    readonly endpoint: string;
    readonly apiKeyId: string;
    readonly ibmAuthEndpoint: string;
    readonly serviceInstanceId: string;
}

export interface Image {
    readonly size: number;
    readonly body: string | Buffer;
    readonly modified?: string;
    readonly etag?: string;
    readonly filetype: ImageFileType;
}

export type ImageFileType = 'image/png' | 'image/jpg' | 'image/jpeg' | '';




export interface CreateZipParams {
    readonly locations: ImageDownload[];
    readonly imagestore: ImageStoreInfo;
}

export interface ResizeParams {
    readonly url: string;
}


export function isANonEmptyString(val: string): boolean {
    return val &&
           typeof val === 'string' &&
           val.length > 0;
}


function isAValidRetrieve(retrieveInfo: RetrieveFromStorage): boolean {
           // the spec is a non-null object
    return retrieveInfo &&
           typeof retrieveInfo === 'object' &&
           // the spec has a valid type
           retrieveInfo.type === 'retrieve' &&
           // the spec has valid storage properties
           retrieveInfo.spec &&
           typeof retrieveInfo.spec === 'object' &&
           isANonEmptyString(retrieveInfo.spec.objectid) &&
           isANonEmptyString(retrieveInfo.spec.projectid) &&
           isANonEmptyString(retrieveInfo.spec.userid) &&
           isANonEmptyString(retrieveInfo.spec.classid);
}


function isAValidDownload(downloadInfo: DownloadFromWeb): boolean {
           // the spec is a non-null object
    return downloadInfo &&
           typeof downloadInfo === 'object' &&
           // the spec has a valid type
           downloadInfo.type === 'download' &&
           // the spec has valid download properties
           isANonEmptyString(downloadInfo.imageid) &&
           isANonEmptyString(downloadInfo.url);
}


function isAValidImageLocation(location: ImageDownload): boolean {
           // the location is a non-null object
    return location &&
           typeof location === 'object' &&
           // has a type field
           (location.type === 'retrieve' || location.type === 'download') &&
           // has valid properties
           (isAValidRetrieve(location as RetrieveFromStorage) || isAValidDownload(location as DownloadFromWeb));
}


function isValidImageStore(imagestore: ImageStoreInfo): boolean {
           // the imagestore is a non-null object
    return imagestore &&
           typeof imagestore === 'object' &&
           // the image store has a bucket id
           isANonEmptyString(imagestore.bucketid) &&
           // the image store has a credentials object
           imagestore.credentials &&
           typeof imagestore.credentials === 'object' &&
           // the image store has all required attributes
           isANonEmptyString(imagestore.credentials.apiKeyId) &&
           isANonEmptyString(imagestore.credentials.endpoint) &&
           isANonEmptyString(imagestore.credentials.ibmAuthEndpoint) &&
           isANonEmptyString(imagestore.credentials.serviceInstanceId);
}





/**
 * Check that the parameters provided is safe to use.
 */
export function validate(params: CreateZipParams): boolean | undefined {
           // the params is a non-null object
    return params &&
           typeof params === 'object' &&
           // has a locations field
           params.locations &&
           Array.isArray(params.locations) &&
           // has at least one location
           params.locations.length > 0 &&
           // every location is valid
           params.locations.every(isAValidImageLocation) &&
           // has imagestore info
           isValidImageStore(params.imagestore);
}
