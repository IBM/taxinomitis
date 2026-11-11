(function () {

    angular
        .module('app')
        .service('describeTextService', describeTextService);

    describeTextService.$inject = [
        'utilService', 'loggerService'
    ];


    // prepares the examples shown on the "describe your text model" page
    //
    // for each example, this works out the values that the visualisation
    //  shows on the input nodes for each of the different ways of
    //  turning text into numbers (bag of words, chosen features, and
    //  random values)
    //
    // compromise (and its syllables plugin) are only needed on this page,
    //  so they are lazy-loaded the first time an example is prepared
    function describeTextService(utilService, loggerService) {

        // how many examples of each label to describe
        const EXAMPLES_PER_LABEL = 5;

        // how many training examples to use to choose the bag-of-words words
        const BAG_OF_WORDS_TRAINING_LIMIT = 1000;
        // how many words to include in the bag-of-words
        const BAG_OF_WORDS_DICTIONARY_SIZE = 20;
        // minimum number of words to show counts for in each example
        const BAG_OF_WORDS_REQUIRED_MINIMUM = 10;



        //-------------------------------------------------------------------------------
        // Loading compromise
        //-------------------------------------------------------------------------------

        var nlpReady = false;

        function loadNlp() {
            return utilService.loadScript('/static/bower_components/compromise/compromise.min.js')
                .then(function () {
                    return utilService.loadScript('/static/bower_components/compromise-speech/compromise-speech.min.js');
                })
                .then(function () {
                    if (!nlpReady) {
                        window.nlp.plugin(window.compromiseSpeech);
                        nlpReady = true;
                    }
                    return window.nlp;
                });
        }



        //-------------------------------------------------------------------------------
        // Bag of words
        //-------------------------------------------------------------------------------

        const WORD_GAPS = /[^A-Za-zА-Яа-я0-9_]+/;

        const IGNORE_TOKENS = [
            't', 'd', 's', 'a', 'the', 'is',
        ];

        // used to fill the bag-of-words if there aren't enough words in the training data
        const PADDING_WORDS = [
            'would', 'water', 'first', 'long', 'time',
            'made', 'people', 'there', 'some', 'word',
        ];

        function tokenize(text) {
            return text.split(WORD_GAPS)
                .filter((token) => token !== '' && token !== ' ')
                .map((token) => token.toLowerCase())
                .filter((token) => !IGNORE_TOKENS.includes(token));
        }

        function getWordCounts(texts) {
            const allWords = {};
            for (const text of texts) {
                for (const word of tokenize(text)) {
                    if (!(word in allWords)) {
                        allWords[word] = 0;
                    }
                    allWords[word] += 1;
                }
            }
            return Object.keys(allWords).map((word) => {
                return { word : word, count : allWords[word] };
            });
        }

        function getMostCommonWords(texts, num) {
            const allWords = getWordCounts(texts);
            allWords.sort((x, y) => {
                if (x.count === y.count) {
                    return 0;
                }
                return x.count < y.count ? 1 : -1;
            });
            const mostCommonWords = allWords.slice(0, num);
            for (let i = 0; i < PADDING_WORDS.length && mostCommonWords.length < num; i++) {
                const paddingWord = PADDING_WORDS[i];
                if (!(mostCommonWords.some((mcw) => mcw.word === paddingWord))) {
                    mostCommonWords.push({ word : paddingWord, count : 0 });
                }
            }
            return mostCommonWords;
        }

        function getTrainingExampleWordCounts(text, bowDictionary) {
            const wordCounts = {};
            for (const word of tokenize(text)) {
                if (bowDictionary.includes(word)) {
                    if (!(word in wordCounts)) {
                        wordCounts[word] = 0;
                    }
                    wordCounts[word] += 1;
                }
            }

            // make sure that at least a couple of the words
            //  from this example are included
            if (Object.keys(wordCounts).length < 2) {
                for (const wordToAdd of getMostCommonWords([ text ], 2)) {
                    wordCounts[wordToAdd.word] = wordToAdd.count;
                }
            }

            // fill with zero counts for words from the dictionary
            let zeroWordIndex = 0;
            const dictionarySizeLimit = Math.min(BAG_OF_WORDS_REQUIRED_MINIMUM, bowDictionary.length);
            while (Object.keys(wordCounts).length < dictionarySizeLimit) {
                if (!(bowDictionary[zeroWordIndex] in wordCounts)) {
                    wordCounts[bowDictionary[zeroWordIndex]] = 0;
                }
                zeroWordIndex += 1;
            }

            // if that still isn't enough, fill with words from this example
            if (Object.keys(wordCounts).length < BAG_OF_WORDS_REQUIRED_MINIMUM) {
                zeroWordIndex = 0;
                const wordsToAdd = getMostCommonWords([ text ], BAG_OF_WORDS_REQUIRED_MINIMUM);
                while ((Object.keys(wordCounts).length < BAG_OF_WORDS_REQUIRED_MINIMUM) && (zeroWordIndex < wordsToAdd.length)) {
                    const wordToAdd = wordsToAdd[zeroWordIndex];
                    if (!(wordToAdd.word in wordCounts)) {
                        wordCounts[wordToAdd.word] = wordToAdd.count;
                    }
                    zeroWordIndex += 1;
                }
            }

            return Object.keys(wordCounts).map((word) => {
                return {
                    annotation : 'number of times that the word "' + word.toUpperCase() + '" appears',
                    value : wordCounts[word]
                };
            });
        }



        //-------------------------------------------------------------------------------
        // Chosen features
        //-------------------------------------------------------------------------------

        const PUNCTUATION_REGEX = /[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/g;
        const QUESTIONMARK_REGEX = /[?]/;
        const CAPITALLETTER_REGEX = /[A-Z]/g;

        // from the emoticon npm package (v4.1.0)
        const EMOTICONS = [
            '>:(', '>:[', '>:-(', '>:-[', '>=(', '>=[', '>=-(', '>=-[', ':")', ':"]', ':"D', ':-")',
            ':-"]', ':-"D', '=")', '="]', '="D', '=-")', '=-"]', '=-"D', '<\\3', '</3', ':/', ':\\',
            ':-/', ':-\\', '=/', '=\\', '=-/', '=-\\', ':,(', ':,[', ':,|', ':,-(', ':,-[', ':,-|',
            ':\'(', ':\'[', ':\'|', ':\'-(', ':\'-[', ':\'-|', '=,(', '=,[', '=,|', '=,-(', '=,-[', '=,-|',
            '=\'(', '=\'[', '=\'|', '=\'-(', '=\'-[', '=\'-|', 'T-T', ':(', ':[', ':-(', ':-[', '=(',
            '=[', '=-(', '=-[', '<3', ']:(', ']:[', ']:-(', ']:-[', ']=(', ']=[', ']=-(', ']=-[',
            'o:)', 'o:]', 'o:D', 'o:-)', 'o:-]', 'o:-D', 'o=)', 'o=]', 'o=D', 'o=-)', 'o=-]', 'o=-D',
            'O:)', 'O:]', 'O:D', 'O:-)', 'O:-]', 'O:-D', 'O=)', 'O=]', 'O=D', 'O=-)', 'O=-]', 'O=-D',
            '0:)', '0:]', '0:D', '0:-)', '0:-]', '0:-D', '0=)', '0=]', '0=D', '0=-)', '0=-]', '0=-D',
            ':,)', ':,]', ':,D', ':,-)', ':,-]', ':,-D', ':\')', ':\']', ':\'D', ':\'-)', ':\'-]', ':\'-D',
            '=,)', '=,]', '=,D', '=,-)', '=,-]', '=,-D', '=\')', '=\']', '=\'D', '=\'-)', '=\'-]', '=\'-D',
            ':*', ':-*', '=*', '=-*', 'x)', 'x]', 'xD', 'x-)', 'x-]', 'x-D', 'X)', 'X]',
            'X-)', 'X-]', 'X-D', ':3', ':-3', '=3', '=-3', ';3', ';-3', 'x3', 'x-3', 'X3',
            'X-3', ':|', ':-|', '=|', '=-|', ':-', ':o', ':O', ':0', ':-o', ':-O', ':-0',
            '=o', '=O', '=0', '=-o', '=-O', '=-0', ':@', ':-@', '=@', '=-@', ':D', ':-D',
            '=D', '=-D', ':)', ':]', ':-)', ':-]', '=)', '=]', '=-)', '=-]', ']:)', ']:]',
            ']:D', ']:-)', ']:-]', ']:-D', ']=)', ']=]', ']=D', ']=-)', ']=-]', ']=-D', ':,\'(', ':,\'[',
            ':,\'-(', ':,\'-[', ':\',(', ':\',[', ':\',-(', ':\',-[', '=,\'(', '=,\'[', '=,\'-(', '=,\'-[', '=\',(', '=\',[',
            '=\',-(', '=\',-[', ':p', ':P', ':d', ':-p', ':-P', ':-d', '=p', '=P', '=d', '=-p',
            '=-P', '=-d', 'xP', 'x-p', 'x-P', 'x-d', 'Xp', 'Xd', 'X-p', 'X-P', 'X-d', ';p',
            ';P', ';d', ';-p', ';-P', ';-d', '8)', '8]', '8D', '8-)', '8-]', '8-D', 'B)',
            'B]', 'B-)', 'B-]', 'B-D', ',:(', ',:[', ',:-(', ',:-[', ',=(', ',=[', ',=-(', ',=-[',
            '\':(', '\':[', '\':-(', '\':-[', '\'=(', '\'=[', '\'=-(', '\'=-[', ',:)', ',:]', ',:D', ',:-)',
            ',:-]', ',:-D', ',=)', ',=]', ',=D', ',=-)', ',=-]', ',=-D', '\':)', '\':]', '\':D', '\':-)',
            '\':-]', '\':-D', '\'=)', '\'=]', '\'=D', '\'=-)', '\'=-]', '\'=-D', ':$', ':s', ':z', ':S',
            ':Z', ':-$', ':-s', ':-z', ':-S', ':-Z', '=$', '=s', '=z', '=S', '=Z', '=-$',
            '=-s', '=-z', '=-S', '=-Z', ';)', ';]', ';D', ';-)', ';-]', ';-D',
        ];
        const IGNORE_EMOTICONS = [
            ':-',
        ];

        function countRegexMatches(text, regex) {
            return ((text || '').match(regex) || []).length;
        }

        function countEmoticons(text) {
            let count = 0;
            for (const emoticon of EMOTICONS) {
                if (!IGNORE_EMOTICONS.includes(emoticon) && text.includes(emoticon)) {
                    count += 1;
                }
            }
            return count;
        }

        function getCustomFeatures(nlp, text) {
            const analyzedText = nlp(text);
            return [
                // 1
                { annotation : 'number of letters', value : text.length },
                // 2
                { annotation : 'punctuation marks', value : countRegexMatches(text, PUNCTUATION_REGEX) },
                // 3
                { annotation : 'number of capital letters', value : countRegexMatches(text, CAPITALLETTER_REGEX) },
                // 4
                { annotation : 'syllables', value : analyzedText.syllables().flat().length },
                // 5
                { annotation : 'includes a question mark', value : QUESTIONMARK_REGEX.test(text) ? 1 : 0 },
                // 6
                { annotation : 'number of verbs', value : analyzedText.verbs().json().length },
                // 7
                { annotation : 'number of emoticons', value : countEmoticons(text) },
                // 8
                { annotation : 'mentions of numbers', value : analyzedText.numbers().json().length },
                // 9
                { annotation : 'usages of contractions', value : analyzedText.contractions().json().length },
            ];
        }



        //-------------------------------------------------------------------------------
        // Random values
        //-------------------------------------------------------------------------------

        // random integer between min and max (inclusive)
        function randomInt(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        function shuffle(array) {
            const shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        }

        // generates num random numbers that add up to 100
        function randomScores(num) {
            const numbers = [ randomInt(40, 60) ];
            let runningTotal = numbers[0];
            for (let i = 1; i < num - 1; i++) {
                const next = randomInt(0, 95 - runningTotal);
                runningTotal += next;
                numbers.push(next);
            }
            numbers.push(100 - runningTotal);
            return shuffle(numbers);
        }

        // smallest value for each of the random input nodes (largest is always 5)
        const RANDOM_FEATURE_MINIMUMS = [ 1, 1, 0, 1, 0, 0, 0, 1, 0, 1 ];

        function getRandomFeatures() {
            return RANDOM_FEATURE_MINIMUMS.map((min) => {
                return { annotation : '', value : randomInt(min, 5) };
            });
        }



        //-------------------------------------------------------------------------------
        // Choosing examples
        //-------------------------------------------------------------------------------

        function compare(a, b) {
            if (a < b) {
                return -1;
            }
            return a > b ? 1 : 0;
        }

        function getBagOfWordsDictionary(training) {
            const texts = [...training]
                .sort((a, b) => compare(a.label, b.label) || compare(a.id, b.id))
                .slice(0, BAG_OF_WORDS_TRAINING_LIMIT)
                .map((item) => item.textdata);
            return getMostCommonWords(texts, BAG_OF_WORDS_DICTIONARY_SIZE).map((wc) => wc.word);
        }

        function getExamplesForLabel(training, label) {
            return training
                .filter((item) => item.label === label)
                .sort((a, b) => compare(a.textdata, b.textdata))
                .slice(0, EXAMPLES_PER_LABEL);
        }

        function describeExample(nlp, item, project, bowDictionary) {
            const scores = randomScores(project.labels.length);
            const output = {};
            project.labels.forEach((label, idx) => {
                output[label] = scores[idx];
            });

            return {
                text : item.textdata,
                label : item.label,
                bagofwords : getTrainingExampleWordCounts(item.textdata, bowDictionary),
                customfeatures : getCustomFeatures(nlp, item.textdata),
                random : getRandomFeatures(),
                output : output
            };
        }


        // returns { examples : [ ... ] } - up to EXAMPLES_PER_LABEL examples
        //  of each label, interleaved so that consecutive examples are
        //  from different labels
        function describeTraining(project, training) {
            return loadNlp()
                .then(function (nlp) {
                    loggerService.debug('[ml4kdesc] preparing examples');

                    const bowDictionary = getBagOfWordsDictionary(training);

                    const examplesByLabel = project.labels.map((label) => {
                        return getExamplesForLabel(training, label)
                            .map((item) => describeExample(nlp, item, project, bowDictionary));
                    });

                    const examples = [];
                    for (let i = 0; i < EXAMPLES_PER_LABEL; i++) {
                        for (const labelExamples of examplesByLabel) {
                            if (labelExamples[i]) {
                                examples.push(labelExamples[i]);
                            }
                        }
                    }
                    return { examples : examples };
                });
        }


        return {
            describeTraining : describeTraining
        };
    }
})();
