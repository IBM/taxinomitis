import { describe, it } from 'node:test';
import * as assert from 'assert';
import * as url from 'url';
import * as wikimedia from '../../lib/utils/wikimedia';



describe('Utils - wikimedia', () => {

    it('should recognise a Wikimedia image url', () => {
        for (const validurl of VALID_URLS) {
            assert.strictEqual(wikimedia.isWikimedia(validurl), true);
        }
        for (const validurl of VALID_THUMBS) {
            assert.strictEqual(wikimedia.isWikimedia(validurl), true);
        }
        for (const validurl of VALID_THUMB_HOST_URLS) {
            assert.strictEqual(wikimedia.isWikimedia(validurl), true);
        }
        for (const invalidurl of NON_WIKIMEDIA_URLS) {
            assert.strictEqual(wikimedia.isWikimedia(invalidurl), false);
        }
    });

    it('should get smaller version of Wikimedia images', async () => {
        const responses = await Promise.all(VALID_URLS.map((imageurl) => wikimedia.getThumbnail(imageurl, 244)));
        responses.forEach((resp, idx) => {
            assert.strictEqual(wikimedia.isWikimedia(resp), true);
            assert.strictEqual(thumbnailFilename(resp), EXPECTED_THUMB_FILENAMES[idx]);
        });
    });

    it('should get smaller version of Wikimedia thumbs', async () => {
        const responses = await Promise.all(VALID_THUMBS.map((imageurl) => wikimedia.getThumbnail(imageurl, 244)));
        responses.forEach((resp, idx) => {
            assert.strictEqual(wikimedia.isWikimedia(resp), true);
            assert.strictEqual(thumbnailFilename(resp), EXPECTED_THUMB_THUMB_FILENAMES[idx]);
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


    // the final segment of the returned thumbnail URL's path - i.e. the
    //  '<width>px-<name>' filename - which is host-independent, so it survives
    //  Wikimedia moving thumbnails to a different domain
    function thumbnailFilename(thumburl: string): string {
        return new url.URL(thumburl).pathname.split('/').pop() as string;
    }


    const VALID_URLS = [
        'https://upload.wikimedia.org/wikipedia/commons/d/dc/BrownSpiderMonkey_%28edit2%29.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/3/39/Narval.JPG',
        'https://upload.wikimedia.org/wikipedia/commons/4/4c/Push_van_cat.jpg',
    ];
    // the '<width>px-<name>' filename we expect getThumbnail to hand back for
    //  each of VALID_URLS. Wikimedia rounds our 244px request up to its nearest
    //  standard bucket (250px).
    const EXPECTED_THUMB_FILENAMES = [
        '250px-BrownSpiderMonkey_%28edit2%29.jpg',
        '250px-Narval.JPG',
        '250px-Push_van_cat.jpg',
    ];
    const VALID_THUMBS = [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Playing_card_diamond_5.svg/2000px-Playing_card_diamond_5.svg.png', // tslint:disable-line
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/2cv-club-red.jpg/266px-2cv-club-red.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Example_barcode.svg/1200px-Example_barcode.svg.png',
    ];
    const EXPECTED_THUMB_THUMB_FILENAMES = [
        '250px-Playing_card_diamond_5.svg.png',
        '250px-2cv-club-red.jpg',
        '250px-Example_barcode.svg.png',
    ];
    // Wikimedia's Commons API now returns thumbnail URLs on thumb.wikimedia.org
    const VALID_THUMB_HOST_URLS = [
        'https://thumb.wikimedia.org/wikipedia/commons/3/39/Narval.JPG',
        'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/39/Narval.JPG/250px-Narval.JPG',
    ];
    const INVALID_URLS = [
        'https://something.com/mygreatpicture.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/1/16/Maltese_kitten.jpeg',
        'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x91dp.png',
    ];
    const NON_WIKIMEDIA_URLS = [
        'https://something.com/mygreatpicture.jpg',
        'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x91dp.png',
        // right host, wrong scheme
        'http://upload.wikimedia.org/wikipedia/commons/3/39/Narval.JPG',
        // wikimedia, but a language project rather than the shared commons
        'https://upload.wikimedia.org/wikipedia/en/a/a9/Example.jpg',
        // lookalike host - must not be treated as wikimedia
        'https://thumb.wikimedia.org.evil.example/wikipedia/commons/3/39/Narval.JPG',
    ];

});
