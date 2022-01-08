/*eslint-env mocha */
import * as assert from 'assert';

import * as bagofwords from '../../lib/utils/bagofwords';



describe('Utils - bag of words', () => {

    it('should count the number of occurrences of words', () => {
        const input = [
            'This is a test',
            'Please verify that this works',
            'I want to test that this works and correctly verifies the count',
        ];
        const counts = bagofwords.getMostCommonWords(input, 5);
        assert.deepStrictEqual(counts, [
            { word : 'this', count : 3 },
            { word : 'test', count : 2 },
            { word : 'that', count : 2 },
            { word : 'works', count : 2 },
            { word : 'please', count : 1 },
        ]);
    });

    it('should filter out punctuation and common partial words', () => {
        const input = [
            'This hasn\'t been fully explained in the UI.',
            'Please? I don\'t want this to show up! Okay?! I\'d like to check that. They\'d be confused if they do.',
            'I\'d like to verify this hasn\'t allowed partial words through',
        ];
        const counts = bagofwords.getMostCommonWords(input, 5);
        assert.deepStrictEqual(counts, [
            { word : 'this', count : 3 },
            { word : 'i', count : 3 },
            { word : 'to', count : 3 },
            { word : 'hasn', count : 2 },
            { word : 'like', count : 2 },
        ]);
    });

    it('should handle small numbers of words', () => {
        const input = [
            'Hello world',
        ];
        const counts = bagofwords.getMostCommonWords(input, 10);
        assert.deepStrictEqual(counts, [
            { word : 'hello', count : 1 },
            { word : 'world', count : 1 },
            { word : 'would', count : 0 },
            { word : 'water', count : 0 },
            { word : 'first', count : 0 },
            { word : 'long', count : 0 },
            { word : 'time', count : 0 },
            { word : 'made', count : 0 },
            { word : 'people', count : 0 },
            { word : 'there', count : 0 },
        ]);
    });

    it('should handle small numbers of words from the padding list', () => {
        const input = [
            'would water first',
        ];
        const counts = bagofwords.getMostCommonWords(input, 10);
        assert.deepStrictEqual(counts, [
            { word : 'would', count : 1 },
            { word : 'water', count : 1 },
            { word : 'first', count : 1 },
            { word : 'long', count : 0 },
            { word : 'time', count : 0 },
            { word : 'made', count : 0 },
            { word : 'people', count : 0 },
            { word : 'there', count : 0 },
            { word : 'some', count : 0 },
            { word : 'word', count : 0 },
        ]);
    });

    it('should handle unusually small dictionaries', () => {
        const bowDictionary = [ 'apple', 'banana', 'tomato', 'melon', 'bottle' ];
        const testString = 'I would like to drink a smoothie made from apple, Banana, & MELON. Please';

        const counts = bagofwords.getTrainingExampleWordCounts(testString, bowDictionary);
        assert.deepStrictEqual(counts, [
            { word: 'apple', count: 1 },
            { word: 'banana', count: 1 },
            { word: 'melon', count: 1 },
            { word: 'tomato', count: 0 },
            { word: 'bottle', count: 0 },
            { word: 'i', count: 1 },
            { word: 'would', count: 1 },
            { word: 'like', count: 1 },
            { word: 'to', count: 1 },
            { word: 'drink', count: 1 },
        ]);
    });
});
