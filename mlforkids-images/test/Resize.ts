/*eslint-env mocha */
import * as assert from 'assert';
import * as fs from 'fs';
import Resize from '../src/Resize';



describe('Resize function', () => {

    describe('Image downloads', () => {
        it('should work with png images', () => {
            // tslint:disable-next-line:max-line-length
            return runResize('https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/IBM_logo.svg/320px-IBM_logo.svg.png',
                            './test/resources/small-ibm-3.png',
                            11988);
        });

        it('should work with large png images', () => {
            return runResize('https://upload.wikimedia.org/wikipedia/commons/5/59/IBM_Rochester_X.png?download',
                            './test/resources/small-rochester.png',
                            149844);
        });


        it('should work with jpg images', () => {
            // tslint:disable-next-line:max-line-length
            return runResize('https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Thomas_J_Watson_Sr.jpg/148px-Thomas_J_Watson_Sr.jpg',
                            './test/resources/small-watson.png',
                            31956);
        });

        it('should work with large jpg images', () => {
            // tslint:disable-next-line:max-line-length
            return runResize('https://upload.wikimedia.org/wikipedia/commons/b/b3/Trees_and_clouds_with_a_hole%2C_Karawanks%2C_Slovenia.jpg?download',
                            './test/resources/small-cloud.png',
                            159424);
        });

        it('should work with huge jpg images', () => {
            // tslint:disable-next-line:max-line-length
            return runResize('https://upload.wikimedia.org/wikipedia/commons/c/c5/Noctilucent-clouds-msu-6817.jpg?download',
                            './test/resources/small-sea.png',
                            151056);
        });


        it('should work with gif images', () => {
            return runResize('https://upload.wikimedia.org/wikipedia/commons/3/39/IBM_Thinkpad_760ED.gif?download',
                            './test/resources/small-thinkpad-4.png',
                            112184);
        });
    });

    describe('Error handling', () => {

        it('should require a url parameter', () => {
            return checkError(undefined, { error : 'url is a required parameter' }, 400);
        });

        it('should require a non-empty url parameter', () => {
            return checkError('', { error : 'url is a required parameter' }, 400);
        });

        it.skip('should report that SVG files are not supported', () => {
            return checkError('https://upload.wikimedia.org/wikipedia/commons/5/51/IBM_logo.svg?download',
                              { error : 'Unsupported image file type' },
                              400);
        });

        it('should report internal server errors', () => {
            return checkError('https://upload.wikimedia.org/wikipedia/commons/f/f8/NGC_3372a-full.jpg?download',
                              { 'error' : 'Image size exceeds maximum limit', 'content-length' : '209780268' },
                              400);
        });

        it('should report that HTML files are not supported', () => {
            return checkError('https://en.wikipedia.org/wiki/IBM',
                              { error : 'Unsupported image file type' },
                              400);
        });

        it('should report that non-existent hosts cannot be found', () => {
            return checkError('http://this-is-not-actually-a-real-address.co.uk/testing.png',
                              { error : 'Unable to download image from this-is-not-actually-a-real-address.co.uk' },
                              400);
        });

        it('should report that non-existent files cannot be found', () => {
            return checkError('http://www.bbc.co.uk/not-actually-a-real-image.png',
                              { error : 'Unable to download image from www.bbc.co.uk' },
                              400);
        });

        it('should report auth errors', () => {
            return checkError('https://httpstat.us/401',
                              { error : 'httpstat.us would not allow "Machine Learning for Kids" to use that image' },
                              400);
        });

        it('should report forbidden errors', () => {
            return checkError('https://httpstat.us/403',
                              { error : 'httpstat.us would not allow "Machine Learning for Kids" to use that image' },
                              400);
        });

        it('should report internal server errors', () => {
            return checkError('https://httpstat.us/500',
                              { error : 'Unable to download image from httpstat.us' },
                              400);
        });
    });



    function runResize(url, fileToCompare, expectedSize) {
        return Resize({ url })
            .then((response) => {
                assert.strictEqual(response.statusCode, 200);
                assert.deepStrictEqual(response.headers, { 'Content-Type': 'image/png' });
                assert.deepStrictEqual(response.body.length, expectedSize);

                return checkFileContents(response.body, fileToCompare);
            });
    }

    function checkFileContents(contentsToCheck, filePath) {
        return fs.promises.readFile(filePath, 'base64')
            .then((fileContents) => {
                assert.strictEqual(Buffer.compare(Buffer.from(contentsToCheck, 'base64'),
                                                  Buffer.from(fileContents, 'base64')),
                                   0);
            });
    }

    function checkError(url, expectedErrorObj, expectedStatus) {
        return Resize({ url })
            .then((response) => {
                assert.strictEqual(response.statusCode, expectedStatus);
                assert.deepStrictEqual(response.body, expectedErrorObj);
            });
    }
});
