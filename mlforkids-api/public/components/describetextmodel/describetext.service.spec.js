describe('describeTextService', function () {

    var describeTextService;
    var utilServiceMock;
    var $rootScope;
    var $q;

    beforeEach(module('app'));

    beforeEach(module(function ($provide) {
        // compromise is loaded by karma.conf.js, so the lazy loading
        //  only needs to resolve
        utilServiceMock = jasmine.createSpyObj('utilService', ['loadScript']);
        $provide.value('utilService', utilServiceMock);
        $provide.value('loggerService', jasmine.createSpyObj('loggerService', [ 'debug' ]));
    }));

    beforeEach(inject(function (_describeTextService_, _$rootScope_, _$q_) {
        describeTextService = _describeTextService_;
        $rootScope = _$rootScope_;
        $q = _$q_;
        utilServiceMock.loadScript.and.returnValue($q.resolve());
    }));


    function describe_(project, training) {
        var result;
        var error;
        describeTextService.describeTraining(project, training)
            .then(function (r) { result = r; })
            .catch(function (e) { error = e; });
        $rootScope.$digest();
        if (error) {
            throw error;
        }
        return result;
    }

    function trainingItems(examples) {
        return examples.map(function (example, idx) {
            return { id : 'id' + String(idx).padStart(4, '0'), label : example.label, textdata : example.textdata };
        });
    }

    function feature(example, annotation) {
        return example.customfeatures.find(function (f) {
            return f.annotation === annotation;
        }).value;
    }

    function bagOfWords(example) {
        return example.bagofwords.map(function (b) {
            var word = b.annotation.match(/"(.*)"/)[1].toLowerCase();
            return { word : word, count : b.value };
        });
    }


    describe('loading compromise', function () {

        it('loads compromise before compromise-speech', function () {
            describe_({ labels : [ 'a' ] }, trainingItems([ { label : 'a', textdata : 'hello' } ]));

            expect(utilServiceMock.loadScript.calls.allArgs()).toEqual([
                [ '/static/bower_components/compromise/compromise.min.js' ],
                [ '/static/bower_components/compromise-speech/compromise-speech.min.js' ]
            ]);
        });

        it('rejects if the scripts fail to load', function () {
            utilServiceMock.loadScript.and.returnValue($q.reject('load failed'));

            expect(function () {
                describe_({ labels : [ 'a' ] }, trainingItems([ { label : 'a', textdata : 'hello' } ]));
            }).toThrow('load failed');
        });

    });


    // same inputs as the server tests in src/tests/training/describetext.ts
    describe('tiny project', function () {

        var project = { labels : [ 'first', 'second', 'third', 'fourth' ] };
        var trainingExamples = [
            { label : 'first', textdata : 'a' },
            { label : 'first', textdata : 'b' },
            { label : 'second', textdata : 'c' },
            { label : 'second', textdata : 'd' },
            { label : 'third', textdata : 'e' },
            { label : 'third', textdata : 'f' },
        ];
        var vizInfo;

        beforeEach(function () {
            vizInfo = describe_(project, trainingItems(trainingExamples));
        });

        it('returns all training examples', function () {
            expect(vizInfo.examples.length).toBe(trainingExamples.length);
        });

        it('interleaves the labels', function () {
            expect(vizInfo.examples.map(function (e) { return e.text; })).toEqual([ 'a', 'c', 'e', 'b', 'd', 'f' ]);
        });

        it('includes integer confidence scores for every label that sum to 100', function () {
            vizInfo.examples.forEach(function (example) {
                expect(Object.keys(example.output).sort()).toEqual([ 'first', 'fourth', 'second', 'third' ]);
                var total = 0;
                project.labels.forEach(function (label) {
                    expect(Number.isInteger(example.output[label])).toBe(true);
                    total += example.output[label];
                });
                expect(total).toBe(100);
            });
        });

        it('generates ten small integers for the random input layer', function () {
            var minimums = [ 1, 1, 0, 1, 0, 0, 0, 1, 0, 1 ];
            vizInfo.examples.forEach(function (example) {
                expect(example.random.length).toBe(10);
                example.random.forEach(function (r, idx) {
                    expect(r.annotation).toBe('');
                    expect(Number.isInteger(r.value)).toBe(true);
                    expect(r.value).toBeGreaterThanOrEqual(minimums[idx]);
                    expect(r.value).toBeLessThanOrEqual(5);
                });
            });
        });

        it('returns non-negative integer custom features, with some non-zero', function () {
            vizInfo.examples.forEach(function (example) {
                expect(example.customfeatures.length).toBe(9);
                var sum = 0;
                example.customfeatures.forEach(function (f) {
                    expect(Number.isInteger(f.value)).toBe(true);
                    expect(f.value).toBeGreaterThanOrEqual(0);
                    sum += f.value;
                });
                expect(sum).toBeGreaterThan(0);
                expect(feature(example, 'number of letters')).toBeGreaterThan(0);
            });
        });

        it('returns counts of ten different words for each example', function () {
            vizInfo.examples.forEach(function (example) {
                expect(example.bagofwords.length).toBe(10);
                var annotations = example.bagofwords.map(function (b) { return b.annotation; });
                expect(new Set(annotations).size).toBe(10);
                example.bagofwords.forEach(function (b) {
                    expect(b.annotation).toMatch(/^number of times that the word ".*" appears$/);
                    expect(Number.isInteger(b.value)).toBe(true);
                    expect(b.value).toBeGreaterThanOrEqual(0);
                });
            });
        });

    });


    // same inputs as the server tests in src/tests/training/describetext.ts
    describe('small project', function () {

        var USES_RIGHT_TWICE = 'this right one can be found on the right';
        var USES_EMOTICON = 'another right-side string :-)';

        var project = { labels : [ 'left', 'right' ] };
        var trainingExamples = [
            { label : 'left', textdata : 'Something on the left side!' },
            { label : 'left', textdata : 'another awesome thing is here on the LEFT' },
            { label : 'left', textdata : 'this is some sort of thing' },
            { label : 'left', textdata : 'a fourth left string' },
            { label : 'left', textdata : 'the final training item for the Left' },
            { label : 'right', textdata : USES_RIGHT_TWICE },
            { label : 'right', textdata : 'this string is also on the right' },
            { label : 'right', textdata : USES_EMOTICON },
            { label : 'right', textdata : 'This is on the RIGHT' },
            { label : 'right', textdata : 'a Right example for training?' },
        ];
        var vizInfo;

        beforeEach(function () {
            vizInfo = describe_(project, trainingItems(trainingExamples));
        });

        it('returns five examples per label', function () {
            expect(vizInfo.examples.length).toBe(10);
        });

        it('counts emoticons', function () {
            var example = vizInfo.examples.find(function (e) { return e.text === USES_EMOTICON; });
            expect(feature(example, 'number of emoticons')).toBe(1);
        });

        it('counts repeated words', function () {
            var example = vizInfo.examples.find(function (e) { return e.text === USES_RIGHT_TWICE; });
            expect(bagOfWords(example)).toContain({ word : 'right', count : 2 });
        });

    });


    describe('choosing examples', function () {

        it('uses the first five examples of each label, in alphabetical order', function () {
            var training = trainingItems([
                { label : 'cat', textdata : 'g' }, { label : 'cat', textdata : 'b' },
                { label : 'cat', textdata : 'f' }, { label : 'cat', textdata : 'a' },
                { label : 'cat', textdata : 'e' }, { label : 'cat', textdata : 'c' },
                { label : 'cat', textdata : 'd' },
                { label : 'dog', textdata : 'z' }, { label : 'dog', textdata : 'y' },
            ]);

            var vizInfo = describe_({ labels : [ 'cat', 'dog' ] }, training);

            expect(vizInfo.examples.map(function (e) { return e.label + ':' + e.text; })).toEqual([
                'cat:a', 'dog:y', 'cat:b', 'dog:z', 'cat:c', 'cat:d', 'cat:e'
            ]);
        });

        it('skips labels with no training examples', function () {
            var training = trainingItems([ { label : 'cat', textdata : 'meow' } ]);

            var vizInfo = describe_({ labels : [ 'cat', 'dog' ] }, training);

            expect(vizInfo.examples.map(function (e) { return e.text; })).toEqual([ 'meow' ]);
            expect(Object.keys(vizInfo.examples[0].output)).toEqual([ 'cat', 'dog' ]);
        });

        it('does not modify the training data it is given', function () {
            var training = trainingItems([
                { label : 'b', textdata : 'two' }, { label : 'a', textdata : 'one' },
            ]);
            var copy = JSON.parse(JSON.stringify(training));

            describe_({ labels : [ 'a', 'b' ] }, training);

            expect(training).toEqual(copy);
        });

        it('chooses the bag-of-words words from the first 1000 examples, ordered by label then id', function () {
            var training = [];
            // 1000 examples of 'a' - these are the only ones used to pick words
            for (var i = 0; i < 1000; i++) {
                training.push({ id : 'id' + String(i).padStart(4, '0'), label : 'a', textdata : 'apple' });
            }
            // label 'b' sorts after 'a', so these are ignored even though
            //  they come first in the list and use 'banana' more often
            var bananas = [];
            for (var j = 0; j < 1500; j++) {
                bananas.push({ id : 'id' + String(j).padStart(4, '0'), label : 'b', textdata : 'banana banana' });
            }

            var vizInfo = describe_({ labels : [ 'a', 'b' ] }, bananas.concat(training));

            var appleExample = vizInfo.examples.find(function (e) { return e.label === 'a'; });
            var words = bagOfWords(appleExample).map(function (w) { return w.word; });
            expect(words[0]).toBe('apple');
            expect(words).not.toContain('banana');

            // an example that doesn't use any of the chosen words still gets
            //  a couple of its own words added
            var bananaExample = vizInfo.examples.find(function (e) { return e.label === 'b'; });
            expect(bagOfWords(bananaExample)).toContain({ word : 'banana', count : 2 });
        });

    });


    // expected values are from the server's src/lib/utils/bagofwords.ts,
    //  using the inputs from src/tests/utils/bagofwords.ts
    describe('bag of words', function () {

        function describeOne(texts) {
            var training = trainingItems(texts.map(function (t) { return { label : 'x', textdata : t }; }));
            return describe_({ labels : [ 'x' ] }, training).examples;
        }

        it('counts the words in the training data, ignoring very common words', function () {
            var examples = describeOne([
                'This is a test',
                'Please verify that this works',
                'I want to test that this works and correctly verifies the count',
            ]);

            // examples are in alphabetical order: I want..., Please..., This...
            expect(bagOfWords(examples[2])).toEqual([
                { word : 'this', count : 1 },
                { word : 'test', count : 1 },
                { word : 'that', count : 0 },
                { word : 'works', count : 0 },
                { word : 'please', count : 0 },
                { word : 'verify', count : 0 },
                { word : 'i', count : 0 },
                { word : 'want', count : 0 },
                { word : 'to', count : 0 },
                { word : 'and', count : 0 },
            ]);
        });

        it('splits words on punctuation and drops partial words', function () {
            var examples = describeOne([
                'I\'d like to verify this hasn\'t allowed partial words through',
            ]);

            expect(bagOfWords(examples[0])).toEqual([
                { word : 'i', count : 1 },
                { word : 'like', count : 1 },
                { word : 'to', count : 1 },
                { word : 'verify', count : 1 },
                { word : 'this', count : 1 },
                { word : 'hasn', count : 1 },
                { word : 'allowed', count : 1 },
                { word : 'partial', count : 1 },
                { word : 'words', count : 1 },
                { word : 'through', count : 1 },
            ]);
        });

        it('pads with common words when the training data has very few words', function () {
            var examples = describeOne([ 'Hello world' ]);

            expect(bagOfWords(examples[0])).toEqual([
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

        it('does not duplicate padding words that are in the training data', function () {
            var examples = describeOne([ 'would water first' ]);

            expect(bagOfWords(examples[0])).toEqual([
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

        it('upper-cases the word in the annotation', function () {
            var examples = describeOne([ 'Hello world' ]);

            expect(examples[0].bagofwords[0].annotation).toBe('number of times that the word "HELLO" appears');
        });

    });


    describe('custom features', function () {

        function featuresFor(text) {
            var training = trainingItems([ { label : 'x', textdata : text } ]);
            return describe_({ labels : [ 'x' ] }, training).examples[0];
        }

        it('returns the nine features in order', function () {
            var example = featuresFor('Hello');

            expect(example.customfeatures.map(function (f) { return f.annotation; })).toEqual([
                'number of letters',
                'punctuation marks',
                'number of capital letters',
                'syllables',
                'includes a question mark',
                'number of verbs',
                'number of emoticons',
                'mentions of numbers',
                'usages of contractions',
            ]);
        });

        it('counts letters, punctuation and capitals', function () {
            var example = featuresFor('Hi, Bob! OK?');

            expect(feature(example, 'number of letters')).toBe(12);
            expect(feature(example, 'punctuation marks')).toBe(3);
            expect(feature(example, 'number of capital letters')).toBe(4);
        });

        it('spots question marks', function () {
            expect(feature(featuresFor('Is it raining?'), 'includes a question mark')).toBe(1);
            expect(feature(featuresFor('It is raining'), 'includes a question mark')).toBe(0);
        });

        it('only says yes to a question mark once, however many there are', function () {
            expect(feature(featuresFor('Why?? Why???'), 'includes a question mark')).toBe(1);
        });

        it('gives the same answer for every example (not affected by earlier examples)', function () {
            var training = trainingItems([
                { label : 'x', textdata : 'a?' }, { label : 'x', textdata : 'b?' }, { label : 'x', textdata : 'c?' },
            ]);
            var examples = describe_({ labels : [ 'x' ] }, training).examples;

            examples.forEach(function (example) {
                expect(feature(example, 'includes a question mark')).toBe(1);
            });
        });

        it('counts syllables', function () {
            expect(feature(featuresFor('I love running'), 'syllables')).toBe(4);
            expect(feature(featuresFor('What is the weather like today?'), 'syllables')).toBe(8);
        });

        it('counts verbs', function () {
            expect(feature(featuresFor('I don\'t think the dogs ran'), 'number of verbs')).toBe(2);
            expect(feature(featuresFor('a big red apple'), 'number of verbs')).toBe(0);
        });

        it('counts numbers', function () {
            expect(feature(featuresFor('I have 3 cats and two dogs'), 'mentions of numbers')).toBe(2);
            expect(feature(featuresFor('no numbers here'), 'mentions of numbers')).toBe(0);
        });

        it('counts contractions', function () {
            expect(feature(featuresFor('I don\'t know, we\'re lost'), 'usages of contractions')).toBe(2);
            expect(feature(featuresFor('I do not know'), 'usages of contractions')).toBe(0);
        });

        it('counts emoticons', function () {
            expect(feature(featuresFor('This is just plain text'), 'number of emoticons')).toBe(0);
            expect(feature(featuresFor('a smiley face :-) to show cheerful text'), 'number of emoticons')).toBe(1);
            expect(feature(featuresFor('a smiley face :-) and a crying face :\'('), 'number of emoticons')).toBe(2);
        });

    });

});
