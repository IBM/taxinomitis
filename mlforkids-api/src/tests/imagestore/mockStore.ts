import type {
    PutObjectCommandInput,
    GetObjectCommandInput,
    DeleteObjectCommandInput,
    DeleteObjectsCommandInput,
    ListObjectsCommandInput, ListObjectsCommandOutput,
    CommonPrefix,
    _Object as S3Object,
} from 'ibm-cos-sdk-v2';
import * as randomstring from 'randomstring';
import * as assert from 'assert';
import { v4 as uuid } from 'uuid';


let bucketStructured: ClassStore = { };
let bucketFlat: ImageStore = { };
let etags: { [key: string]: string } = {};


function store(obj: PutObjectCommandInput) {
    const key = obj.Key as string;
    bucketFlat[key] = obj;

    const keyChunks = key.split('/');
    assert.strictEqual(keyChunks.length, 4);
    const classid = keyChunks[0];
    const userid = keyChunks[1];
    const projectid = keyChunks[2];
    const imageid = keyChunks[3];

    if (classid in bucketStructured === false) {
        bucketStructured[classid] = {};
    }
    if (userid in bucketStructured[classid] === false) {
        bucketStructured[classid][userid] = {};
    }
    if (projectid in bucketStructured[classid][userid] === false) {
        bucketStructured[classid][userid][projectid] = {};
    }

    bucketStructured[classid][userid][projectid][imageid] = obj;
}



function del(key: string) {
    const keyChunks = key.split('/');
    assert.strictEqual(keyChunks.length, 4);
    const classid = keyChunks[0];
    const userid = keyChunks[1];
    const projectid = keyChunks[2];
    const imageid = keyChunks[3];

    delete bucketFlat[key];

    if (bucketStructured[classid] &&
        bucketStructured[classid][userid] &&
        bucketStructured[classid][userid][projectid])
    {
        delete bucketStructured[classid][userid][projectid][imageid];
    }

    if (bucketStructured[classid] &&
        bucketStructured[classid][userid] &&
        bucketStructured[classid][userid][projectid] &&
        Object.keys(bucketStructured[classid][userid][projectid]).length === 0)
    {
        delete bucketStructured[classid][userid][projectid];
    }
    if (bucketStructured[classid] &&
        bucketStructured[classid][userid] &&
        Object.keys(bucketStructured[classid][userid]).length === 0)
    {
        delete bucketStructured[classid][userid];
    }
    if (bucketStructured[classid] &&
        Object.keys(bucketStructured[classid]).length === 0)
    {
        delete bucketStructured[classid];
    }
}



function listUsers(classid: string): ListObjectsCommandOutput
{
    let CommonPrefixes: CommonPrefix[] | undefined;

    if (bucketStructured[classid]) {
        CommonPrefixes = Object.keys(bucketStructured[classid])
                .map((userid) => {
                    return { Prefix : classid + '/' + userid + '/' };
                });
    }

    return {
        $metadata : {},
        IsTruncated : false,
        Marker : '',
        Contents : [],
        Name : 'BUCKETID',
        Prefix : classid + '/',
        Delimiter : '/',
        MaxKeys : 1000,
        CommonPrefixes,
    };
}


function listProjects(classid: string, userid: string): ListObjectsCommandOutput
{
    let CommonPrefixes: CommonPrefix[] | undefined;

    if (bucketStructured[classid] && bucketStructured[classid][userid]) {
        CommonPrefixes = Object.keys(bucketStructured[classid][userid])
                .map((imageid) => {
                    return { Prefix : classid + '/' + userid + '/' + imageid + '/' };
                });
    }

    return {
        $metadata : {},
        IsTruncated : false,
        Marker : '',
        Contents : [],
        Name : 'BUCKETID',
        Prefix : classid + '/' + userid + '/',
        Delimiter : '/',
        MaxKeys : 1000,
        CommonPrefixes,
    };
}


function listImages(
    classid: string,
    userid: string,
    projectid: string,
): ListObjectsCommandOutput
{
    let Contents: S3Object[] | undefined;

    if (bucketStructured[classid] &&
        bucketStructured[classid][userid] &&
        bucketStructured[classid][userid][projectid])
    {
        Contents = Object.keys(bucketStructured[classid][userid][projectid])
            .map((imageid) => {
                return bucketStructured[classid][userid][projectid][imageid];
            })
            .filter((image, idx) => {
                return idx < 3;
            })
            .map((image) => {
                const body = image.Body as Buffer;
                return {
                    Key : image.Key,
                    ETag : etags[image.Key as string],
                    Size : body.byteLength,
                    StorageClass : 'STANDARD',
                };
            });
    }


    return {
        $metadata : {},
        IsTruncated : false,
        Marker : '',
        Contents,
        Name : 'BUCKETID',
        Prefix : classid + '/' + userid + '/' + projectid + '/',
        Delimiter : '/',
        MaxKeys : 1000,
        CommonPrefixes : [],
    };
}



interface ClassStore { [key: string]: UserStore; }
interface UserStore { [key: string]: ProjectStore; }
interface ProjectStore { [key: string]: ImageStore; }
interface ImageStore { [key: string]: PutObjectCommandInput; }



