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
            { word : 'is', count : 1 },
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
        ]);
    });

});
