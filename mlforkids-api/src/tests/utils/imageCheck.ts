import { describe, it, beforeEach } from 'node:test';
import * as assert from 'assert';
import * as imageCheck from '../../lib/utils/imageCheck';




describe('Utils - imageCheck', () => {

    // before((done) => {
    //     setTimeout(done, 5000);
    // });

    beforeEach(() => {
        imageCheck.init();
    });

    it('should recognise Google Drive images', async () => {
        await assert.rejects(
            () => imageCheck.verifyImage('https://lh3.google.com/u/0/d/1Yh4OLcQwULakLDfjoX8LoVwbOVNkSVa4=w2624-h1476-iv1', 10000000),
            { message: 'Google would not allow "Machine Learning for Kids" to use that image' }
        );
    });

    it('should handle multiple requests in parallel', async () => {
        await Promise.all([
            imageCheck.verifyImage(VALID_JPG + '?_mlk1', 10000000), imageCheck.verifyImage(VALID_PNG + '?_mlk1', 10000000),
            imageCheck.verifyImage(VALID_JPG + '?_mlk2', 10000000), imageCheck.verifyImage(VALID_PNG + '?_mlk2', 10000000),
            imageCheck.verifyImage(VALID_JPG + '?_mlk3', 10000000), imageCheck.verifyImage(VALID_PNG + '?_mlk3', 10000000),
            imageCheck.verifyImage(VALID_JPG + '?_mlk4', 10000000), imageCheck.verifyImage(VALID_PNG + '?_mlk4', 10000000),
            imageCheck.verifyImage(VALID_JPG + '?_mlk5', 10000000), imageCheck.verifyImage(VALID_PNG + '?_mlk5', 10000000),
            imageCheck.verifyImage(VALID_JPG + '?_mlk6', 10000000), imageCheck.verifyImage(VALID_PNG + '?_mlk6', 10000000),
        ]);
    });

    it('should use the cache for subsequent requests for an image', async () => {
        await imageCheck.verifyImage(VALID_JPG, 10000000);
        await imageCheck.verifyImage(VALID_PNG, 10000000);
        await imageCheck.verifyImage(VALID_JPG, 100);
        await imageCheck.verifyImage(VALID_PNG, 100);
        await imageCheck.verifyImage(VALID_JPG, 100);
        await imageCheck.verifyImage(VALID_PNG, 100);
        await imageCheck.verifyImage(VALID_JPG, 100);
        await imageCheck.verifyImage(VALID_PNG, 100);
    });

    it('should verify a jpg', async () => {
        await imageCheck.verifyImage(VALID_JPG, 10000000);
    });

    it('should verify a png', async () => {
        await imageCheck.verifyImage(VALID_PNG, 10000000);
    });

    it('should verify a jpg on an http server', async () => {
        await imageCheck.verifyImage(HTTP_ADDRESS, 10000000);
    });

    it('should verify a jpg on an http server with a redirect from https', async () => {
        await imageCheck.verifyImage(HTTPS_REDIR_TO_HTTP, 10000000);
    });

    it('should report a gif', async () => {
        await assert.rejects(
            () => imageCheck.verifyImage(INVALID_GIF, 10000000),
            { message: 'Unsupported file type (gif). Only jpg and png images are supported.' }
        );
    });


    it('should report bad urls', async () => {
        await assert.rejects(
            () => imageCheck.verifyImage(NON_EXISTENT, 10000000),
            { message: 'Unable to download image from ' + NON_EXISTENT }
        );
    });

    // function wait(): Promise<void> {
    //     return new Promise((resolve) => {
    //         setTimeout(resolve, 5);
    //     });
    // }

    // it.skip('should handle large numbers of requests to invalid URLs without running out of memory', async () => {
    //     const checkPromises = [];
    //     for (let i = 0; i < 200_000; i++) {
    //         const mod = i % 700;
    //         switch (mod) {
    //             case 0:
    //                 checkPromises.push(imageCheck.verifyImage(VALID_JPG, 10000));
    //                 break;
    //             case 1:
    //                 checkPromises.push(imageCheck.verifyImage(VALID_PNG, 10000));
    //                 break;
    //             case 599:
    //                 await wait();
    //                 break;
    //             default:
    //                 const hostname = 'not-a-real-host-' + (i % 400) + '.com';
    //                 const path = 'folder' + i;
    //                 const filename = 'not-a-real-image.jpg';
    //                 checkPromises.push(imageCheck.verifyImage('https://' + hostname + '/' + path + '/' + filename, 100000));
    //         }
    //     }
    //     return Promise.allSettled(checkPromises)
    //         .then((outcomes) => {
    //             for (let i = 0; i < outcomes.length; i++) {
    //                 const outcome = outcomes[i];
    //                 const mod = i % 700;
    //                 if (mod === 0 || mod === 1) {
    //                     if (outcome.status !== 'fulfilled') {
    //                         console.log(outcome.reason.message);
    //                     }
    //                     // assert.strictEqual(outcome.status, 'fulfilled');
    //                 }
    //                 else {
    //                     assert.strictEqual(outcome.status, 'rejected');
    //                     if (outcome.reason && !outcome.reason.message.startsWith('Unable to download image from https://not-a-real-host-')) {
    //                         console.log(outcome.reason.message);
    //                     }
    //                     assert(outcome.reason.message.startsWith('Unable to download image from https://not-a-real-host-'));
    //                     assert(outcome.reason.ml4k);
    //                 }
    //             }
    //         });
    // });

    it('should tolerate gibberish without crashing', async () => {
        await assert.rejects(
            () => imageCheck.verifyImage(GIBBERISH, 10000000),
            { message: 'Not a valid web address' }
        );
    });

    it('should tolerate special characters without crashing', async () => {
        await assert.rejects(
            () => imageCheck.verifyImage(SPECIALCHARS, 10000000),
            { message: 'Not a valid web address' }
        );
    });

    it('should tolerate malformed URI characters', async () => {
        await imageCheck.verifyImage(SPECIAL_CHAR_URL, 10000000);
    });

    it('should reject images that exceed size limits', async () => {
        await assert.rejects(
            () => imageCheck.verifyImage(VALID_JPG, 8000),
            { message: 'Image file size (11.95 kB) is too big. Please choose images smaller than 8 kB' }
        );
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
const HTTP_ADDRESS = 'http://image-net.org/static_files/index_files/logo.jpg';
const HTTPS_REDIR_TO_HTTP = 'https://ibm.biz/Bdf2Bu';
const SPECIAL_CHAR_URL = 'http://blogfiles.naver.net/MjAyNDA1MjFfMTg4/MDAxNzE2Mjc2MTg3Mzkx.lOoMKRMHnh5w1GgDQRf6e61M2n9pRcJytnLaY9nhBvYg.MyvpXiieqx78oKDQo2gS0S8tS2Xmtk7sYInmz8NsuIUg.JPEG/DSC_8982_%BA%B9%BB%E7_2.jpg';