export function reset() {
    bucketStructured = {};
    bucketFlat = {};
    etags = {};


    store({
        Bucket: 'BUCKETID',
        Key: 'INVALIDCLASS/INVALIDUSER/INVALIDPROJECT/MISSINGMETADATA',
        Body: Buffer.from('999'),
    });
    store({
        Bucket: 'BUCKETID',
        Key: 'INVALIDCLASS/INVALIDUSER/INVALIDPROJECT/INVALIDMETADATA',
        Body: Buffer.from('999'),
        Metadata: {},
    });
    store({
        Bucket: 'BUCKETID',
        Key: 'INVALIDCLASS/INVALIDUSER/INVALIDPROJECT/INVALIDIMAGETYPE',
        Body: Buffer.from('999'),
        Metadata: {
            filetype : 'mystery',
        },
    });
}


function generateETag() {
    return '"' + randomstring.generate({ length : 32 }) + '"';
}


function putObject(def: PutObjectCommandInput) {
    store(def);

    const ETag = generateETag();
    etags[def.Key as string] = ETag;

    return Promise.resolve({ ETag });
}

function getObject(def: GetObjectCommandInput) {
    const key = def.Key as string;
    if (key in bucketFlat) {
        const obj = bucketFlat[key];
        // a real S3 upload always ends up as bytes, whether the caller
        //  originally passed a Buffer or a string - normalise the same way
        //  here so the retrieved stream round-trips correctly
        const body = Buffer.isBuffer(obj.Body) ? obj.Body : Buffer.from(obj.Body as string, 'utf8');

        return Promise.resolve({
            AcceptRanges : 'bytes',
            LastModified : 'Fri, 22 Dec 2017 21:34:59 GMT' as unknown as Date,
            ContentLength : body.byteLength,
            ETag : etags[key],
            ContentType : 'application/octet-stream',
            Metadata : obj.Metadata,
            // mimics the v2 SDK's SdkStreamMixin, which is what the
            //  production code actually receives back from a real getObject
            Body : {
                transformToByteArray : () => Promise.resolve(new Uint8Array(body)),
            },
        });
    }
    else {
        const noSuchKey: any = new Error('The specified key does not exist.');
        noSuchKey.name = 'NoSuchKey';
        noSuchKey.code = 'NoSuchKey';
        noSuchKey.region = null;
        noSuchKey.time = new Date();
        noSuchKey.requestId = uuid();
        noSuchKey.extendedRequestId = undefined;
        noSuchKey.cfId = undefined;
        noSuchKey.$metadata = { httpStatusCode : 404 };
        noSuchKey.statusCode = 404;
        noSuchKey.retryable = false;
        noSuchKey.retryDelay = 32.288485034471435;
        return Promise.reject(noSuchKey);
    }
}

function deleteObject(def: DeleteObjectCommandInput) {
    const key = def.Key as string;
    del(key);

    delete etags[key];

    return Promise.resolve({});
}

function deleteObjects(def: DeleteObjectsCommandInput) {
    const objects = def.Delete && def.Delete.Objects ? def.Delete.Objects : [];
    const Deleted = objects.map((obj) => {
        const key = obj.Key as string;
        del(key);
        delete etags[key];
        return { Key : key };
    });
    return Promise.resolve({ Deleted });
}

function listObjects(def: ListObjectsCommandInput) {
    if (def.Prefix) {
        const chunks = def.Prefix.split('/');
        assert.strictEqual(chunks[chunks.length - 1], '');

        if (chunks.length === 4) {
            return Promise.resolve(listImages(
                chunks[0], chunks[1], chunks[2],
            ));
        }
        else if (chunks.length === 3) {
            return Promise.resolve(listProjects(
                chunks[0], chunks[1],
            ));
        }
        else if (chunks.length === 2) {
            return Promise.resolve(listUsers(
                chunks[0],
            ));
        }
    }
    else {
        // an unprefixed listing (e.g. the bucket-verification check on init)
        //  is a legitimate request against a real bucket - it just isn't
        //  exercised anywhere else in these tests, so an empty page is enough
        return Promise.resolve({
            $metadata : {},
            IsTruncated : false,
            Marker : '',
            Contents : [],
            Name : 'BUCKETID',
            Prefix : '',
            MaxKeys : def.MaxKeys,
            CommonPrefixes : [],
        });
    }
    return Promise.reject(new Error('Missing prefix'));
}


export const mockS3 = {
    send : (command: { constructor: { name: string }; input: unknown }) => {
        switch (command.constructor.name) {
            case 'PutObjectCommand':
                return putObject(command.input as PutObjectCommandInput);
            case 'GetObjectCommand':
                return getObject(command.input as GetObjectCommandInput);
            case 'DeleteObjectCommand':
                return deleteObject(command.input as DeleteObjectCommandInput);
            case 'DeleteObjectsCommand':
                return deleteObjects(command.input as DeleteObjectsCommandInput);
            case 'ListObjectsCommand':
                return listObjects(command.input as ListObjectsCommandInput);
            default:
                return Promise.reject(new Error('Unsupported command in mock S3 client: ' + command.constructor.name));
        }
    },
};
