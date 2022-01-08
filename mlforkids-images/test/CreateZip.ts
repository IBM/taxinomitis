/*eslint-env mocha */
/* tslint:disable:no-console */
import * as assert from 'assert';
import * as fs from 'fs';
import * as async from 'async';
import * as tmp from 'tmp';
import * as unzip from 'unzipper';
import * as filecompare from 'filecompare';
import CreateZip from '../src/CreateZip';
import { CreateZipParams } from '../src/Requests';
import { HttpResponse } from '../src/Responses';
import * as Debug from '../src/Debug';



describe('Create image training zip function', () => {


    describe('Zip', () => {

        interface TestFile {
            readonly location: string;
            readonly size: number;
        }


        it('dale', () => {
            const wm = 'https://upload.wikimedia.org/wikipedia/commons/';
            const params: CreateZipParams = {
                locations : [
                    { type : 'download', imageid : '1',
                        url : wm + 'thumb/5/51/IBM_logo.svg/320px-IBM_logo.svg.png' },
                    { type : 'download', imageid : '2',
                        url : 'https://png.pngitem.com/pimgs/s/568-5688317_white-rectangle-outline-png-parallel-transparent-png.png' },
                    { type : 'download', imageid : '6',
                        url : wm + '3/39/IBM_Thinkpad_760ED.gif?download' },
                ],
                imagestore : {
                    bucketid : process.env.OBJECT_STORE_BUCKET,
                    credentials : JSON.parse(process.env.OBJECT_STORE_CREDS),
                },
            };

            return CreateZip(params)
                        .then((resp) => {
                            Debug.log('response', resp);
                        })
                        .catch((err) => {
                            console.error(err);
                            throw err;
                        });
        });


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
                        objectid: 'db759615-c4a7-4d40-a0d6-5bab30283753',
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
                        objectid: '2ce72fe7-3675-44b2-91fb-266bdb3c187c',
                    }},
                    { type : 'download', imageid : '6',
                        url : wm + '3/39/IBM_Thinkpad_760ED.gif?download' },
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
                                                 files?: (TestFile | undefined)[]) => void) => {
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
                            Debug.log('reviewing file', unzippedFile);
                            switch (unzippedFile.size) {
                            case 9328:
                                Debug.log('comparing small-ibm-2', unzippedFile);
                                filecompare('./test/resources/small-ibm-2.png',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                Debug.log('compared small-ibm-2', isEq);
                                                assert(isEq, './test/resources/small-ibm-2.png');
                                                nextFile();
                                            });
                                break;
                            case 112382:
                                Debug.log('comparing small-rochester', unzippedFile);
                                filecompare('./test/resources/small-rochester.png',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                Debug.log('compared small-rochester', isEq);
                                                assert(isEq, './test/resources/small-rochester.png');
                                                nextFile();
                                            });
                                break;
                            case 23966:
                                Debug.log('comparing small-watson', unzippedFile);
                                filecompare('./test/resources/small-watson.png',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                Debug.log('compared small-watson', isEq);
                                                assert(isEq, './test/resources/small-watson.png');
                                                nextFile();
                                            });
                                break;
                            case 119566:
                                Debug.log('comparing small-cloud', unzippedFile);
                                filecompare('./test/resources/small-cloud.png',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                Debug.log('compared small-cloud', isEq);
                                                assert(isEq, './test/resources/small-cloud.png');
                                                nextFile();
                                            });
                                break;
                            case 113290:
                                Debug.log('comparing small-sea', unzippedFile);
                                filecompare('./test/resources/small-sea.png',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                Debug.log('compared small-sea', isEq);
                                                assert(isEq, './test/resources/small-sea.png');
                                                nextFile();
                                            });
                                break;
                            case 75147:
                                Debug.log('comparing small-thinkpad', unzippedFile);
                                filecompare('./test/resources/small-thinkpad.png',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                Debug.log('compared small-thinkpad', isEq);
                                                assert(isEq, './test/resources/small-thinkpad.png');
                                                nextFile();
                                            });
                                break;
                            case 10810:
                                Debug.log('comparing small-dog', unzippedFile);
                                filecompare('./test/resources/small-dog.png',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                Debug.log('compared small-dog', isEq);
                                                assert(isEq, './test/resources/small-dog.png');
                                                nextFile();
                                            });
                                break;
                            case 6090:
                                Debug.log('comparing small-dog-2', unzippedFile);
                                filecompare('./test/resources/small-dog-2.png',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                Debug.log('compared small-dog-2', isEq);
                                                assert(isEq, './test/resources/small-dog-2.png');
                                                nextFile();
                                            });
                                break;
                            case 3418:
                                Debug.log('comparing test-circle', unzippedFile);
                                filecompare('./test/resources/test-circle.jpeg',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                Debug.log('compared test-circle.jpeg', isEq);
                                                assert(isEq, './test/resources/test-circle.jpeg');
                                                nextFile();
                                            });
                                break;
                            case 81920:
                                Debug.log('comparing small-thinkpad-2', unzippedFile);
                                filecompare('./test/resources/small-thinkpad-2.png',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                Debug.log('compared small-thinkpad-2', isEq);
                                                assert(isEq, './test/resources/small-thinkpad-2.png');
                                                nextFile();
                                            });
                                break;
                            case 84136:
                                Debug.log('comparing small-thinkpad-3', unzippedFile);
                                filecompare('./test/resources/small-thinkpad-3.png',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                Debug.log('compared small-thinkpad-3', isEq);
                                                assert(isEq, './test/resources/small-thinkpad-3.png');
                                                nextFile();
                                            });
                                break;
                            case 65536:
                                Debug.log('comparing small-thinkpad-4', unzippedFile);
                                filecompare('./test/resources/small-thinkpad-4.png',
                                            unzippedFile.location,
                                            (isEq: boolean) => {
                                                Debug.log('compared small-thinkpad-4', isEq);
                                                assert(isEq, './test/resources/small-thinkpad-4.png');
                                                nextFile();
                                            });
                                break;
                            default:
                                Debug.log('error!', unzippedFile);
                                assert.strictEqual(0, 1,
                                    'Unexpected file size ' + unzippedFile.size + ' ' +
                                    unzippedFile.location);
                                break;
                            }
                        },
                        next);
                },
            ], () => {
                Debug.log('complete');
                done();
            });
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
                    assert.strictEqual(resp.statusCode, 400);
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
                    assert.strictEqual(resp.statusCode, 400);
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
                    assert.strictEqual(resp.statusCode, 400);
                    assert.strictEqual(resp.body.error,
                                       'Unsupported image file type');
                });
        });


        it('should handle requests for authenticated Google images', () => {
            const params: CreateZipParams = {
                locations : [
                    { type : 'download', imageid : '1',
                        // tslint:disable-next-line:max-line-length
                        url : 'https://lh3.googleusercontent.com/2BgR7pTHkztneArHKFJC8PU2gJJjlQxbeREvdDfGRhy977XERW5INOPPATbkIwGk7LXMoSJJuHfaMKptAobG5Nftc4BC0mk0_PACy4-BhZlp20rr6iwflqDA9q9nFBSPlNGp8UG4YpZryiKGK4g4XARblMy6KV2zpHWHUUQfQzeThOTjNexgw5IGulkel-fQCZQhxORPAHmHQPleRSlGxTZhQo0vrg1O5K33UUZ5bYa8_fwCAsYPg_UoRK3UZQdNrmQEFDqC1WtbSAnlYn8OX_WrJ4l1Fj-Tn4UXoNI7AEunfAZEQZYnB5oiFewnWfltg4gorz__xDizUGaifusPd3mE1nwoT24gKB9zjmA-jXKnMTxsVPvzouFiOGWwMHDnw6NuIrCr-rsfhD-vYNBB8BejcxjUrRf0XfA4iDBW6pgIICrkjaHWxIu5dOUzVIqJcWhzoBNBIAmJ3cP6VqMDWK4mKpU5IQRhRnPEX3mpqEQW3hovFkJTFk6JdZ7YZrgamF9CaUkQ6Er2Sg90Ua1XgoXWYWJk1mEI1Um-VaodCIg9vHr7zUKRQgnPzDi9MmeYQnZTIJUhWN5MKLUKXfCrF96KqXz6lFsG4ghPG1Kq1pF8td1ohGqjunIMhWyRWxrFBDeTTVPJXjpACOC8RTDX_Xvw7uJJ3Cwl=w649-h486-no' },
                ],
                imagestore : {
                    bucketid : process.env.OBJECT_STORE_BUCKET,
                    credentials : JSON.parse(process.env.OBJECT_STORE_CREDS),
                },
            };

            return CreateZip(params)
                .then((resp) => {
                    assert.strictEqual(resp.statusCode, 400);
                    assert.strictEqual(resp.body.error,
                                       'Google would not allow "Machine Learning for Kids" to use that image');
                    assert.deepStrictEqual(resp.body.location, params.locations[0]);
                });
        });
    });



    describe('Cloud object storage', () => {

        it('should handle failure to access COS', () => {
            const params: CreateZipParams = {
                locations : [
                    { type : 'retrieve', spec : {
                        classid : 'myclass',
                        objectid : 'myimage',
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
