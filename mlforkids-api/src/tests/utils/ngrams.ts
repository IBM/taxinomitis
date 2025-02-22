/*eslint-env mocha */
import * as assert from 'assert';

import { read, readJson } from '../../lib/utils/fileutils';
import * as ngrams from '../../lib/utils/ngrams';


describe('Utils - ngrams', () => {

    function runTest(input: string[], n: number, expectedOutputFile: string): Promise<void> {
        const output = ngrams.countNgrams(input, n);
        return readJson(expectedOutputFile)
            .then((expected) => {
                assert.deepStrictEqual(output, expected);
            });
    }

    function verifyOrder(sortedNgrams: ngrams.SortedNgramCount[]) {
        if (sortedNgrams.length === 0) {
            return;
        }
        let count = sortedNgrams[0].count;
        for (const sortedNgram of sortedNgrams) {
            assert(sortedNgram.count <= count);
            count = sortedNgram.count;

            verifyOrder(sortedNgram.next);
        }
    }

    function verifySorting(output: ngrams.NgramData): void {
        assert.strictEqual(Object.keys(output.lookup).length,
                           output.sorted.length);

        for (const sortedNgram of output.sorted) {
            const token = sortedNgram.token;
            const lookupToken = output.lookup[token];

            assert.strictEqual(sortedNgram.count, lookupToken.count);

            for (const recursiveSortedNgram of sortedNgram.next) {
                const recursiveToken = recursiveSortedNgram.token;
                const recursiveLookup = lookupToken.next[recursiveToken];
                assert.strictEqual(recursiveSortedNgram.count, recursiveLookup.count);

                verifySorting({
                    lookup: recursiveLookup.next,
                    sorted: recursiveSortedNgram.next,
                });
            }
        }
    }


    describe('bigrams', () => {
        const n = 2;
        it('should return counts from a short string', () => {
            return runTest(SIMPLE, n, './src/tests/utils/resources/ngrams/simple-bigram.json');
        });
        it('should handle unusual punctuation', () => {
            return runTest(UNUSUAL_PUNCTUATION, n, './src/tests/utils/resources/ngrams/unusual-bigram.json');
        });
        it('should return counts from A Scandal in Bohemia', () => {
            return getTestStrings([ TEST_INPUT_FILES.BOHEMIA ])
                .then((input) => {
                    return runTest(input, n, './src/tests/utils/resources/ngrams/bohemia-bigram.json');
                })
        });
        it('should return counts from The Boscombe Valley Mystery', () => {
            return getTestStrings([ TEST_INPUT_FILES.BOSCOMBE ])
                .then((input) => {
                    return runTest(input, n, './src/tests/utils/resources/ngrams/boscombe-bigram.json');
                })
        });
        it('should return counts from A Case of Identity', () => {
            return getTestStrings([ TEST_INPUT_FILES.IDENTITY ])
                .then((input) => {
                    return runTest(input, n, './src/tests/utils/resources/ngrams/identity-bigram.json');
                })
        });
        it('should return counts from The Man With The Twisted Lip', () => {
            return getTestStrings([ TEST_INPUT_FILES.TWISTEDLIP ])
                .then((input) => {
                    return runTest(input, n, './src/tests/utils/resources/ngrams/twistedlip-bigram.json');
                })
        });
        it('should return ngrams in reverse-sorted order', () => {
            return getTestStrings([ TEST_INPUT_FILES.BOHEMIA ])
                .then((input) => {
                    const output = ngrams.countNgrams(input, n);
                    verifyOrder(output.sorted);
                });
        });
        it('should return consistent results between lookup and sorted', () => {
            return getTestStrings([ TEST_INPUT_FILES.BOHEMIA, TEST_INPUT_FILES.BOSCOMBE,
                                    TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP ])
                .then((input) => {
                    const output = ngrams.countNgrams(input, n);
                    verifySorting(output);
                });
        });
        it('should return consistent results from multiple files', () => {
            return getTestStrings([ TEST_INPUT_FILES.BOHEMIA, TEST_INPUT_FILES.BOSCOMBE,
                                    TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP ])
                .then((inputs) => {
                    const output_1_0 = ngrams.countNgrams([ inputs[0] ], n);
                    const output_1_1 = ngrams.countNgrams([ inputs[1] ], n);
                    const output_1_2 = ngrams.countNgrams([ inputs[2] ], n);
                    const output_1_3 = ngrams.countNgrams([ inputs[3] ], n);

                    const output_2_0 = ngrams.countNgrams([ inputs[0], inputs[1] ], n);
                    const output_2_1 = ngrams.countNgrams([ inputs[2], inputs[3] ], n);

                    const output_3_0 = ngrams.countNgrams([ inputs[0], inputs[1], inputs[2] ], n);

                    const output_4 = ngrams.countNgrams([ inputs[0], inputs[1], inputs[2], inputs[3] ], n);

                    const TOKEN_1 = "I";
                    const TOKEN_2 = "have";

                    const count_output_1_0 = output_1_0.lookup[TOKEN_1].next[TOKEN_2].count;
                    const count_output_1_1 = output_1_1.lookup[TOKEN_1].next[TOKEN_2].count;
                    const count_output_1_2 = output_1_2.lookup[TOKEN_1].next[TOKEN_2].count;
                    const count_output_1_3 = output_1_3.lookup[TOKEN_1].next[TOKEN_2].count;

                    const count_output_2_0 = output_2_0.lookup[TOKEN_1].next[TOKEN_2].count;
                    const count_output_2_1 = output_2_1.lookup[TOKEN_1].next[TOKEN_2].count;

                    const count_output_3_0 = output_3_0.lookup[TOKEN_1].next[TOKEN_2].count;

                    const count_output_4 = output_4.lookup[TOKEN_1].next[TOKEN_2].count;

                    assert.strictEqual(count_output_1_0 + count_output_1_1 + count_output_1_2 + count_output_1_3,
                                       count_output_4);
                    assert.strictEqual(count_output_2_0 + count_output_2_1,
                                       count_output_4);
                    assert.strictEqual(count_output_3_0 + count_output_1_3,
                                       count_output_4);
                    assert.strictEqual(count_output_1_0 + count_output_1_1,
                                       count_output_2_0);
                    assert.strictEqual(count_output_1_2 + count_output_1_3,
                                       count_output_2_1);
                    assert.strictEqual(count_output_1_0 + count_output_1_1 + count_output_1_2,
                                       count_output_3_0);
                });
        });
        it('should handle empty strings', () => {
            const output = ngrams.countNgrams([''], n);
            assert.deepStrictEqual(output, {
                lookup: {}, sorted: [],
            });
        });
        it('should handle strings with only whitespace', () => {
            const output = ngrams.countNgrams(['                        '], n);
            assert.deepStrictEqual(output, {
                lookup: {}, sorted: [],
            });
        });
        it('should handle strings with only punctuation', () => {
            const output = ngrams.countNgrams(['?!'], n);
            assert.strictEqual(output.sorted.length, 1);
            assert.strictEqual(output.lookup['<STOP>'].count, 1);
        });
        it('should handle empty input arrays', () => {
            const output = ngrams.countNgrams([], n);
            assert.deepStrictEqual(output, {
                lookup: {}, sorted: [],
            });
        });
    });

    describe('trigrams', () => {
        const n = 3;
        it('should return counts from a short string', () => {
            return runTest(SIMPLE, n, './src/tests/utils/resources/ngrams/simple-trigram.json');
        });
        it('should return counts from A Scandal in Bohemia', () => {
            return getTestStrings([ TEST_INPUT_FILES.BOHEMIA ])
                .then((input) => {
                    return runTest(input, n, './src/tests/utils/resources/ngrams/bohemia-trigram.json');
                })
        });
        it('should return counts from The Boscombe Valley Mystery', () => {
            return getTestStrings([ TEST_INPUT_FILES.BOSCOMBE ])
                .then((input) => {
                    return runTest(input, n, './src/tests/utils/resources/ngrams/boscombe-trigram.json');
                })
        });
        it('should return counts from A Case of Identity', () => {
            return getTestStrings([ TEST_INPUT_FILES.IDENTITY ])
                .then((input) => {
                    return runTest(input, n, './src/tests/utils/resources/ngrams/identity-trigram.json');
                })
        });
        it('should return counts from The Man With The Twisted Lip', () => {
            return getTestStrings([ TEST_INPUT_FILES.TWISTEDLIP ])
                .then((input) => {
                    return runTest(input, n, './src/tests/utils/resources/ngrams/twistedlip-trigram.json');
                })
        });
        it('should return ngrams in reverse-sorted order', () => {
            return getTestStrings([ TEST_INPUT_FILES.IDENTITY ])
                .then((input) => {
                    const output = ngrams.countNgrams(input, n);
                    verifyOrder(output.sorted);
                });
        });
        it('should return consistent results between lookup and sorted', () => {
            return getTestStrings([ TEST_INPUT_FILES.BOHEMIA, TEST_INPUT_FILES.BOSCOMBE,
                                    TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP ])
                .then((input) => {
                    const output = ngrams.countNgrams(input, n);
                    verifySorting(output);
                });
        });
        it('should return consistent results from multiple files', () => {
            return getTestStrings([ TEST_INPUT_FILES.BOHEMIA, TEST_INPUT_FILES.BOSCOMBE,
                                    TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP ])
                .then((inputs) => {
                    const output_1_0 = ngrams.countNgrams([ inputs[0] ], n);
                    const output_1_1 = ngrams.countNgrams([ inputs[1] ], n);
                    const output_1_2 = ngrams.countNgrams([ inputs[2] ], n);
                    const output_1_3 = ngrams.countNgrams([ inputs[3] ], n);

                    const output_2_0 = ngrams.countNgrams([ inputs[0], inputs[1] ], n);
                    const output_2_1 = ngrams.countNgrams([ inputs[2], inputs[3] ], n);

                    const output_3_0 = ngrams.countNgrams([ inputs[0], inputs[1], inputs[2] ], n);

                    const output_4 = ngrams.countNgrams([ inputs[0], inputs[1], inputs[2], inputs[3] ], n);

                    const TOKEN_1 = "<STOP>";
                    const TOKEN_2 = "I";
                    const TOKEN_3 = "have"

                    const count_output_1_0 = output_1_0.lookup[TOKEN_1].next[TOKEN_2].next[TOKEN_3].count;
                    const count_output_1_1 = output_1_1.lookup[TOKEN_1].next[TOKEN_2].next[TOKEN_3].count;
                    const count_output_1_2 = output_1_2.lookup[TOKEN_1].next[TOKEN_2].next[TOKEN_3].count;
                    const count_output_1_3 = output_1_3.lookup[TOKEN_1].next[TOKEN_2].next[TOKEN_3].count;

                    const count_output_2_0 = output_2_0.lookup[TOKEN_1].next[TOKEN_2].next[TOKEN_3].count;
                    const count_output_2_1 = output_2_1.lookup[TOKEN_1].next[TOKEN_2].next[TOKEN_3].count;

                    const count_output_3_0 = output_3_0.lookup[TOKEN_1].next[TOKEN_2].next[TOKEN_3].count;

                    const count_output_4 = output_4.lookup[TOKEN_1].next[TOKEN_2].next[TOKEN_3].count;

                    assert.strictEqual(count_output_1_0 + count_output_1_1 + count_output_1_2 + count_output_1_3,
                                       count_output_4);
                    assert.strictEqual(count_output_2_0 + count_output_2_1,
                                       count_output_4);
                    assert.strictEqual(count_output_3_0 + count_output_1_3,
                                       count_output_4);
                    assert.strictEqual(count_output_1_0 + count_output_1_1,
                                       count_output_2_0);
                    assert.strictEqual(count_output_1_2 + count_output_1_3,
                                       count_output_2_1);
                    assert.strictEqual(count_output_1_0 + count_output_1_1 + count_output_1_2,
                                       count_output_3_0);
                });
        });
        it('should handle empty strings', () => {
            const output = ngrams.countNgrams([''], n);
            assert.deepStrictEqual(output, {
                lookup: {}, sorted: [],
            });
        });
        it('should handle strings with only whitespace', () => {
            const output = ngrams.countNgrams(['                        '], n);
            assert.deepStrictEqual(output, {
                lookup: {}, sorted: [],
            });
        });
        it('should handle strings with only punctuation', () => {
            const output = ngrams.countNgrams(['?!'], n);
            assert.deepStrictEqual(output, {
                lookup: {}, sorted: [],
            });
        });
        it('should handle empty input arrays', () => {
            const output = ngrams.countNgrams([], n);
            assert.deepStrictEqual(output, {
                lookup: {}, sorted: [],
            });
        });
    });

    describe('tetragrams', () => {
        const n = 4;
        it('should return counts from a short string', () => {
            return runTest(SIMPLE, n, './src/tests/utils/resources/ngrams/simple-tetragram.json');
        });
        it('should return counts from A Scandal in Bohemia', () => {
            return getTestStrings([ TEST_INPUT_FILES.BOHEMIA ])
                .then((input) => {
                    return runTest(input, n, './src/tests/utils/resources/ngrams/bohemia-tetragram.json');
                })
        });
        it('should return counts from The Boscombe Valley Mystery', () => {
            return getTestStrings([ TEST_INPUT_FILES.BOSCOMBE ])
                .then((input) => {
                    return runTest(input, n, './src/tests/utils/resources/ngrams/boscombe-tetragram.json');
                })
        });
        it('should return counts from A Case of Identity', () => {
            return getTestStrings([ TEST_INPUT_FILES.IDENTITY ])
                .then((input) => {
                    return runTest(input, n, './src/tests/utils/resources/ngrams/identity-tetragram.json');
                })
        });
        it('should return counts from The Man With The Twisted Lip', () => {
            return getTestStrings([ TEST_INPUT_FILES.TWISTEDLIP ])
                .then((input) => {
                    return runTest(input, n, './src/tests/utils/resources/ngrams/twistedlip-tetragram.json');
                })
        });
        it('should return ngrams in reverse-sorted order', () => {
            return getTestStrings([ TEST_INPUT_FILES.BOSCOMBE ])
                .then((input) => {
                    const output = ngrams.countNgrams(input, n);
                    verifyOrder(output.sorted);
                });
        });
        it('should return consistent results between lookup and sorted', () => {
            return getTestStrings([ TEST_INPUT_FILES.BOHEMIA, TEST_INPUT_FILES.BOSCOMBE,
                                    TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP ])
                .then((input) => {
                    const output = ngrams.countNgrams(input, n);
                    verifySorting(output);
                });
        });
        it('should return consistent results from multiple files', () => {
            return getTestStrings([ TEST_INPUT_FILES.BOHEMIA, TEST_INPUT_FILES.BOSCOMBE,
                                    TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP ])
                .then((inputs) => {
                    const output_1_0 = ngrams.countNgrams([ inputs[0] ], n);
                    const output_1_1 = ngrams.countNgrams([ inputs[1] ], n);
                    const output_1_2 = ngrams.countNgrams([ inputs[2] ], n);
                    const output_1_3 = ngrams.countNgrams([ inputs[3] ], n);

                    const output_2_0 = ngrams.countNgrams([ inputs[0], inputs[1] ], n);
                    const output_2_1 = ngrams.countNgrams([ inputs[2], inputs[3] ], n);

                    const output_3_0 = ngrams.countNgrams([ inputs[0], inputs[1], inputs[2] ], n);

                    const output_4 = ngrams.countNgrams([ inputs[0], inputs[1], inputs[2], inputs[3] ], n);

                    const TOKEN_1 = "<STOP>";
                    const TOKEN_2 = "I";
                    const TOKEN_3 = "think"
                    const TOKEN_4 = "that";

                    const count_output_1_0 = output_1_0.lookup[TOKEN_1].next[TOKEN_2].next[TOKEN_3].next[TOKEN_4].count;
                    const count_output_1_1 = output_1_1.lookup[TOKEN_1].next[TOKEN_2].next[TOKEN_3].next[TOKEN_4].count;
                    const count_output_1_2 = output_1_2.lookup[TOKEN_1].next[TOKEN_2].next[TOKEN_3].next[TOKEN_4].count;
                    const count_output_1_3 = 0;
                    assert.strictEqual(TOKEN_4 in output_1_3.lookup[TOKEN_1].next[TOKEN_2].next[TOKEN_3].next, false);

                    const count_output_2_0 = output_2_0.lookup[TOKEN_1].next[TOKEN_2].next[TOKEN_3].next[TOKEN_4].count;
                    const count_output_2_1 = output_2_1.lookup[TOKEN_1].next[TOKEN_2].next[TOKEN_3].next[TOKEN_4].count;

                    const count_output_3_0 = output_3_0.lookup[TOKEN_1].next[TOKEN_2].next[TOKEN_3].next[TOKEN_4].count;

                    const count_output_4 = output_4.lookup[TOKEN_1].next[TOKEN_2].next[TOKEN_3].next[TOKEN_4].count;

                    assert.strictEqual(count_output_1_0 + count_output_1_1 + count_output_1_2 + count_output_1_3,
                                       count_output_4);
                    assert.strictEqual(count_output_2_0 + count_output_2_1,
                                       count_output_4);
                    assert.strictEqual(count_output_3_0 + count_output_1_3,
                                       count_output_4);
                    assert.strictEqual(count_output_1_0 + count_output_1_1,
                                       count_output_2_0);
                    assert.strictEqual(count_output_1_2 + count_output_1_3,
                                       count_output_2_1);
                    assert.strictEqual(count_output_1_0 + count_output_1_1 + count_output_1_2,
                                       count_output_3_0);
                });
        });
        it('should handle empty strings', () => {
            const output = ngrams.countNgrams([''], n);
            assert.deepStrictEqual(output, {
                lookup: {}, sorted: [],
            });
        });
        it('should handle strings with only whitespace', () => {
            const output = ngrams.countNgrams(['                        '], n);
            assert.deepStrictEqual(output, {
                lookup: {}, sorted: [],
            });
        });
        it('should handle strings with only punctuation', () => {
            const output = ngrams.countNgrams(['?!'], n);
            assert.deepStrictEqual(output, {
                lookup: {}, sorted: [],
            });
        });
        it('should handle empty input arrays', () => {
            const output = ngrams.countNgrams([], n);
            assert.deepStrictEqual(output, {
                lookup: {}, sorted: [],
            });
        });
    });

    describe('different n-grams', () => {
        it('should return consistent results for different values of n', () => {
            return getTestStrings([ TEST_INPUT_FILES.BOHEMIA, TEST_INPUT_FILES.BOSCOMBE,
                                    TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP ])
                .then((inputs) => {
                    const bigrams = ngrams.countNgrams(inputs, 2);
                    const trigrams = ngrams.countNgrams(inputs, 3);
                    const tetragrams = ngrams.countNgrams(inputs, 4);

                    const tokensToVerify = [ 'I', 'do', 'not', 'know' ];

                    assert.strictEqual(
                        tetragrams.lookup[tokensToVerify[0]]
                            .next[tokensToVerify[1]]
                            .next[tokensToVerify[2]]
                            .next[tokensToVerify[3]]
                            .count,
                        4);

                    for (const ngramResults of [ trigrams, tetragrams ]) {
                        assert.strictEqual(
                            ngramResults.lookup[tokensToVerify[0]]
                                .next[tokensToVerify[1]]
                                .next[tokensToVerify[2]]
                                .count,
                            11);
                    }

                    for (const ngramResults of [ bigrams, trigrams, tetragrams ]) {
                        assert.strictEqual(
                            ngramResults.lookup[tokensToVerify[0]]
                                .next[tokensToVerify[1]]
                                .count,
                            16);

                        assert.strictEqual(
                            ngramResults.lookup[tokensToVerify[0]]
                                .count,
                            935);
                    }
                });
        });
    });
});


const SIMPLE = [
    'The cat sat on the mat. ' +
    'Why did the cat sit on the mat? ' +
    'The cat sat on the mat maybe because she liked the warmth, ' +
    'or maybe it was the view.',
];
const UNUSUAL_PUNCTUATION = [
    'This . Is . Okay ? 5 ! 4! !3! 2! !1',
];

const TEST_INPUT_FILES = {
    BOHEMIA : 'holmes-bohemia.txt',
    BOSCOMBE : 'holmes-boscombe.txt',
    IDENTITY : 'holmes-identity.txt',
    TWISTEDLIP : 'holmes-twistedlip.txt',
};
function getTestStrings(filenames: string[]): Promise<string[]> {
    const filereads = filenames.map((filename) => {
        return read('./src/tests/utils/resources/ngrams/' + filename);
    });
    return Promise.all(filereads);
}
