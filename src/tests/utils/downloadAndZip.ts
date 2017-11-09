/*eslint-env mocha */
import * as assert from 'assert';
import * as filecompare from 'filecompare';
import * as fs from 'fs';
import * as unzip from 'unzip';
import * as tmp from 'tmp';
import * as async from 'async';

import * as downloadZip from '../../lib/utils/downloadAndZip';




describe('Utils - base64decode', () => {

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


    it('should decode a jpg file', (done) => {
        async.waterfall([
            (next) => {
                downloadZip.run(TESTURLS)
                    .then((path) => {
                        next(null, path);
                    })
                    .catch(next);
            },
            (zipfile, next) => {
                tmp.dir({ keep : true }, (err, path) => {
                    next(err, path, zipfile);
                });
            },
            (unzipTarget, zipFile, next) => {
                const unzippedFiles = [];

                fs.createReadStream(zipFile)
                    .pipe(unzip.Parse())
                    .on('entry', (entry) => {
                        const target = unzipTarget + '/' + entry.path;
                        unzippedFiles.push(target);
                        entry.pipe(fs.createWriteStream(target));
                    })
                    .on('close', (err?: Error) => {
                        next(err, unzippedFiles);
                    });
            },
            (unzippedFiles: string[], next) => {
                async.map(unzippedFiles, (unzippedFile, nextFile) => {
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
            (unzippedFilesInfo, next) => {
                assert.equal(unzippedFilesInfo.length, 3);
                async.each(unzippedFilesInfo,
                    (unzippedFile: any, nextFile) => {
                        switch (unzippedFile.size) {
                        case 21450:
                            filecompare('./src/tests/utils/resources/map.jpg',
                                        unzippedFile.location,
                                        (isEq: boolean) => {
                                            assert(isEq);
                                            nextFile();
                                        });
                            break;
                        case 4518:
                            filecompare('./src/tests/utils/resources/watson.jpg',
                                        unzippedFile.location,
                                        (isEq: boolean) => {
                                            assert(isEq);
                                            nextFile();
                                        });
                            break;
                        case 1915:
                            filecompare('./src/tests/utils/resources/ibm.png',
                                        unzippedFile.location,
                                        (isEq: boolean) => {
                                            assert(isEq);
                                            nextFile();
                                        });
                            break;
                        default:
                            assert.fail(0, 1, 'Unexpected file size ' + unzippedFile.size);
                            break;
                        }
                    },
                    next);
            },
        ], done);
    });

});









const TESTURLS: string[] = [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/IBM_logo.svg/220px-IBM_logo.svg.png?download',
    // tslint:disable-next-line:max-line-length
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Thomas_J_Watson_Sr.jpg/148px-Thomas_J_Watson_Sr.jpg?download',
    // tslint:disable-next-line:max-line-length
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Old_Map_Hursley_1607.jpg/218px-Old_Map_Hursley_1607.jpg?download',
];


const INVALIDURLS: string[] = [
    // tslint:disable-next-line:max-line-length
    'https://www.w3.org/Graphics/SVG/svglogo.svg',
];
