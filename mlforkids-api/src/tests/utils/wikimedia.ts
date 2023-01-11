/*eslint-env mocha */
import * as assert from 'assert';
import * as wikimedia from '../../lib/utils/wikimedia';



describe('Utils - wikimedia', () => {

    it('should recognise a Wikimedia image url', () => {
        for (const validurl of VALID_URLS) {
            assert.strictEqual(wikimedia.isWikimedia(validurl), true);
        }
        for (const validurl of VALID_THUMBS) {
            assert.strictEqual(wikimedia.isWikimedia(validurl), true);
        }
        assert.strictEqual(wikimedia.isWikimedia(INVALID_URLS[0]), false);
    });

    it('should get smaller version of Wikimedia images', () => {
        return Promise.all(VALID_URLS.map((url) => wikimedia.getThumbnail(url, 244)))
            .then((responses) => {
                assert.deepStrictEqual(responses, EXPECTED_URL_THUMBS);
            });
    });

    it('should get smaller version of Wikimedia thumbs', () => {
        return Promise.all(VALID_THUMBS.map((url) => wikimedia.getThumbnail(url, 244)))
            .then((responses) => {
                assert.deepStrictEqual(responses, EXPECTED_THUMB_THUMBS);
            });
    });

    it('should return errors', async () => {
        for (const invalidurl of INVALID_URLS) {
            try {
                await wikimedia.getThumbnail(invalidurl, 244);
                assert.fail('should not be here : ' + invalidurl);
            }
            catch (err) {
                assert.strictEqual(err.message, wikimedia.FAIL);
            }
        }
    });


    const VALID_URLS = [
        'https://upload.wikimedia.org/wikipedia/commons/d/dc/BrownSpiderMonkey_%28edit2%29.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/3/39/Narval.JPG',
        'https://upload.wikimedia.org/wikipedia/commons/4/4c/Push_van_cat.jpg',
    ];
    const EXPECTED_URL_THUMBS = [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/BrownSpiderMonkey_%28edit2%29.jpg/244px-BrownSpiderMonkey_%28edit2%29.jpg', // tslint:disable-line
        'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Narval.JPG/244px-Narval.JPG',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Push_van_cat.jpg/244px-Push_van_cat.jpg',
    ];
    const VALID_THUMBS = [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Playing_card_diamond_5.svg/2000px-Playing_card_diamond_5.svg.png', // tslint:disable-line
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/2cv-club-red.jpg/266px-2cv-club-red.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Example_barcode.svg/1200px-Example_barcode.svg.png',
    ];
    const EXPECTED_THUMB_THUMBS = [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Playing_card_diamond_5.svg/244px-Playing_card_diamond_5.svg.png', // tslint:disable-line
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/2cv-club-red.jpg/244px-2cv-club-red.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Example_barcode.svg/244px-Example_barcode.svg.png',
    ];
    const INVALID_URLS = [
        'https://something.com/mygreatpicture.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/1/16/Maltese_kitten.jpeg',
        'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x91dp.png',
    ];

});


