/*eslint-env mocha */
import * as assert from 'assert';
import * as fs from 'fs';
import * as tmp from 'tmp';
import * as async from 'async';

import * as imageCheck from '../../lib/utils/imageCheck';




describe('Utils - imageCheck', () => {

    it('should handle multiple requests in parallel', () => {
        return Promise.all([
            imageCheck.verifyImage(VALID_JPG), imageCheck.verifyImage(VALID_PNG),
            imageCheck.verifyImage(VALID_JPG), imageCheck.verifyImage(VALID_PNG),
            imageCheck.verifyImage(VALID_JPG), imageCheck.verifyImage(VALID_PNG),
            imageCheck.verifyImage(VALID_JPG), imageCheck.verifyImage(VALID_PNG),
            imageCheck.verifyImage(VALID_JPG), imageCheck.verifyImage(VALID_PNG),
            imageCheck.verifyImage(VALID_JPG), imageCheck.verifyImage(VALID_PNG),
        ]);
    });


    it('should verify a jpg', (done) => {
        imageCheck.verifyImage(VALID_JPG).then(done);
    });

    it('should verify a png', (done) => {
        imageCheck.verifyImage(VALID_PNG).then(done);
    });

    it('should report a gif', (done) => {
        imageCheck.verifyImage(INVALID_GIF)
            .then(() => {
                assert.fail(0, 1, 'Should not accept that');
            })
            .catch((err) => {
                assert.equal(err.message, 'Unsupported file type (gif). Only jpg and png images are supported.');
                done();
            });
    });


    it('should report bad urls', (done) => {
        imageCheck.verifyImage(NON_EXISTENT)
            .then(() => {
                assert.fail(0, 1, 'Should not accept that');
            })
            .catch((err) => {
                assert.equal(err.message, 'Unable to download image from ' + NON_EXISTENT);
                done();
            });
    });

    it('should tolerate gibberish without crashing', (done) => {
        imageCheck.verifyImage(GIBBERISH)
            .then(() => {
                assert.fail(0, 1, 'Should not accept that');
            })
            .catch((err) => {
                assert.equal(err.message, 'Unable to download image from ' + GIBBERISH);
                done();
            });
    });

    it('should tolerate special characters without crashing', (done) => {
        imageCheck.verifyImage(SPECIALCHARS)
            .then(() => {
                assert.fail(0, 1, 'Should not accept that');
            })
            .catch((err) => {
                assert.equal(err.message, 'Unable to download image from ' + SPECIALCHARS);
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
