// external dependencies
import {
    S3Client,
    PutObjectCommand, type PutObjectCommandInput,
    GetObjectCommand, type GetObjectCommandInput, type GetObjectCommandOutput,
    DeleteObjectCommand, type DeleteObjectCommandInput,
    ListObjectsCommand, type ListObjectsCommandInput,
} from 'ibm-cos-sdk-v2';
// local dependencies
import * as keys from './keys';
import * as deletes from './bulkdelete';
import * as config from './config';
import * as env from '../utils/env';
import loggerSetup from '../utils/logger';
// type definitions
import * as Types from './types';

const log = loggerSetup();

// the token endpoint stored in OBJECT_STORE_CREDS is the legacy Bluemix IAM
//  host, which the v2 SDK's token manager can't reach - the modern endpoint
//  is used instead regardless of what's in the stored credentials
const IAM_AUTH_ENDPOINT = 'https://iam.cloud.ibm.com/identity/token';

interface RawCosCreds {
    endpoint: string;
    apiKeyId: string;
    serviceInstanceId: string;
}


let cos: S3Client;
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
        let rawCreds: RawCosCreds;
        try {
            rawCreds = JSON.parse(credsString);
            creds = rawCreds;
        }
        catch (err) {
            log.error({ err, credsString }, 'Invalid OBJECT_STORE_CREDS');
            throw new Error('Invalid OBJECT_STORE_CREDS');
        }
        cos = new S3Client({
            endpoint : rawCreds.endpoint.startsWith('http') ? rawCreds.endpoint : `https://${rawCreds.endpoint}`,
            region : 'us-standard',
            credentials : {
                apiKey : rawCreds.apiKeyId,
                serviceInstanceId : rawCreds.serviceInstanceId,
                authEndpoint : IAM_AUTH_ENDPOINT,
                // unused by the IAM credential provider, but required by the
                //  AwsCredentialIdentity type that IbmAwsCredentialIdentity extends
                accessKeyId : '',
                secretAccessKey : '',
            },
        });
    }
    else {
        log.debug('Missing OBJECT_STORE_CREDS');
    }

    if (BUCKET && creds) {
        void verifyBucket();
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

    const objectDefinition: PutObjectCommandInput = {
        Bucket: BUCKET,
        Key: keys.get(spec),
        Body: contents,
        Metadata : {
            filetype : type,
        },
    };
    const stored = await cos.send(new PutObjectCommand(objectDefinition));
    return stored.ETag;
}

export async function storeSound(
    spec: Types.ObjectSpec,
    contents: number[],
): Promise<string | undefined>
{
    verifyCosClient();

    const objectDefinition: PutObjectCommandInput = {
        Bucket: BUCKET,
        Key: keys.get(spec),
        Body: contents.join(','),
    };
    const stored = await cos.send(new PutObjectCommand(objectDefinition));
    return stored.ETag;
}



export async function getImage(spec: Types.ObjectSpec): Promise<Types.Image> {
    verifyCosClient();

    const objectDefinition: GetObjectCommandInput = {
        Bucket: BUCKET,
        Key: keys.get(spec),
    };

    const response = await cos.send(new GetObjectCommand(objectDefinition));
    return await getImageObject(objectDefinition.Key as string, response);
}

export async function getSound(spec: Types.ObjectSpec): Promise<Types.Sound> {
    verifyCosClient();

    const objectDefinition: GetObjectCommandInput = {
        Bucket: BUCKET,
        Key: keys.get(spec),
    };

    const response = await cos.send(new GetObjectCommand(objectDefinition));
    return await getSoundObject(objectDefinition.Key as string, response);
}





export async function deleteObject(spec: Types.ObjectSpec): Promise<void> {
    const objectDefinition: DeleteObjectCommandInput = {
        Bucket: BUCKET,
        Key: keys.get(spec),
    };
    await cos.send(new DeleteObjectCommand(objectDefinition));
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



function getImageType(key: string, response: GetObjectCommandOutput): Types.ImageFileType {
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

async function getObjectBody(response: GetObjectCommandOutput): Promise<Buffer | undefined> {
    if (!response.Body) {
        return undefined;
    }
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
}

async function getImageObject(key: string, response: GetObjectCommandOutput): Promise<Types.Image> {
    return {
        size : response.ContentLength ? response.ContentLength : -1,
        body : await getObjectBody(response) as Buffer,
        modified : response.LastModified ? response.LastModified.toString() : '',
        etag : response.ETag,
        filetype : getImageType(key, response),
    };
}

async function getSoundObject(key: string, response: GetObjectCommandOutput): Promise<Types.Sound> {
    return {
        size : response.ContentLength ? response.ContentLength : -1,
        body : getSoundData(await getObjectBody(response)),
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



async function verifyBucket(): Promise<void> {
    const req: ListObjectsCommandInput = {
        Bucket: BUCKET,
        MaxKeys: 1,
    };

    try {
        await cos.send(new ListObjectsCommand(req));
    }
    catch (err) {
        log.error({ err }, 'Unable to query Object Storage');
        throw new Error('Failed to verify Object Store config : ' + (err as Error).message);
    }
}

