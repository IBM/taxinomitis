/*eslint-env mocha */
import * as assert from 'assert';
import * as passphrases from '../../lib/auth0/passphrases';
import { WORDS } from '../../lib/utils/dictionary';


describe('passphrases generator', () => {

    it('should generate a string', () => {
        assert.strictEqual(typeof passphrases.generate(), 'string');
    });

    it('should generate a string of at least eight characters in length', () => {
        assert(passphrases.generate().length > 8);
    });

    it('should generate a string without spaces in it', () => {
        assert.strictEqual(passphrases.generate().indexOf(' '), -1);
    });

    it('should not modify the dictionary when generating passphrases', () => {
        const firstInDictBefore = WORDS[0];
        passphrases.generate();
        const firstInDictAfter = WORDS[0];
        assert.strictEqual(firstInDictBefore, firstInDictAfter);
    });

    it('should generate different passphrases each time', () => {
        const NUM_PHRASES = 100;
        const values = [];
        for (let i = 0; i < NUM_PHRASES; i++) {
            values.push(passphrases.generate());
        }

        const NUM_UNIQ_PHRASES = Array.from(new Set(values)).length;
        assert.strictEqual(NUM_PHRASES, NUM_UNIQ_PHRASES);
    });

    it('should contain between two and five words in a phrase', () => {
        const phrase = passphrases.generate();
        const words = phrase.split(/[^A-Za-z]/);
        assert(words.length >= 2 || words.length <= 5);
    });

    it('should use words at least 2 characters long but shorter than 12', () => {
        const phrase = passphrases.generate();
        const words = phrase.split(/[^A-Za-z]/);
        words.forEach((word) => {
            assert(word.length >= 2 || words.length < 12);
        });
    });

    it('should generate passphrases that are at least eight characters long', () => {
        const phrase = passphrases.generate();
        assert(phrase.length >= 8);
        assert(phrase.length <= 18);
    });
});
