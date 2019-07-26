// external dependencies
import * as fs from 'fs';
import * as IBMCosSDK from 'ibm-cos-sdk';
// internal dependencies
import * as Requests from './Requests';


const SUPPORTED_IMAGE_MIMETYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
];


export default class ImageStore {
    bucketId: string;
    credentials: Requests.ImageStoreCredentials;
    cos: IBMCosSDK.S3;


    constructor(public connectioninfo: Requests.ImageStoreInfo) {
        this.bucketId = connectioninfo.bucketid;
        this.credentials = connectioninfo.credentials;
    }


    connect(): void {
        this.cos = new IBMCosSDK.S3(this.credentials);
    }


    /**
     * Download an image from cloud object storage
     *
     * @param imagespec - the ID of the image to download
     * @param targetFile - the location on disk to download it to
     */
    download(imagespec: Requests.ObjectStorageSpec, targetFile: string): Promise<void> {
        const objectDefinition: IBMCosSDK.S3.GetObjectRequest = {
            Bucket: this.bucketId,
            Key: this.generateKey(imagespec),
        };

        return this.cos.getObject(objectDefinition).promise()
            .then((response) => {
                return this.getImageObject(objectDefinition.Key, response);
            })
            .then((image) => {
                return fs.promises.writeFile(targetFile, image.body);
            });
    }


    generateKey(spec: Requests.ObjectStorageSpec): string {
        return [
            spec.classid,
            spec.userid,
            spec.projectid,
            spec.imageid,
        ].join('/');
    }


    getImageObject(key: string, response: IBMCosSDK.S3.GetObjectOutput): Requests.Image {
        return {
            size : response.ContentLength ? response.ContentLength : -1,
            body : response.Body as Buffer,
            modified : response.LastModified ? response.LastModified.toString() : '',
            etag : response.ETag,
            filetype : this.getImageType(key, response),
        };
    }


    getImageType(key: string, response: IBMCosSDK.S3.GetObjectOutput): Requests.ImageFileType {
        if (response.Metadata) {
            if (SUPPORTED_IMAGE_MIMETYPES.includes(response.Metadata.filetype)) {
                return response.Metadata.filetype as Requests.ImageFileType;
            }
            else {
                console.log('Invalid filetype metadata. Setting to empty. ', key, response.Metadata.filetype);
                return '';
            }
        }
        else {
            console.log('Missing filetype metadata. Setting to empty. ', key);
            return '';
        }
    }
}
