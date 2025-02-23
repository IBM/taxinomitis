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

    function verifyOrder(sortedNgrams: ngrams.SortedNgramCountWithCumulativeProbabilities[]) {
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

    function equalWithinRounding(num1: number, num2: number): boolean {
        return Math.abs(num1 - num2) < 0.001;
    }

    function lookupCount(input: ngrams.NgramLookupTable, tokens: string[]): number {
        let node = input;
        for (let tokenIdx = 0; tokenIdx < tokens.length - 1; tokenIdx++) {
            const nxtToken = tokens[tokenIdx]
            node = node[nxtToken].next as ngrams.NgramLookupTable;
        }
        const token = tokens[tokens.length - 1];
        let entry;
        if (Array.isArray(node)) {
            const allNgrams = node;
            entry = allNgrams.find((i) => i.token === token);
        }
        else {
            entry = node[token];
        }
        if (entry) {
            return entry.count;
        }
        throw new Error('lookup entry not found');
    }

    function verifySummary(output: ngrams.NgramData): void {
        assert.strictEqual(Math.min(Object.keys(output.lookup).length, ngrams.SUMMARY_DEPTH),
                           output.summary.length);

        for (const summaryNgram of output.summary) {
            const token = summaryNgram.token;
            const lookupToken = output.lookup[token];

            assert.strictEqual(summaryNgram.count, lookupToken.count);

            if (Array.isArray(lookupToken.next)) {
                const summaryNgramView = summaryNgram.next;
                const lookupNgramView  = lookupToken.next;
                assert.strictEqual(Math.min(lookupNgramView.length, ngrams.SUMMARY_DEPTH),
                                   summaryNgramView.length);
                for (let i = 0; i < summaryNgramView.length; i++) {
                    assert.strictEqual(summaryNgramView[i].token, lookupNgramView[i].token);
                    assert.strictEqual(summaryNgramView[i].count, lookupNgramView[i].count);
                    assert(equalWithinRounding(summaryNgramView[i].prob, lookupNgramView[i].prob));
                    assert(equalWithinRounding(summaryNgramView[i].cumprob, lookupNgramView[i].cumprob));
                }
            }
            else {
                verifySummary({
                    lookup  : lookupToken.next,
                    summary : summaryNgram.next,
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
                    verifyOrder(output.summary);
                });
        });
        it('should return consistent results between lookup and summary', () => {
            return getTestStrings([ TEST_INPUT_FILES.BOHEMIA, TEST_INPUT_FILES.BOSCOMBE,
                                    TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP ])
                .then((input) => {
                    const output = ngrams.countNgrams(input, n);
                    verifySummary(output);
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

                    const count_output_1_0 = lookupCount(output_1_0.lookup, [ TOKEN_1, TOKEN_2 ]);
                    const count_output_1_1 = lookupCount(output_1_1.lookup, [ TOKEN_1, TOKEN_2 ]);
                    const count_output_1_2 = lookupCount(output_1_2.lookup, [ TOKEN_1, TOKEN_2 ]);
                    const count_output_1_3 = lookupCount(output_1_3.lookup, [ TOKEN_1, TOKEN_2 ]);

                    const count_output_2_0 = lookupCount(output_2_0.lookup, [ TOKEN_1, TOKEN_2 ]);
                    const count_output_2_1 = lookupCount(output_2_1.lookup, [ TOKEN_1, TOKEN_2 ]);

                    const count_output_3_0 = lookupCount(output_3_0.lookup, [ TOKEN_1, TOKEN_2 ]);

                    const count_output_4   = lookupCount(output_4.lookup,   [ TOKEN_1, TOKEN_2 ]);

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
                lookup: {}, summary: [],
            });
        });
        it('should handle strings with only whitespace', () => {
            const output = ngrams.countNgrams(['                        '], n);
            assert.deepStrictEqual(output, {
                lookup: {}, summary: [],
            });
        });
        it('should handle strings with only punctuation', () => {
            const output = ngrams.countNgrams(['?!'], n);
            assert.strictEqual(output.summary.length, 1);
            assert.strictEqual(output.lookup['<STOP>'].count, 1);
        });
        it('should handle empty input arrays', () => {
            const output = ngrams.countNgrams([], n);
            assert.deepStrictEqual(output, {
                lookup: {}, summary: [],
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
                    verifyOrder(output.summary);
                });
        });
        it('should return consistent results between lookup and summary', () => {
            return getTestStrings([ TEST_INPUT_FILES.BOHEMIA, TEST_INPUT_FILES.BOSCOMBE,
                                    TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP ])
                .then((input) => {
                    const output = ngrams.countNgrams(input, n);
                    verifySummary(output);
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

                    const count_output_1_0 = lookupCount(output_1_0.lookup, [TOKEN_1, TOKEN_2, TOKEN_3]);
                    const count_output_1_1 = lookupCount(output_1_1.lookup, [TOKEN_1, TOKEN_2, TOKEN_3]);
                    const count_output_1_2 = lookupCount(output_1_2.lookup, [TOKEN_1, TOKEN_2, TOKEN_3]);
                    const count_output_1_3 = lookupCount(output_1_3.lookup, [TOKEN_1, TOKEN_2, TOKEN_3]);

                    const count_output_2_0 = lookupCount(output_2_0.lookup, [TOKEN_1, TOKEN_2, TOKEN_3]);
                    const count_output_2_1 = lookupCount(output_2_1.lookup, [TOKEN_1, TOKEN_2, TOKEN_3]);

                    const count_output_3_0 = lookupCount(output_3_0.lookup, [TOKEN_1, TOKEN_2, TOKEN_3]);

                    const count_output_4   = lookupCount(output_4.lookup, [TOKEN_1, TOKEN_2, TOKEN_3]);

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
                lookup: {}, summary: [],
            });
        });
        it('should handle strings with only whitespace', () => {
            const output = ngrams.countNgrams(['                        '], n);
            assert.deepStrictEqual(output, {
                lookup: {}, summary: [],
            });
        });
        it('should handle strings with only punctuation', () => {
            const output = ngrams.countNgrams(['?!'], n);
            assert.deepStrictEqual(output, {
                lookup: {}, summary: [],
            });
        });
        it('should handle empty input arrays', () => {
            const output = ngrams.countNgrams([], n);
            assert.deepStrictEqual(output, {
                lookup: {}, summary: [],
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
                    verifyOrder(output.summary);
                });
        });
        it('should return consistent results between lookup and summary', () => {
            return getTestStrings([ TEST_INPUT_FILES.BOHEMIA, TEST_INPUT_FILES.BOSCOMBE,
                                    TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP ])
                .then((input) => {
                    const output = ngrams.countNgrams(input, n);
                    verifySummary(output);
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

                    const count_output_1_0 = lookupCount(output_1_0.lookup, [TOKEN_1, TOKEN_2, TOKEN_3, TOKEN_4]);
                    const count_output_1_1 = lookupCount(output_1_1.lookup, [TOKEN_1, TOKEN_2, TOKEN_3, TOKEN_4]);
                    const count_output_1_2 = lookupCount(output_1_2.lookup, [TOKEN_1, TOKEN_2, TOKEN_3, TOKEN_4]);
                    const count_output_1_3 = 0;
                    assert.throws(() => { lookupCount(output_1_3.lookup, [TOKEN_1, TOKEN_2, TOKEN_3, TOKEN_4])});

                    const count_output_2_0 = lookupCount(output_2_0.lookup, [TOKEN_1, TOKEN_2, TOKEN_3, TOKEN_4]);
                    const count_output_2_1 = lookupCount(output_2_1.lookup, [TOKEN_1, TOKEN_2, TOKEN_3, TOKEN_4]);

                    const count_output_3_0 = lookupCount(output_3_0.lookup, [TOKEN_1, TOKEN_2, TOKEN_3, TOKEN_4]);

                    const count_output_4   = lookupCount(output_4.lookup, [TOKEN_1, TOKEN_2, TOKEN_3, TOKEN_4]);

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
                lookup: {}, summary: [],
            });
        });
        it('should handle strings with only whitespace', () => {
            const output = ngrams.countNgrams(['                        '], n);
            assert.deepStrictEqual(output, {
                lookup: {}, summary: [],
            });
        });
        it('should handle strings with only punctuation', () => {
            const output = ngrams.countNgrams(['?!'], n);
            assert.deepStrictEqual(output, {
                lookup: {}, summary: [],
            });
        });
        it('should handle empty input arrays', () => {
            const output = ngrams.countNgrams([], n);
            assert.deepStrictEqual(output, {
                lookup: {}, summary: [],
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

                    assert.strictEqual(lookupCount(tetragrams.lookup, [ tokensToVerify[0], tokensToVerify[1], tokensToVerify[2], tokensToVerify[3]]), 4);

                    for (const ngramResults of [ trigrams, tetragrams ]) {
                        assert.strictEqual(lookupCount(ngramResults.lookup, [ tokensToVerify[0], tokensToVerify[1], tokensToVerify[2] ]), 11);
                    }

                    for (const ngramResults of [ bigrams, trigrams, tetragrams ]) {
                        assert.strictEqual(lookupCount(ngramResults.lookup, [ tokensToVerify[0], tokensToVerify[1] ]), 16);
                        assert.strictEqual(lookupCount(ngramResults.lookup, [ tokensToVerify[0] ]),                    935);
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

export const TEST_INPUT_FILES = {
    BOHEMIA : 'holmes-bohemia.txt',
    BOSCOMBE : 'holmes-boscombe.txt',
    IDENTITY : 'holmes-identity.txt',
    TWISTEDLIP : 'holmes-twistedlip.txt',
};
export function getTestStrings(filenames: string[]): Promise<string[]> {
    const filereads = filenames.map((filename) => {
        return read('./src/tests/utils/resources/ngrams/' + filename);
    });
    return Promise.all(filereads);
}
