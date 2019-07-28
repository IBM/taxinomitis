/*eslint-env mocha */
/* tslint:disable:no-console */
import * as assert from 'assert';
import * as fs from 'fs';
import * as async from 'async';
import * as tmp from 'tmp';
import * as unzip from 'unzip2';
import * as filecompare from 'filecompare';
import CreateZip from '../src/CreateZip';
import { CreateZipParams } from '../src/Requests';
import { HttpResponse } from '../src/Responses';



describe('Create image training zip function', () => {


    describe('Zip', () => {

        interface TestFile {
            readonly location: string;
            readonly size: number;
        }


        it('should create a zip of downloaded and retrieved images', (done) => {
            const wm = 'https://upload.wikimedia.org/wikipedia/commons/';
            const params: CreateZipParams = {
                locations : [
                    { type : 'download', imageid : '1',
                        url : wm + 'thumb/5/51/IBM_logo.svg/320px-IBM_logo.svg.png' },
                    { type : 'download', imageid : '2',
                        url : wm + '5/59/IBM_Rochester_X.png?download' },
                    { type: 'retrieve', spec : {
                        classid: 'banana',
                        userid: 'auth0|5b296bce04e0e30bf72a6f0c',
                        projectid: 'f905f940-a4cd-11e9-b9e1-c157290d5ed7',
                        imageid: 'db680cbe-f45d-4813-b94e-aa6c49b2d529',
                    }},
                    { type : 'download', imageid : '3',
                        url : wm + 'thumb/7/7e/Thomas_J_Watson_Sr.jpg/148px-Thomas_J_Watson_Sr.jpg' },
                    { type : 'download', imageid : '4',
                        url : wm + 'b/b3/Trees_and_clouds_with_a_hole%2C_Karawanks%2C_Slovenia.jpg?download' },
                    { type : 'download', imageid : '5',
                        url : wm + 'c/c5/Noctilucent-clouds-msu-6817.jpg?download' },
                    { type: 'retrieve', spec : {
                        classid: 'banana',
                        userid: 'auth0|5b296bce04e0e30bf72a6f0c',
                        projectid: 'ea7409e0-a59a-11e8-9360-b17a0413da8c',
                        imageid: '2ce72fe7-3675-44b2-91fb-266bdb3c187c',
                    }},
                    { type : 'download', imageid : '6',
                        url : wm + 'd/df/IBMThinkpad760ED.gif?download' },
                ],
                imagestore : {
                    bucketid : process.env.OBJECT_STORE_BUCKET,
                    credentials : JSON.parse(process.env.OBJECT_STORE_CREDS),
                },
            };


            async.waterfall([
                (next: (err?: Error, unzipdir?: string, zipfile?: string) => void) => {
                    tmp.dir({}, (direrr, targetdir) => {
                        tmp.file({ postfix : '.zip' }, (fileerr, zippath) => {
                            next(direrr || fileerr, targetdir, zippath);
                        });
                    });
                },
                (unzipdir: string, zippath: string, next: (err?: Error, zipdir?: string, zippath?: string) => void) => {
                    return CreateZip(params)
                        .then((resp) => {
                            assert.strictEqual(resp.statusCode, 200);
                            fs.writeFile(zippath, resp.body, 'base64', (fserr) => {
                                next(fserr, unzipdir, zippath);
                            });
                        })
                        .catch(next);
                },
                (unzipTarget: string, zipFile: string, next: (err?: Error, files?: string[]) => void) => {
                    const unzippedFiles: string[] = [];
                    fs.createReadStream(zipFile)
                        .pipe(unzip.Parse())
                        .on('entry', (entry: any) => {
                            const target = unzipTarget + '/' + entry.path;
                            unzippedFiles.push(target);
                            entry.pipe(fs.createWriteStream(target));
                        })
                        .on('close', (err?: Error) => {
                            next(err, unzippedFiles);
                        });
                },
                (unzippedFiles: string[], next: (err?: Error | undefined | null,
                                                 files?: Array<TestFile | undefined>) => void) => {
                    async.map(unzippedFiles,
                                (unzippedFile: string, nextFile: (err?: Error | null, file?: TestFile) => void) =>
                                {
                                    fs.stat(unzippedFile, (err, stats) => {
                                        if (err) {
                                            return nextFile(err);
                                        }
                                        nextFile(err, {
                                            location : unzippedFile,
                                            size : stats.size,
                                        });
                                    });
                                }, next);
                },
                (unzippedFilesInfo: TestFile[], next: () => void) => {
                    assert.strictEqual(unzippedFilesInfo.length, 8);
                    async.each(unzippedFilesInfo,
                        (unzippedFile: any, nextFile) => {
                            switch (unzippedFile.size) {
                            case 9189:
                                filecompare('./test/resources/small-ibm.png',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                assert(isEq, './test/resources/small-ibm.png');
                                                nextFile();
                                            });
                                break;
                            case 112382:
                                filecompare('./test/resources/small-rochester.png',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                assert(isEq, './test/resources/small-rochester.png');
                                                nextFile();
                                            });
                                break;
                            case 23966:
                                filecompare('./test/resources/small-watson.png',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                assert(isEq, './test/resources/small-watson.png');
                                                nextFile();
                                            });
                                break;
                            case 119566:
                                filecompare('./test/resources/small-cloud.png',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                assert(isEq, './test/resources/small-cloud.png');
                                                nextFile();
                                            });
                                break;
                            case 113290:
                                filecompare('./test/resources/small-sea.png',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                assert(isEq, './test/resources/small-sea.png');
                                                nextFile();
                                            });
                                break;
                            case 75147:
                                filecompare('./test/resources/small-thinkpad.png',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                assert(isEq, './test/resources/small-thinkpad.png');
                                                nextFile();
                                            });
                                break;
                            case 10810:
                                filecompare('./test/resources/small-dog.png',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                assert(isEq, './test/resources/small-dog.png');
                                                nextFile();
                                            });
                                break;
                            case 13631:
                                filecompare('./test/resources/test-circle.jpeg',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                assert(isEq, './test/resources/test-circle.jpeg');
                                                nextFile();
                                            });
                                break;
                            default:
                                console.log(unzippedFile);
                                assert.fail(0, 1, 'Unexpected file size ' + unzippedFile.size + ' ' +
                                                    unzippedFile.location);
                                break;
                            }
                        },
                        next);
                },
            ], done);
        });

        it('should handle failures to download images', () => {
            const wm = 'https://upload.wikimedia.org/wikipedia/commons/';
            const params: CreateZipParams = {
                locations : [
                    { type : 'download', imageid : '1',
                        url : wm + 'thumb/5/51/IBM_logo.svg/320px-IBM_logo.svg.png' },
                    { type : 'download', imageid : '2',
                        url : wm + '5/59/IBM_Rochester_X.png?download' },
                    { type : 'download', imageid : '3',
                        url : wm + 'thumb/7/7e/Thomas_J_Watson_Sr.jpg/148px-Thomas_J_Watson_Sr.jpg' },
                    { type : 'download', imageid : 'XXX',
                        url : wm + 'THIS-DOES-NOT-ACTUALLY-EXIST' },
                    { type : 'download', imageid : '4',
                        url : wm + 'b/b3/Trees_and_clouds_with_a_hole%2C_Karawanks%2C_Slovenia.jpg?download' },
                    { type : 'download', imageid : '5',
                        url : wm + 'c/c5/Noctilucent-clouds-msu-6817.jpg?download' },
                    { type : 'download', imageid : '6',
                        url : wm + 'd/df/IBMThinkpad760ED.gif?download' },
                ],
                imagestore : {
                    bucketid : process.env.OBJECT_STORE_BUCKET,
                    credentials : JSON.parse(process.env.OBJECT_STORE_CREDS),
                },
            };

            return CreateZip(params)
                .then((resp) => {
                    assert.strictEqual(resp.statusCode, 500);
                    assert.strictEqual(resp.body.error, 'Unable to download image from upload.wikimedia.org');
                });
        });


        it('should handle requests to include images from non-existent hosts', () => {
            const params: CreateZipParams = {
                locations : [
                    { type : 'download', imageid : '1',
                        url : 'http://this-website-does-not-actually-exist.co.uk/image.jpg' },
                ],
                imagestore : {
                    bucketid : process.env.OBJECT_STORE_BUCKET,
                    credentials : JSON.parse(process.env.OBJECT_STORE_CREDS),
                },
            };

            return CreateZip(params)
                .then((resp) => {
                    assert.strictEqual(resp.statusCode, 500);
                    assert.strictEqual(resp.body.error,
                                       'Unable to download image from this-website-does-not-actually-exist.co.uk');
                    assert.deepStrictEqual(resp.body.location, params.locations[0]);
                });
        });


        it('should handle requests to include unsupported image types', () => {
            const params: CreateZipParams = {
                locations : [
                    { type : 'download', imageid : '1',
                        url : 'https://upload.wikimedia.org/wikipedia/commons/5/51/IBM_logo.svg?download' },
                ],
                imagestore : {
                    bucketid : process.env.OBJECT_STORE_BUCKET,
                    credentials : JSON.parse(process.env.OBJECT_STORE_CREDS),
                },
            };

            return CreateZip(params)
                .then((resp) => {
                    assert.strictEqual(resp.statusCode, 500);
                    assert.strictEqual(resp.body.error,
                                       'Unsupported image file type');
                });
        });
    });



    describe('Cloud object storage', () => {

        it('should handle failure to access COS', () => {
            const params: CreateZipParams = {
                locations : [
                    { type : 'retrieve', spec : {
                        classid : 'myclass',
                        imageid : 'myimage',
                        projectid : 'myproject',
                        userid : 'myuser',
                    }},
                ],
                imagestore : {
                    bucketid : 'a',
                    credentials : {
                        apiKeyId : 'a',
                        endpoint : 'b',
                        ibmAuthEndpoint : 'c',
                        serviceInstanceId : 'd',
                    },
                },
            };
            return CreateZip(params)
                .then((resp) => {
                    assert.strictEqual(resp.statusCode, 500);
                    assert.strictEqual(resp.body.error, 'Unable to download image from store (auth)');
                });
        });
    });


    describe('Input parameter checking', () => {

        const INVALID_INPUTS = [
            undefined,
            null,
            [],
            'hello',
            { },
            {
                locations : [
                    { imageid : '1', type : 'download', url : 'hello' },
                ],
            },
            {
                imagestore : {
                    bucketid : 'a',
                    credentials : {
                        apiKeyId : 'a',
                        endpoint : 'b',
                        ibmAuthEndpoint : 'c',
                        serviceInstanceId : 'd',
                    },
                },
            },
            {
                locations : [],
                imagestore : {
                    bucketid : 'a',
                    credentials : {
                        apiKeyId : 'a',
                        endpoint : 'b',
                        ibmAuthEndpoint : 'c',
                        serviceInstanceId : 'd',
                    },
                },
            },
            {
                locations : [
                    { imageid : '1', type : 'invalid', url : 'hello' },
                ],
                imagestore : {
                    bucketid : 'a',
                    credentials : {
                        apiKeyId : 'a',
                        endpoint : 'b',
                        ibmAuthEndpoint : 'c',
                        serviceInstanceId : 'd',
                    },
                },
            },
            {
                locations : [
                    { imageid : '1', type : 'download' },
                ],
                imagestore : {
                    bucketid : 'a',
                    credentials : {
                        apiKeyId : 'a',
                        endpoint : 'b',
                        ibmAuthEndpoint : 'c',
                        serviceInstanceId : 'd',
                    },
                },
            },
            {
                locations : [
                    { imageid : '1', type : 'retrieve', projectid : 'a' },
                ],
                imagestore : {
                    bucketid : 'a',
                    credentials : {
                        apiKeyId : 'a',
                        endpoint : 'b',
                        ibmAuthEndpoint : 'c',
                        serviceInstanceId : 'd',
                    },
                },
            },
        ] as unknown as CreateZipParams[];

        function isExpectedResponse(resp: HttpResponse): boolean {
            return resp.body.error === 'Invalid request payload' &&
                    resp.statusCode === 400;
        }



        it('should reject missing or invalid input', () => {
            const promises = INVALID_INPUTS.map((input) => {
                return CreateZip(input);
            });

            return Promise.all(promises)
                .then((resp: HttpResponse[]) => {
                    assert(resp.every(isExpectedResponse));
                });
        });
    });
});
