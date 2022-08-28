// external dependencies
import * as IBMCosSDK from 'ibm-cos-sdk';
// local dependencies
import * as keys from './keys';
import * as deletes from './bulkdelete';
import * as config from './config';
import * as env from '../utils/env';
import loggerSetup from '../utils/logger';
// type definitions
import * as Types from './types';

const log = loggerSetup();


let cos: IBMCosSDK.S3;
let BUCKET: string;
let creds: object;



export function init(): void {
    const bucketString = process.env[env.OBJECT_STORE_BUCKET];
    if (bucketString) {
        BUCKET = bucketString;
    }
    else {
        log.debug('Missing OBJECT_STORE_BUCKET');
    }

    const credsString = process.env[env.OBJECT_STORE_CREDS];
    if (credsString) {
        try {
            creds = JSON.parse(credsString);
        }
        catch (err) {
            log.error({ err, credsString }, 'Invalid OBJECT_STORE_CREDS');
            throw new Error('Invalid OBJECT_STORE_CREDS');
        }
        cos = new IBMCosSDK.S3(creds);
    }
    else {
        log.debug('Missing OBJECT_STORE_CREDS');
    }

    if (BUCKET && creds) {
        verifyBucket();
    }
}

export function getCredentials() {
    return {
        bucketid : BUCKET,
        credentials : creds,
    };
}


export async function storeImage(
    spec: Types.ObjectSpec,
    type: Types.ImageFileType,
    contents: Buffer,
): Promise<string | undefined>
{
    verifyCosClient();

    const objectDefinition: IBMCosSDK.S3.PutObjectRequest = {
        Bucket: BUCKET,
        Key: keys.get(spec),
        Body: contents,
        Metadata : {
            filetype : type,
        },
    };
    const stored = await cos.putObject(objectDefinition).promise();
    return stored.ETag;
}

export async function storeSound(
    spec: Types.ObjectSpec,
    contents: number[],
): Promise<string | undefined>
{
    verifyCosClient();

    const objectDefinition: IBMCosSDK.S3.PutObjectRequest = {
        Bucket: BUCKET,
        Key: keys.get(spec),
        Body: contents.join(','),
    };
    const stored = await cos.putObject(objectDefinition).promise();
    return stored.ETag;
}



export async function getImage(spec: Types.ObjectSpec): Promise<Types.Image> {
    verifyCosClient();

    const objectDefinition: IBMCosSDK.S3.GetObjectRequest = {
        Bucket: BUCKET,
        Key: keys.get(spec),
    };

    const response = await cos.getObject(objectDefinition).promise();
    return getImageObject(objectDefinition.Key, response);
}

export async function getSound(spec: Types.ObjectSpec): Promise<Types.Sound> {
    verifyCosClient();

    const objectDefinition: IBMCosSDK.S3.GetObjectRequest = {
        Bucket: BUCKET,
        Key: keys.get(spec),
    };

    const response = await cos.getObject(objectDefinition).promise();
    return getSoundObject(objectDefinition.Key, response);
}





export async function deleteObject(spec: Types.ObjectSpec): Promise<void> {
    const objectDefinition: IBMCosSDK.S3.DeleteObjectRequest = {
        Bucket: BUCKET,
        Key: keys.get(spec),
    };
    await cos.deleteObject(objectDefinition).promise();
}

export function deleteProject(spec: Types.ProjectSpec): Promise<void> {
    return deletes.deleteProject(cos, BUCKET, spec);
}
export function deleteUser(spec: Types.UserSpec): Promise<void> {
    return deletes.deleteUser(cos, BUCKET, spec);
}
export function deleteClass(spec: Types.ClassSpec): Promise<void> {
    return deletes.deleteClass(cos, BUCKET, spec);
}



function verifyCosClient() {
    if (!cos) {
        throw new Error('Cloud object storage is currently unavailable for training data');
    }
}



function getImageType(key: string, response: IBMCosSDK.S3.GetObjectOutput): Types.ImageFileType {
    if (response.Metadata) {
        if (config.SUPPORTED_IMAGE_MIMETYPES.includes(response.Metadata.filetype)) {
            return response.Metadata.filetype as Types.ImageFileType;
        }
        else {
            log.error({ key, filetype: response.Metadata.filetype }, 'Invalid filetype metadata. Setting to empty');
            return '';
        }
    }
    else {
        log.error({ key }, 'Missing filetype metadata. Setting to empty');
        return '';
    }
}

function getImageObject(key: string, response: IBMCosSDK.S3.GetObjectOutput): Types.Image {
    return {
        size : response.ContentLength ? response.ContentLength : -1,
        body : response.Body as Buffer,
        modified : response.LastModified ? response.LastModified.toString() : '',
        etag : response.ETag,
        filetype : getImageType(key, response),
    };
}

function getSoundObject(key: string, response: IBMCosSDK.S3.GetObjectOutput): Types.Sound {
    return {
        size : response.ContentLength ? response.ContentLength : -1,
        body : getSoundData(response.Body as Buffer),
        modified : response.LastModified ? response.LastModified.toString() : '',
        etag : response.ETag,
    };
}


function getSoundData(raw: Buffer | undefined): number[] {
    if (raw) {
        return raw.toString().split(',').map((itemstr: string) => {
            return Number(itemstr);
        });
    }
    return [];
}



function verifyBucket(): void {
    const req: IBMCosSDK.S3.ListObjectsRequest = {
        Bucket: BUCKET,
        MaxKeys: 1,
    };

    cos.listObjects(req, (err: IBMCosSDK.AWSError/*, output: IBMCosSDK.S3.ListObjectsOutput*/) => {
        if (err) {
            log.error({ err }, 'Unable to query Object Storage');
            throw new Error('Failed to verify Object Store config : ' + err.message);
        }
    });
}

