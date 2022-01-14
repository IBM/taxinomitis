/*eslint-env mocha */
import * as assert from 'assert';
import * as filecompare from 'filecompare';
import * as fs from 'fs';
import * as unzip from 'unzipper';
import * as tmp from 'tmp';
import * as async from 'async';

import * as downloadZip from '../../lib/utils/downloadAndZip';




describe('Utils - download and zip', () => {

    it('should reject non jpg/png files', (done) => {
        downloadZip.run(INVALIDURLS)
            .then(() => {
                done(new Error('Should not reach here'));
            })
            .catch((err) => {
                assert(err);
                done();
            });
    });

    it('should handle requests in parallel', () => {
        return Promise.all([
            downloadZip.run(TESTURLS),
            downloadZip.run(TESTURLS),
            downloadZip.run(TESTURLS),
            downloadZip.run(TESTURLS),
            downloadZip.run(TESTURLS),
        ]);
    });

    interface TestFile {
        readonly location: string;
        readonly size: number;
    }

    it('should download a jpg or png file', (done) => {
        async.waterfall([
            (next: (err?: Error, path?: string) => void) => {
                downloadZip.run(TESTURLS)
                    .then((path) => {
                        next(undefined, path);
                    })
                    .catch(next);
            },
            (zipfile: string, next: (err?: Error | null, path?: string, downloadedZip?: string) => void) => {
                tmp.dir({ keep : true }, (err, path) => {
                    next(err, path, zipfile);
                });
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
                assert.strictEqual(unzippedFilesInfo.length, 3);
                async.each(unzippedFilesInfo,
                    (unzippedFile: any, nextFile) => {
                        switch (unzippedFile.size) {
                        case 16384:
                            filecompare('./src/tests/utils/resources/map-0.jpg',
                                        unzippedFile.location,
                                        (isEq: boolean) => {
                                            assert(isEq, './src/tests/utils/resources/map-0.jpg');
                                            nextFile();
                                        });
                            break;
                        case 22955:
                            filecompare('./src/tests/utils/resources/map.jpg',
                                        unzippedFile.location,
                                        (isEq: boolean) => {
                                            assert(isEq, './src/tests/utils/resources/map.jpg');
                                            nextFile();
                                        });
                            break;
                        case 129708:
                            filecompare('./src/tests/utils/resources/map-1.png',
                                        unzippedFile.location,
                                        (isEq: boolean) => {
                                            assert(isEq, './src/tests/utils/resources/map-1.png');
                                            nextFile();
                                        });
                            break;
                        case 7519:
                            filecompare('./src/tests/utils/resources/watson.jpg',
                                        unzippedFile.location,
                                        (isEq: boolean) => {
                                            assert(isEq, './src/tests/utils/resources/watson.jpg');
                                            nextFile();
                                        });
                            break;
                        case 23966:
                            filecompare('./src/tests/utils/resources/watson-0.jpg',
                                        unzippedFile.location,
                                        (isEq: boolean) => {
                                            assert(isEq, './src/tests/utils/resources/watson-0.jpg');
                                            nextFile();
                                        });
                            break;
                        case 18438:
                            filecompare('./src/tests/utils/resources/ibm-2.png',
                                        unzippedFile.location,
                                        (isEq: boolean) => {
                                            assert(isEq, './src/tests/utils/resources/ibm-2.png');
                                            nextFile();
                                        });
                            break;
                        case 17830:
                            filecompare('./src/tests/utils/resources/ibm-0.png',
                                        unzippedFile.location,
                                        (isEq: boolean) => {
                                            assert(isEq, './src/tests/utils/resources/ibm-0.png');
                                            nextFile();
                                        });
                            break;
                        case 17928:
                            filecompare('./src/tests/utils/resources/ibm.png',
                                        unzippedFile.location,
                                        (isEq: boolean) => {
                                            assert(isEq, './src/tests/utils/resources/ibm.png');
                                            nextFile();
                                        });
                            break;
                        case 9328:
                            filecompare('./src/tests/utils/resources/ibm-1.png',
                                        unzippedFile.location,
                                        (isEq: boolean) => {
                                            assert(isEq, './src/tests/utils/resources/ibm-1.png');
                                            nextFile();
                                        });
                            break;
                        case 17401:
                            filecompare('./src/tests/utils/resources/ibm-3.png',
                                        unzippedFile.location,
                                        (isEq: boolean) => {
                                            assert(isEq, './src/tests/utils/resources/ibm-3.png');
                                            nextFile();
                                        });
                            break;
                        case 22724:
                            filecompare('./src/tests/utils/resources/map-2.jpg',
                                        unzippedFile.location,
                                        (isEq: boolean) => {
                                            assert(isEq, './src/tests/utils/resources/map-2.jpg');
                                            nextFile();
                                        });
                            break;
                        default:
                            assert.fail('Unexpected file size ' + unzippedFile.size + ' ' +
                                        unzippedFile.location);
                        }
                    },
                    next);
            },
        ], done);
    });

});









const TESTURLS: downloadZip.DownloadFromWeb[] = [
    {
        type: 'download',
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/IBM_logo.svg/320px-IBM_logo.svg.png',
        imageid : '1',
    },
    {
        type: 'download',
        // tslint:disable-next-line:max-line-length
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Thomas_J_Watson_Sr.jpg/148px-Thomas_J_Watson_Sr.jpg',
        imageid : '2',
    },
    {
        type: 'download',
        // tslint:disable-next-line:max-line-length
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Old_Map_Hursley_1607.jpg/218px-Old_Map_Hursley_1607.jpg?download',
        imageid : '3',
    },
];


const INVALIDURLS: downloadZip.DownloadFromWeb[] = [
    {
        type: 'download',
        url: 'https://www.w3.org/Graphics/SVG/svglogo.svg',
        imageid : '4',
    },
];
