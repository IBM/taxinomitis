/*eslint-env mocha */
import * as assert from 'assert';
import * as passphrases from '../../lib/auth0/passphrases';
import { WORDS } from '../../lib/utils/dictionary';


describe('passphrases generator', () => {

    it('should generate a string', () => {
        assert.equal(typeof passphrases.generate(), 'string');
    });

    it('should generate a string of at least eight characters in length', () => {
        assert(passphrases.generate().length > 8);
    });

    it('should generate a string without spaces in it', () => {
        assert.equal(passphrases.generate().indexOf(' '), -1);
    });

    it('should not modify the dictionary when generating passphrases', () => {
        const firstInDictBefore = WORDS[0];
        passphrases.generate();
        const firstInDictAfter = WORDS[0];
        assert.equal(firstInDictBefore, firstInDictAfter);
    });

    it('should generate different passphrases each time', () => {
        const NUM_PHRASES = 100;
        const values = [];
        for (let i = 0; i < NUM_PHRASES; i++) {
            values.push(passphrases.generate());
        }

        const NUM_UNIQ_PHRASES = Array.from(new Set(values)).length;
        assert.equal(NUM_PHRASES, NUM_UNIQ_PHRASES);
    });

    it('should contain three or four words in a phrase', () => {
        const phrase = passphrases.generate();
        const words = phrase.split(/[^A-Za-z]/);
        assert(words.length === 3 || words.length === 4);
    });

    it('should use words longer than 2 characters but shorter than 12', () => {
        const phrase = passphrases.generate();
        const words = phrase.split(/[^A-Za-z]/);
        words.forEach((word) => {
            assert(word.length > 3 || words.length < 12);
        });
    });
});
