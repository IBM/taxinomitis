/*eslint-env mocha */
import * as assert from 'assert';
import * as imageCheck from '../../lib/utils/imageCheck';




describe('Utils - imageCheck', () => {

    it('should handle multiple requests in parallel', () => {
        return Promise.all([
            imageCheck.verifyImage(VALID_JPG, 10000000), imageCheck.verifyImage(VALID_PNG, 10000000),
            imageCheck.verifyImage(VALID_JPG, 10000000), imageCheck.verifyImage(VALID_PNG, 10000000),
            imageCheck.verifyImage(VALID_JPG, 10000000), imageCheck.verifyImage(VALID_PNG, 10000000),
            imageCheck.verifyImage(VALID_JPG, 10000000), imageCheck.verifyImage(VALID_PNG, 10000000),
            imageCheck.verifyImage(VALID_JPG, 10000000), imageCheck.verifyImage(VALID_PNG, 10000000),
            imageCheck.verifyImage(VALID_JPG, 10000000), imageCheck.verifyImage(VALID_PNG, 10000000),
        ]);
    });


    it('should verify a jpg', (done) => {
        imageCheck.verifyImage(VALID_JPG, 10000000).then(done);
    });

    it('should verify a png', (done) => {
        imageCheck.verifyImage(VALID_PNG, 10000000).then(done);
    });

    it('should report a gif', (done) => {
        imageCheck.verifyImage(INVALID_GIF, 10000000)
            .then(() => {
                assert.fail(0, 1, 'Should not accept that');
            })
            .catch((err) => {
                assert.strictEqual(err.message, 'Unsupported file type (gif). Only jpg and png images are supported.');
                done();
            });
    });


    it('should report bad urls', (done) => {
        imageCheck.verifyImage(NON_EXISTENT, 10000000)
            .then(() => {
                assert.fail(0, 1, 'Should not accept that');
            })
            .catch((err) => {
                assert.strictEqual(err.message, 'Unable to download image from ' + NON_EXISTENT);
                done();
            });
    });

    it('should tolerate gibberish without crashing', (done) => {
        imageCheck.verifyImage(GIBBERISH, 10000000)
            .then(() => {
                assert.fail(0, 1, 'Should not accept that');
            })
            .catch((err) => {
                assert.strictEqual(err.message, 'Unable to download image from ' + GIBBERISH);
                done();
            });
    });

    it('should tolerate special characters without crashing', (done) => {
        imageCheck.verifyImage(SPECIALCHARS, 10000000)
            .then(() => {
                assert.fail(0, 1, 'Should not accept that');
            })
            .catch((err) => {
                assert.strictEqual(err.message, 'Unable to download image from ' + SPECIALCHARS);
                done();
            });
    });

    it('should reject images that exceed size limits', (done) => {
        imageCheck.verifyImage(VALID_JPG, 8000)
            .then(() => {
                assert.fail(0, 1, 'Should not accept that');
            })
            .catch((err) => {
                assert.strictEqual(err.message,
                             'Image file size (8.71 KB) is too big. Please choose images smaller than 7.81 KB');
                done();
            });
    });

});





// tslint:disable-next-line:max-line-length
const VALID_JPG = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Dampfwolke_des_KKW_G%C3%B6sgen_im_Abendhimmel.jpg/320px-Dampfwolke_des_KKW_G%C3%B6sgen_im_Abendhimmel.jpg';
// tslint:disable-next-line:max-line-length
const VALID_PNG = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Timezones2008_UTC-12_gray.png/320px-Timezones2008_UTC-12_gray.png';
// tslint:disable-next-line:max-line-length
const INVALID_GIF = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Missing_square_edit.gif/240px-Missing_square_edit.gif';
const NON_EXISTENT = 'http://this.does.not.exist.com/mypic.jpg';
const GIBBERISH = '12345';
const SPECIALCHARS = '*';
