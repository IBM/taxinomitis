// external dependencies
import * as fs from 'fs';
import * as IBMCosSDK from 'ibm-cos-sdk';
import * as tmp from 'tmp';
import * as gm from 'gm';
// internal dependencies
import * as Requests from './Requests';
import { log } from './Debug';


const SUPPORTED_IMAGE_MIMETYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
];


export default class ImageStore {
    private bucketId: string;
    private credentials: Requests.ImageStoreCredentials;

    private cos: IBMCosSDK.S3;


    constructor(public connectioninfo: Requests.ImageStoreInfo) {
        this.bucketId = connectioninfo.bucketid;
        this.credentials = connectioninfo.credentials;
    }


    public connect(): void {
        try {
            this.cos = new IBMCosSDK.S3(this.credentials);
        }
        catch (err) {
            log('imagestore connect', err);
            throw err;
        }
    }



    /**
     * Download an image from cloud object storage
     *
     * @param imagespec - the ID of the image to download
     * @param targetFile - the location on disk to download it to
     */
    public download(imagespec: Requests.ObjectStorageSpec, targetFile: string): Promise<void> {
        const objectDefinition: IBMCosSDK.S3.GetObjectRequest = {
            Bucket: this.bucketId,
            Key: this.generateKey(imagespec),
        };

        let tempFile: string;

        return this.getTmpFileLocation()
            .then((location) => {
                tempFile = location;
                return this.cos.getObject(objectDefinition).promise();
            })
            .then((response) => {
                return this.getImageObject(objectDefinition.Key, response);
            })
            .then((image) => {
                return fs.promises.writeFile(tempFile, image.body);
            })
            .then(() => {
                return this.resizeImage(tempFile, targetFile);
            })
            .catch((err) => {
                let cause;
                log('Failed to download image from store', imagespec, this.generateKey(imagespec), objectDefinition);
                if (err.message.indexOf('Missing credentials in config') >= 0) {
                    cause = 'auth';
                }
                else {
                    log('imagestore download', err);
                    cause = 'unknown';
                }
                throw new Error('Unable to download image from store (' + cause + ')');
            });
    }


    private getTmpFileLocation(): Promise<string> {
        return new Promise((resolve, reject) => {
            tmp.file((err, location) => {
                if (err) {
                    return reject(err);
                }
                return resolve(location);
            });
        });
    }

    private resizeImage(src: string, dest: string): Promise<void> {
        // imagemagick option
        const IGNORE_ASPECT_RATIO = '!';

        return new Promise((resolve, reject) => {
            gm(src)
                .resize(224, 224, IGNORE_ASPECT_RATIO)
                .write(dest, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
        });
    }

    private generateKey(spec: Requests.ObjectStorageSpec): string {
        const key = [
            spec.classid,
            spec.userid,
            spec.projectid,
            spec.objectid,
        ].join('/');
        // log('key', key);
        return key;
    }


    private getImageObject(key: string, response: IBMCosSDK.S3.GetObjectOutput): Requests.Image {
        return {
            size : response.ContentLength ? response.ContentLength : -1,
            body : response.Body as Buffer,
            modified : response.LastModified ? response.LastModified.toString() : '',
            etag : response.ETag,
            filetype : this.getImageType(key, response),
        };
    }


    private getImageType(key: string, response: IBMCosSDK.S3.GetObjectOutput): Requests.ImageFileType {
        if (response.Metadata) {
            if (SUPPORTED_IMAGE_MIMETYPES.includes(response.Metadata.filetype)) {
                return response.Metadata.filetype as Requests.ImageFileType;
            }
            else {
                log('Invalid filetype metadata. Setting to empty. ', key, response.Metadata.filetype);
                return '';
            }
        }
        else {
            log('Missing filetype metadata. Setting to empty. ', key);
            return '';
        }
    }
}
