describe('LanguageModelController - toy model generation', function () {

    var $controller;
    var $q;
    var $rootScope;
    var $scope;

    var authServiceMock, projectsServiceMock, trainingServiceMock,
        wikipediaServiceMock, weatherServiceMock, languageModelServiceMock, txtServiceMock,
        utilServiceMock, loggerServiceMock, $mdDialogMock, $windowMock, $timeoutReal;
    var $stateParams;

    var profile;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_, _$timeout_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
        $timeoutReal = _$timeout_;
        $scope = $rootScope.$new();
    }));

    beforeEach(function () {
        profile = { user_id : 'user1', tenant : 'class1', role : 'student' };

        authServiceMock = {
            getProfileDeferred : jasmine.createSpy('getProfileDeferred').and.returnValue($q.resolve(profile))
        };

        projectsServiceMock = jasmine.createSpyObj('projectsService', [
            'getProject', 'setLanguageModelType',
            'storeSmallLanguageModelConfig', 'storeToyLanguageModelConfig'
        ]);

        trainingServiceMock = jasmine.createSpyObj('trainingService', [
            'getTraining', 'retrieveAsset', 'newTrainingData', 'bulkAddTrainingData',
            'deleteTrainingData', 'storeAsset'
        ]);
        trainingServiceMock.getTraining.and.returnValue($q.resolve([]));

        wikipediaServiceMock = jasmine.createSpyObj('wikipediaService', ['searchByTitle']);
        weatherServiceMock = jasmine.createSpyObj('weatherService', ['getCurrentWeather']);

        languageModelServiceMock = jasmine.createSpyObj('languageModelService', [
            'generateNgrams', 'getSupportedModels', 'getAllModels', 'getModelDetails'
        ]);
        languageModelServiceMock.getSupportedModels.and.returnValue($q.resolve([]));
        languageModelServiceMock.getAllModels.and.returnValue([]);

        txtServiceMock = jasmine.createSpyObj('txtService', ['getContents']);

        utilServiceMock = jasmine.createSpyObj('utilService', ['loadWebLlmProjectSupport']);
        utilServiceMock.loadWebLlmProjectSupport.and.returnValue($q.resolve({ MLCEngine : function () {} }));

        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error']);

        $mdDialogMock = jasmine.createSpyObj('$mdDialog', ['show', 'hide', 'cancel']);

        $windowMock = jasmine.createSpyObj('$window', ['scrollTo']);

        $stateParams = { projectId : 'project1', userId : 'user1' };
    });

    function createController() {
        return $controller('LanguageModelController', {
            authService : authServiceMock,
            projectsService : projectsServiceMock,
            trainingService : trainingServiceMock,
            wikipediaService : wikipediaServiceMock,
            weatherService : weatherServiceMock,
            languageModelService : languageModelServiceMock,
            txtService : txtServiceMock,
            utilService : utilServiceMock,
            loggerService : loggerServiceMock,
            $mdDialog : $mdDialogMock,
            $stateParams : $stateParams,
            $scope : $scope,
            $window : $windowMock,
            $timeout : $timeoutReal,
            $q : $q
        });
    }

    function digestTwice() {
        $rootScope.$digest();
        $rootScope.$digest();
    }

    function baseProject(overrides) {
        return angular.extend({ id : 'project1', userid : 'user1', classid : 'class1', type : 'text' }, overrides || {});
    }

    function createReadyController(project) {
        projectsServiceMock.getProject.and.returnValue($q.resolve(project));
        var vm = createController();
        digestTwice();
        return vm;
    }

    // a full bigram/trigram/tetragram fixture, structured exactly as
    // src/lib/utils/ngrams.ts's countNgrams() would produce it (verified
    // against the real code - see the file banner comment above)
    function fullNgramsFixture() {
        return {
            bigrams : {
                count : 7,
                lookup : {
                    cat : { count : 4, next : [
                        { token : 'sat', count : 3, prob : 0.75, cumprob : 0.75 },
                        { token : 'ran', count : 1, prob : 0.25, cumprob : 1.0 }
                    ] },
                    sat : { count : 3, next : [ { token : '<STOP>', count : 3, prob : 1, cumprob : 1 } ] },
                    dog : { count : 3, next : [ { token : 'barked', count : 3, prob : 1, cumprob : 1 } ] },
                    barked : { count : 3, next : [ { token : '<STOP>', count : 3, prob : 1, cumprob : 1 } ] }
                    // 'ran' and '<STOP>' deliberately absent as keys, so
                    // lookupBigrams() for them falls back to {count:0, next:[]}
                },
                summary : [
                    { token : 'cat', count : 4, prob : 0.57, cumprob : 0.57, next : [
                        { token : 'sat', count : 3, prob : 0.75, cumprob : 0.75, next : [] },
                        { token : 'ran', count : 1, prob : 0.25, cumprob : 1.0, next : [] }
                    ] },
                    { token : 'dog', count : 3, prob : 0.43, cumprob : 1.0, next : [
                        { token : 'barked', count : 3, prob : 1.0, cumprob : 1.0, next : [] }
                    ] }
                ]
            },
            trigrams : {
                count : 2,
                lookup : {
                    the : { count : 2, next : {
                        cat : { count : 2, next : [ { token : 'sat', count : 2, prob : 1, cumprob : 1 } ] }
                    } }
                },
                summary : [
                    { token : 'the', count : 2, prob : 1, cumprob : 1, next : [
                        { token : 'cat', count : 2, prob : 1, cumprob : 1, next : [
                            { token : 'sat', count : 2, prob : 1, cumprob : 1, next : [] }
                        ] }
                    ] }
                ]
            },
            tetragrams : {
                count : 1,
                lookup : {
                    i : { count : 1, next : {
                        love : { count : 1, next : {
                            cats : { count : 1, next : [ { token : 'today', count : 1, prob : 1, cumprob : 1 } ] }
                        } }
                    } }
                },
                summary : [
                    { token : 'i', count : 1, prob : 1, cumprob : 1, next : [
                        { token : 'love', count : 1, prob : 1, cumprob : 1, next : [
                            { token : 'cats', count : 1, prob : 1, cumprob : 1, next : [
                                { token : 'today', count : 1, prob : 1, cumprob : 1, next : [] }
                            ] }
                        ] }
                    ] }
                ]
            }
        };
    }

    // brings a toy controller from a fresh project all the way to
    // TOY.TOKENS, with analyzedCorpus populated from the given fixture
    function createTokenizedController(ngrams, fixture) {
        trainingServiceMock.getTraining.and.returnValue($q.resolve([ { id : 'd1', title : 'Doc', type : 'text' } ]));
        trainingServiceMock.retrieveAsset.and.returnValue($q.reject({ status : 404 }));
        var vm = createReadyController(baseProject({ modeltype : 'toy', toy : { ngrams : 0, temperature : 1, topp : 1 } }));

        $scope.project.toy.ngrams = ngrams;
        languageModelServiceMock.generateNgrams.and.returnValue($q.resolve(fixture));
        $scope.initTokens();
        digestTwice();

        return vm;
    }


    describe('confirmCorpus', function () {

        it('moves to the context-window phase', function () {
            createReadyController(baseProject({ modeltype : 'toy' }));

            $scope.confirmCorpus();

            expect($scope.phase).toBe($scope.PHASES.TOY.CONTEXTWINDOW);
        });

    });


    describe('changeNgramSize', function () {

        it('cycles 0 -> 1 -> 2 -> 3 -> 1', function () {
            createReadyController(baseProject({ modeltype : 'toy', toy : { ngrams : 0, temperature : 1, topp : 1 } }));

            $scope.changeNgramSize();
            expect($scope.project.toy.ngrams).toBe(1);
            $scope.changeNgramSize();
            expect($scope.project.toy.ngrams).toBe(2);
            $scope.changeNgramSize();
            expect($scope.project.toy.ngrams).toBe(3);
            $scope.changeNgramSize();
            expect($scope.project.toy.ngrams).toBe(1);
        });

        it('does not touch tokens if none have been displayed yet', function () {
            createReadyController(baseProject({ modeltype : 'toy', toy : { ngrams : 0, temperature : 1, topp : 1 } }));

            $scope.changeNgramSize();

            expect($scope.project.toy.tokens).toBeUndefined();
        });

        it('switches the displayed tokens to match the new ngram size', function () {
            var fixture = fullNgramsFixture();
            createTokenizedController(1, fixture);

            expect($scope.project.toy.tokens).toBe(fixture.bigrams.summary);

            $scope.changeNgramSize();

            expect($scope.project.toy.ngrams).toBe(2);
            expect($scope.project.toy.tokens).toBe(fixture.trigrams.summary);
        });

        it('clears stale selection state when cycling back to a previously-visited ngram size', function () {
            var fixture = fullNgramsFixture();
            createTokenizedController(1, fixture);
            var cat = fixture.bigrams.summary[0];
            var dog = fixture.bigrams.summary[1];
            // simulate the user having selected the non-default token, rather
            // than leaving the default (top-ranked) selection from initTokens
            $scope.toggleToken(dog, fixture.bigrams.summary, [ 'dog' ]);
            expect(dog.selected).toBe(true);
            expect(cat.selected).toBe(false);

            $scope.changeNgramSize(); // -> 2 (trigrams)
            $scope.changeNgramSize(); // -> 3 (tetragrams)
            $scope.changeNgramSize(); // -> 1 (back to bigrams - same object references)

            // back on bigrams, selectFirstToken() re-selects the default
            // (highest-count) token - dog's stale selection must not persist
            expect($scope.project.toy.tokens).toBe(fixture.bigrams.summary);
            expect(dog.selected).toBe(false);
            expect(cat.selected).toBe(true);
        });

        it('shows a warning and does not crash when the new ngram size has no tokens', function () {
            var fixture = fullNgramsFixture();
            fixture.trigrams.summary = [];
            var vm = createTokenizedController(1, fixture);

            $scope.changeNgramSize(); // -> 2 (trigrams, now empty)
            digestTwice(); // displayAlert's push happens inside $applyAsync

            expect(vm.warnings.length).toBe(1);
            expect(vm.warnings[0].message).toBe('Please add more text to your corpus');
        });

    });


    describe('initTokens', function () {

        it('parses the corpus and moves to the tokens phase', function () {
            var fixture = fullNgramsFixture();
            var vm = createTokenizedController(1, fixture);

            expect(languageModelServiceMock.generateNgrams).toHaveBeenCalled();
            expect($scope.phase).toBe($scope.PHASES.TOY.TOKENS);
            expect($scope.project.toy.tokens).toBe(fixture.bigrams.summary);
            expect($scope.loading).toBe(false);
            expect(vm.errors.length).toBe(0);
        });

        it('does not re-parse the corpus if it has already been analyzed', function () {
            var fixture = fullNgramsFixture();
            createTokenizedController(1, fixture);
            languageModelServiceMock.generateNgrams.calls.reset();
            trainingServiceMock.getTraining.calls.reset();

            $scope.initTokens();
            digestTwice();

            expect(languageModelServiceMock.generateNgrams).not.toHaveBeenCalled();
            expect(trainingServiceMock.getTraining).not.toHaveBeenCalled();
            expect($scope.phase).toBe($scope.PHASES.TOY.TOKENS);
        });

        it('shows an error and stops loading if parsing the corpus fails', function () {
            // starts with an empty corpus so the initial restore (which also
            // calls getTraining) succeeds cleanly, before wiring the failure
            // for the explicit initTokens() call under test
            var vm = createReadyController(baseProject({ modeltype : 'toy', toy : { ngrams : 1, temperature : 1, topp : 1 } }));

            trainingServiceMock.getTraining.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));
            $scope.initTokens();
            digestTwice();

            expect(vm.errors.length).toBe(1);
            expect($scope.loading).toBe(false);
        });

    });


    describe('toggleToken', function () {

        it('selects a token and deselects its siblings', function () {
            var fixture = fullNgramsFixture();
            createTokenizedController(1, fixture);
            var cat = fixture.bigrams.summary[0];
            var dog = fixture.bigrams.summary[1];
            // initial state from initTokens' selectFirstToken: cat selected
            expect(cat.selected).toBe(true);

            $scope.toggleToken(dog, fixture.bigrams.summary, [ 'dog' ]);

            expect(dog.selected).toBe(true);
            expect(cat.selected).toBe(false);
        });

        it('deselects a token (and its children) when clicked while already selected', function () {
            var fixture = fullNgramsFixture();
            createTokenizedController(1, fixture);
            var cat = fixture.bigrams.summary[0];
            var sat = cat.next[0];
            sat.selected = true;

            $scope.toggleToken(cat, fixture.bigrams.summary, [ 'cat' ]);

            expect(cat.selected).toBe(false);
            expect(sat.selected).toBe(false);
        });

        it('sets confirmTokens once the full ngram-sized chain is selected', function () {
            var fixture = fullNgramsFixture();
            createTokenizedController(1, fixture);
            var cat = fixture.bigrams.summary[0];
            var sat = cat.next[0];
            // initTokens' own selectFirstToken walk (2 levels deep for
            // ngrams=1 in the TOKENS phase) already selected 'sat' - reset
            // to a clean unselected state so this test simulates a fresh click
            sat.selected = false;

            // selecting the full chain (parents.length === ngrams + 1 === 2)
            $scope.toggleToken(sat, cat.next, [ 'cat', 'sat' ]);

            expect($scope.confirmTokens).toEqual({ text : combineTokensExpected([ 'cat', 'sat' ]), count : sat.count });
        });

        it('does not set confirmTokens for a partial selection', function () {
            var fixture = fullNgramsFixture();
            createTokenizedController(2, fixture); // ngrams=2, needs a 3-deep chain
            $scope.confirmTokens = undefined;
            var the = fixture.trigrams.summary[0];

            $scope.toggleToken(the, fixture.trigrams.summary, [ 'the' ]);

            expect($scope.confirmTokens).toBeUndefined();
        });

        function combineTokensExpected(tokens) {
            // mirrors combineTokens()/shouldMerge() for tokens with no
            // merge-characters, i.e. every token gets a leading space
            // except the very first (reduce with no initial value uses
            // tokens[0] as the seed without processing it)
            return tokens.reduce(function (acc, next, idx) {
                if (idx === 0) { return next; }
                return acc + ' ' + next;
            });
        }

    });


    describe('highlightToken', function () {

        it('does nothing if the token is already selected', function () {
            var fixture = fullNgramsFixture();
            createTokenizedController(1, fixture);
            var cat = fixture.bigrams.summary[0];
            expect(cat.selected).toBe(true);
            spyOn($scope, 'toggleToken');

            $scope.highlightToken(true, 0, cat, fixture.bigrams.summary, [ 'cat', '' ]);

            expect($scope.toggleToken).not.toHaveBeenCalled();
        });

        it('does nothing at the deepest (ngrams) depth', function () {
            createTokenizedController(1, fullNgramsFixture());
            spyOn($scope, 'toggleToken');

            $scope.highlightToken(false, 1, {}, [], []);

            expect($scope.toggleToken).not.toHaveBeenCalled();
        });

        it('selects the token and recomputes probabilities one level above the deepest depth', function () {
            var fixture = fullNgramsFixture();
            createTokenizedController(1, fixture);
            var dog = fixture.bigrams.summary[1];
            spyOn($scope, 'recomputeProbabilities').and.callThrough();

            $scope.highlightToken(false, 0, dog, fixture.bigrams.summary, [ 'dog', '' ]);

            expect(dog.selected).toBe(true);
            expect($scope.recomputeProbabilities).toHaveBeenCalled();
            // dog's only continuation ('barked') should now have a computed viz
            expect(dog.next[0].viz).toBe(100);
        });

        it('selects the token but does not recompute above the ngrams-1 depth', function () {
            var fixture = fullNgramsFixture();
            createTokenizedController(2, fixture); // ngrams=2
            var the = fixture.trigrams.summary[0];
            // initTokens' own selectFirstToken walk already selected 'the' -
            // reset to a clean, deliberately-unselected state so this test
            // isolates the depth condition rather than the "already selected" one
            the.selected = false;
            spyOn($scope, 'recomputeProbabilities').and.callThrough();

            $scope.highlightToken(false, 0, the, fixture.trigrams.summary, [ 'the', '' ]);

            expect(the.selected).toBe(true);
            // depth 0 !== ngrams-1 (1), so no recompute triggered by this click
            expect($scope.recomputeProbabilities).not.toHaveBeenCalled();
        });

    });


    describe('initToyModelTemperature', function () {

        it('moves to the temperature phase and recomputes probabilities', function () {
            var fixture = fullNgramsFixture();
            createTokenizedController(1, fixture);

            $scope.initToyModelTemperature();

            expect($scope.phase).toBe($scope.PHASES.TOY.TEMPERATURE);
            expect($scope.loading).toBe(false);
            // cat's children should now have computed viz percentages
            expect(fixture.bigrams.summary[0].next[0].viz).toBe(75);
            expect(fixture.bigrams.summary[0].next[1].viz).toBe(25);
        });

    });


    describe('recomputeProbabilities', function () {

        it('does nothing when there is no token selected for recompute', function () {
            createReadyController(baseProject({ modeltype : 'toy', toy : { ngrams : 0, temperature : 1, topp : 1 } }));

            expect(function () { $scope.recomputeProbabilities(); }).not.toThrow();
        });

        it('scales probabilities by temperature (lower temperature sharpens the distribution)', function () {
            var fixture = fullNgramsFixture();
            createTokenizedController(1, fixture);
            // in the TOKENS phase, selectFirstToken() walks 2 levels deep for
            // ngrams=1 (down to the leaf 'sat'), so tokenToRecompute would be
            // 'sat' (with no children) rather than 'cat'; initToyModelTemperature()
            // re-walks with the TEMPERATURE-phase depth (1 level), landing
            // tokenToRecompute on 'cat' - whose children are what we want to check
            $scope.initToyModelTemperature();
            $scope.project.toy.temperature = 0.5;

            $scope.recomputeProbabilities();

            // count^(1/0.5) = count^2 -> sat: 9, ran: 1 -> 90% / 10%
            expect(fixture.bigrams.summary[0].next[0].viz).toBe(90);
            expect(fixture.bigrams.summary[0].next[1].viz).toBe(10);
        });

        it('zeroes out candidates above the top-p cutoff', function () {
            var fixture = fullNgramsFixture();
            createTokenizedController(1, fixture);
            $scope.initToyModelTemperature();
            $scope.project.toy.topp = 0.75; // excludes 'ran' (cumprob 1.0), keeps 'sat' (cumprob 0.75)

            $scope.recomputeProbabilities();

            expect(fixture.bigrams.summary[0].next[0].viz).toBe(100); // sat: only candidate left, gets 100%
            expect(fixture.bigrams.summary[0].next[1].viz).toBe(0);   // ran: excluded by top-p
        });

        it('rounds a sub-1% share down to 0', function () {
            var fixture = fullNgramsFixture();
            fixture.bigrams.summary[0].next = [
                { token : 'sat', count : 999, cumprob : 0.5, next : [] },
                { token : 'ran', count : 1, cumprob : 1.0, next : [] }
            ];
            createTokenizedController(1, fixture);
            $scope.initToyModelTemperature();

            $scope.recomputeProbabilities();

            expect(fixture.bigrams.summary[0].next[1].viz).toBe(0);
        });

    });


    describe('shouldMerge', function () {

        it('merges possessive/contraction and full-stop tokens', function () {
            createReadyController(baseProject());
            expect($scope.shouldMerge("'s")).toBe(true);
            expect($scope.shouldMerge("'d")).toBe(true);
            expect($scope.shouldMerge('.')).toBe(true);
        });

        it('does not merge ordinary words', function () {
            createReadyController(baseProject());
            expect($scope.shouldMerge('cat')).toBe(false);
            expect($scope.shouldMerge('<STOP>')).toBe(false);
        });

    });


    describe('setHoverToken', function () {

        it('sets hovertoken/hoverexplain for a generated token', function () {
            createReadyController(baseProject({ modeltype : 'toy' }));
            $scope.generatedtokens = [
                { idx : 0, text : 'cat', prompt : true },
                { idx : 1, text : 'sat', token : 'sat', count : 3, options : 4 }
            ];

            $scope.setHoverToken(1);

            expect($scope.hovertoken).toBe(1);
            expect($scope.hoverexplain).toBe($scope.generatedtokens[1]);
        });

        it('ignores hovering over a prompt word', function () {
            createReadyController(baseProject({ modeltype : 'toy' }));
            $scope.generatedtokens = [ { idx : 0, text : 'cat', prompt : true } ];

            $scope.setHoverToken(0);

            expect($scope.hovertoken).toBeUndefined();
            expect($scope.hoverexplain).toBeUndefined();
        });

    });


    describe('testModel (toy language model generation)', function () {

        function readyForTesting(ngrams, fixture) {
            var vm = createTokenizedController(ngrams, fixture);
            $scope.initToyModelTemperature();
            projectsServiceMock.storeToyLanguageModelConfig.and.returnValue($q.resolve(
                angular.extend({}, $scope.project, { toy : angular.extend({}, $scope.project.toy) })
            ));
            $scope.setProjectReady();
            digestTwice();
            return vm;
        }

        // useToyLanguageModel() is declared `async function`, so testModel()'s
        // submitFn.then()/.catch() chain hangs off a native Promise, not a $q
        // one - $rootScope.$digest() alone never flushes that (see
        // FRONTEND_TESTING.md's "native Promise vs $q" trap). Settling it
        // fully takes *two* separate microtask hops: one for $q's own
        // digest-driven resolution of the value the async function returns,
        // and another for the native-Promise wrapper to then propagate that
        // on to testModel()'s .then()/.catch(). A single flush+digest isn't
        // reliably enough, so this alternates a few rounds of "wait for a
        // macrotask boundary (which only runs once all pending microtasks
        // have drained), then digest" to cover however many hops are needed.
        function flushAsyncGeneration() {
            function round(n) {
                if (n <= 0) { return Promise.resolve(); }
                return new Promise(function (resolve) { setTimeout(resolve, 0); })
                    .then(function () {
                        $rootScope.$digest();
                        return round(n - 1);
                    });
            }
            return round(4);
        }

        it('does nothing for an empty prompt', function () {
            readyForTesting(1, fullNgramsFixture());
            $scope.prompt.message = '   ';

            $scope.testModel();

            expect($scope.generating).toBeUndefined();
        });

        it('does nothing while already generating, loading, or reconfiguring', function () {
            readyForTesting(1, fullNgramsFixture());
            $scope.prompt.message = 'cat';

            $scope.generating = true;
            $scope.testModel();
            expect($scope.generatedtokens).toEqual([]);
        });

        it('shows feedback when the prompt has fewer words than the context window size', async function () {
            readyForTesting(2, fullNgramsFixture()); // ngrams=2, needs 2 prompt words
            $scope.prompt.message = 'cat';

            $scope.testModel();
            await flushAsyncGeneration();

            expect($scope.testfeedbackmoretokens).toBe(true);
            expect($scope.testfeedbacknomatch).toBe(false);
            expect($scope.generating).toBe(false);
            expect($scope.textgenerated).toBe(true);
        });

        it('shows feedback when there is no match for the prompt in the corpus', async function () {
            readyForTesting(1, fullNgramsFixture());
            $scope.prompt.message = 'elephant';

            $scope.testModel();
            await flushAsyncGeneration();

            expect($scope.testfeedbacknomatch).toBe(true);
            expect($scope.testfeedbackmoretokens).toBe(false);
        });

        it('rejects (via the model-not-ready guard) if the toy model is not marked ready, and resets generating so the user can try again', async function () {
            var vm = createTokenizedController(1, fullNgramsFixture());
            // deliberately skip setProjectReady - toy.ready stays falsy
            $scope.prompt.message = 'cat';

            $scope.testModel();
            await flushAsyncGeneration();

            expect(vm.errors.length).toBe(1);
            // regression: toy model failures are recoverable client-side logic
            // errors, not engine crashes, so generating must be reset - unlike
            // the small-model failure path (see languagemodel.controller.slmtesting.spec.js)
            expect($scope.generating).toBe(false);
        });

        it('generates bigram tokens deterministically, stopping at the natural end of the corpus', async function () {
            readyForTesting(1, fullNgramsFixture());
            $scope.prompt.message = 'cat';
            spyOn(Math, 'random').and.returnValues(0.5, 0.1);

            $scope.testModel();
            await flushAsyncGeneration();

            expect($scope.generatedtokens).toEqual([
                { idx : 0, text : '', prompt : true },
                { idx : 1, text : 'cat', prompt : true },
                { idx : 2, text : 'sat', token : 'sat', count : 3, prob : 75, options : 4, candidates : 2, input : 'cat' },
                { idx : 3, text : '.', token : '<STOP>', count : 3, prob : 100, options : 3, candidates : 1, input : 'sat' }
            ]);
            expect($scope.generating).toBe(false);
            expect($scope.textgenerated).toBe(true);
            // unlike the small-model path, the toy model does not clear the prompt box
            expect($scope.prompt.message).toBe('cat');
        });

        it('forces the top candidate when top-p excludes everything (avoids an unhandled crash)', async function () {
            readyForTesting(1, fullNgramsFixture());
            $scope.project.toy.topp = 0.01; // lower than every candidate's cumprob
            $scope.prompt.message = 'cat';
            spyOn(Math, 'random').and.returnValues(0.1, 0.1);

            $scope.testModel();
            await flushAsyncGeneration();

            expect($scope.generatedtokens.map(function (t) { return t.token; })).toEqual([ undefined, undefined, 'sat', '<STOP>' ]);
        });

        it('generates trigram tokens using two-token lookups', async function () {
            readyForTesting(2, fullNgramsFixture());
            $scope.prompt.message = 'the cat';
            spyOn(Math, 'random').and.returnValue(0.1);

            $scope.testModel();
            await flushAsyncGeneration();

            expect($scope.generatedtokens).toEqual([
                { idx : 0, text : '', prompt : true },
                { idx : 1, text : 'the cat', prompt : true },
                { idx : 2, text : 'sat', token : 'sat', count : 2, prob : 100, options : 2, candidates : 1, input : 'the cat' }
            ]);
        });

        it('generates tetragram tokens using three-token lookups', async function () {
            readyForTesting(3, fullNgramsFixture());
            $scope.prompt.message = 'i love cats';
            spyOn(Math, 'random').and.returnValue(0.1);

            $scope.testModel();
            await flushAsyncGeneration();

            expect($scope.generatedtokens).toEqual([
                { idx : 0, text : '', prompt : true },
                { idx : 1, text : 'i love cats', prompt : true },
                { idx : 2, text : 'today', token : 'today', count : 1, prob : 100, options : 1, candidates : 1, input : 'i love cats' }
            ]);
        });

        it('only uses the most recent ngram-sized window of a longer prompt', async function () {
            readyForTesting(1, fullNgramsFixture());
            $scope.prompt.message = 'once upon a time there was a cat';
            spyOn(Math, 'random').and.returnValues(0.5, 0.1);

            $scope.testModel();
            await flushAsyncGeneration();

            expect($scope.generatedtokens[0].text).toBe('once upon a time there was a');
            expect($scope.generatedtokens[1].text).toBe('cat');
            expect($scope.generatedtokens[2].token).toBe('sat');
        });

        it('collapses repeated whitespace in the prompt', async function () {
            readyForTesting(1, fullNgramsFixture());
            $scope.prompt.message = '   cat   ';
            spyOn(Math, 'random').and.returnValues(0.5, 0.1);

            $scope.testModel();
            await flushAsyncGeneration();

            expect($scope.testfeedbackmoretokens).toBe(false);
            expect($scope.generatedtokens[1].text).toBe('cat');
        });

        it('caps generation at MAX_LENGTH for a self-looping corpus', async function () {
            var loopFixture = {
                bigrams : {
                    count : 10,
                    lookup : {
                        loop : { count : 10, next : [ { token : 'loop', count : 10, prob : 1, cumprob : 1 } ] }
                    },
                    summary : [
                        { token : 'loop', count : 10, prob : 1, cumprob : 1, next : [
                            { token : 'loop', count : 10, prob : 1, cumprob : 1, next : [] }
                        ] }
                    ]
                },
                trigrams : { count : 0, lookup : {}, summary : [] },
                tetragrams : { count : 0, lookup : {}, summary : [] }
            };
            readyForTesting(1, loopFixture);
            $scope.prompt.message = 'loop';
            spyOn(Math, 'random').and.returnValue(0.1);

            $scope.testModel();
            await flushAsyncGeneration();

            expect($scope.generatedtokens.length).toBe(500);
        });

    });

});
