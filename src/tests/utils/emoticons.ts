/*eslint-env mocha */
import * as assert from 'assert';

import * as emoticons from '../../lib/utils/emoticons';



describe('Utils - emoticons', () => {

    const emoticonsLibrary = emoticons.getAllKnownEmoticons();

    it('should recognize text without emoticons', () => {
        const input = 'This is just plain text';
        assert.strictEqual(emoticons.countEmoticons(input, emoticonsLibrary), 0);
    });

    it('should count the number of emoticons in text', () => {
        const input = 'This contains a smiley face :-) to indicate cheerful text';
        assert.strictEqual(emoticons.countEmoticons(input, emoticonsLibrary), 1);
    });

    it('should count the number of emoticons in text', () => {
        const input = 'This contains a smiley face :-) and a crying face :\'(';
        assert.strictEqual(emoticons.countEmoticons(input, emoticonsLibrary), 2);
    });

});
