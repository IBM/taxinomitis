describe('ngramsService', function () {

    var ngramsService;

    beforeEach(module('app'));

    beforeEach(inject(function (_ngramsService_) {
        ngramsService = _ngramsService_;
    }));


    // ===================================================================
    // same results as the server
    //
    // the fixtures are the output of countNgrams() in src/lib/utils/ngrams.ts
    //  (used by the server tests in src/tests/utils/ngrams.ts) which this
    //  service replaces
    // ===================================================================

    var FIXTURES = '/base/src/tests/utils/resources/ngrams/';

    // same inputs as src/tests/utils/ngrams.ts
    var SIMPLE = [
        'The cat sat on the mat. ' +
        'Why did the cat sit on the mat? ' +
        'The cat sat on the mat maybe because she liked the warmth, ' +
        'or maybe it was the view.',
    ];
    var UNUSUAL_PUNCTUATION = [
        'This . Is . Okay ? 5 ! 4! !3! 2! !1',
    ];

    // the multidoc-*.json fixtures were generated from these, using the
    //  server's countNgrams(). they include n-grams that would cross from
    //  one document to the next, numbers that the server sorted ahead of
    //  other tokens with the same count, empty and one-word documents
    var MULTIPLE_DOCUMENTS = [
        'The cat sat on the mat. The cat ran away!',
        'A dog sat on the mat? The dog barked at the cat.',
        'Room 101 is next to room 10 and room 2. It\'s the cat\'s room, and it\'s 007\'s room too.',
        'Привет мир. Привет кот. Ёлка и кот.',
        '',
        'mat',
        'the cat',
        'The cat sat on the mat. The cat sat on the mat. The dog sat on the cat.',
    ];

    function fetchFixture(filename) {
        return fetch(FIXTURES + filename).then(function (resp) {
            return filename.endsWith('.json') ? resp.json() : resp.text();
        });
    }

    // every context in a server lookup table, with the server's result for it
    function allContexts(lookupTable, depth, prefix, out) {
        Object.keys(lookupTable).forEach(function (token) {
            var entry = lookupTable[token];
            if (depth === 0) {
                out.push({ context : prefix.concat(token), expected : { count : entry.count, next : entry.next } });
            }
            else {
                allContexts(entry.next, depth - 1, prefix.concat(token), out);
            }
        });
        return out;
    }

    function expectSameAsServer(input, n, fixtureFile) {
        return fetchFixture(fixtureFile).then(function (expected) {
            var model = ngramsService.createModel(input);

            expect(model.count(n)).toBe(expected.count);
            expect(model.summary(n)).toEqual(expected.summary);

            var contexts = allContexts(expected.lookup, n - 2, [], []);
            expect(contexts.length).toBeGreaterThan(0);
            var different = contexts.filter(function (c) {
                return JSON.stringify(model.lookup(c.context)) !== JSON.stringify(c.expected);
            }).map(function (c) { return c.context; });
            expect(different).toEqual([]);
        });
    }

    function readStories(filenames) {
        return Promise.all(filenames.map(fetchFixture));
    }


    describe('same results as the server', function () {

        it('bigrams from a short string', function () {
            return expectSameAsServer(SIMPLE, 2, 'simple-bigram.json');
        });
        it('trigrams from a short string', function () {
            return expectSameAsServer(SIMPLE, 3, 'simple-trigram.json');
        });
        it('tetragrams from a short string', function () {
            return expectSameAsServer(SIMPLE, 4, 'simple-tetragram.json');
        });

        it('bigrams with unusual punctuation', function () {
            return expectSameAsServer(UNUSUAL_PUNCTUATION, 2, 'unusual-bigram.json');
        });

        var SIZES = [ [ 2, 'bigram' ], [ 3, 'trigram' ], [ 4, 'tetragram' ] ];

        [ 'bohemia', 'boscombe', 'identity', 'twistedlip' ].forEach(function (story) {
            SIZES.forEach(function (size) {
                it(size[1] + 's from holmes-' + story, function () {
                    return readStories([ 'holmes-' + story + '.txt' ]).then(function (input) {
                        return expectSameAsServer(input, size[0], story + '-' + size[1] + '.json');
                    });
                });
            });
        });

        SIZES.forEach(function (size) {
            it(size[1] + 's from multiple documents', function () {
                return expectSameAsServer(MULTIPLE_DOCUMENTS, size[0], 'multidoc-' + size[1] + '.json');
            });
        });

        // the identity-paragraphs-*.json fixtures were generated from
        //  holmes-identity.txt with each paragraph as a separate document
        SIZES.forEach(function (size) {
            it(size[1] + 's from holmes-identity with each paragraph as a document', function () {
                return readStories([ 'holmes-identity.txt' ]).then(function (input) {
                    var paragraphs = input[0].split(/\n\s*\n/);
                    expect(paragraphs.length).toBe(139);
                    return expectSameAsServer(paragraphs, size[0], 'identity-paragraphs-' + size[1] + '.json');
                });
            });
        });

    });


    // ===================================================================
    // other behaviour
    // ===================================================================

    describe('createModel', function () {

        it('handles an empty corpus', function () {
            var model = ngramsService.createModel([]);

            expect(model.count(2)).toBe(0);
            expect(model.summary(2)).toEqual([]);
            expect(model.lookup([ 'hello' ])).toEqual({ count : 0, next : [] });
        });

        it('is empty if the corpus is too small to make any n-grams', function () {
            expect(ngramsService.createModel([]).isEmpty()).toBe(true);
            expect(ngramsService.createModel([ '' ]).isEmpty()).toBe(true);
            expect(ngramsService.createModel([ 'hello', 'world', '!' ]).isEmpty()).toBe(true);

            expect(ngramsService.createModel([ 'hello world' ]).isEmpty()).toBe(false);
            expect(ngramsService.createModel([ 'hello', 'world!' ]).isEmpty()).toBe(false);
        });

        it('does not make n-grams that cross from one document to the next', function () {
            var model = ngramsService.createModel([ 'one two', 'three four' ]);

            expect(model.count(2)).toBe(2);
            expect(model.count(3)).toBe(0);
            expect(model.lookup([ 'two' ])).toEqual({ count : 0, next : [] });
        });

        it('finds no next tokens for a word that is not in the corpus', function () {
            var model = ngramsService.createModel([ 'the cat sat on the mat' ]);

            expect(model.lookup([ 'dog' ])).toEqual({ count : 0, next : [] });
            expect(model.lookup([ 'the', 'dog' ])).toEqual({ count : 0, next : [] });
        });

        it('counts words that are also names of JavaScript object properties', function () {
            // these made the server's countNgrams() throw an exception
            var model = ngramsService.createModel([ 'the constructor of the house toString is here' ]);

            expect(model.lookup([ 'the' ])).toEqual({ count : 2, next : [
                { token : 'constructor', count : 1, prob : 0.5, cumprob : 0.5 },
                { token : 'house', count : 1, prob : 0.5, cumprob : 1 }
            ] });
            expect(model.lookup([ 'constructor', 'of' ]).next[0].token).toBe('the');
            expect(model.lookup([ 'toString' ]).next[0].token).toBe('is');
            expect(model.lookup([ 'hasOwnProperty' ])).toEqual({ count : 0, next : [] });
        });

        it('sorts tokens with the same count with numbers first, then in the order they first appear', function () {
            var model = ngramsService.createModel([ 'x b x 2 x a x 1' ]);

            expect(model.lookup([ 'x' ]).next.map(function (t) { return t.token; }))
                .toEqual([ '1', '2', 'b', 'a' ]);
        });

        it('returns the same summary object each time', function () {
            var model = ngramsService.createModel([ 'the cat sat on the mat' ]);

            expect(model.summary(2)).toBe(model.summary(2));
            expect(model.summary(2)).not.toBe(model.summary(3));
        });

    });
});
