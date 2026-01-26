(function () {

    angular
        .module('app')
        .controller('LanguageModelController', LanguageModelController);

    LanguageModelController.$inject = [
        'authService', 'projectsService', 'trainingService',
        'wikipediaService', 'languageModelService', 'txtService',
        'gpuDetectionService', 'utilService', 'loggerService',
        '$mdDialog',
        '$stateParams',
        '$scope', '$window', '$timeout', '$q'
    ];

    function LanguageModelController(authService, projectsService, trainingService, wikipediaService, languageModelService, txtService, gpuDetectionService, utilService, loggerService, $mdDialog, $stateParams, $scope, $window, $timeout, $q) {
        var vm = this;
        vm.authService = authService;

        $scope.projectId = $stateParams.projectId;
        $scope.userId = $stateParams.userId;



        // ===================================================================
        // DISPLAYING ERRORS
        // ===================================================================

        var alertId = 1;
        vm.errors = [];
        vm.warnings = [];
        vm.dismissAlert = function (type, errIdx) {
            vm[type].splice(errIdx, 1);
        };
        function displayAlert(type, status, errObj) {
            if (!errObj) {
                errObj = {};
            }
            else {
                // record the error
                loggerService.error(errObj);
                if (status === 500 && Sentry && Sentry.captureException) {
                    Sentry.captureException({ error : errObj, errortype : typeof (errObj) });
                }
            }

            if (status === 413) {
                errObj = {
                    status : 413,
                    message : 'Sorry! Your corpus is too large for a toy language model project. ' +
                              'Please remove some text from your corpus and try again.'
                };
            }

            $scope.$applyAsync(() => {
                vm[type].push({
                    alertid : alertId++,
                    message : errObj.message || errObj.error || 'Unknown error',
                    status : status
                });
                $window.scrollTo(0, 0);
            });
        }
        vm.displayAlert = displayAlert;

        // -------------------------------------------------------------------



        // ===================================================================
        // CURRENT PAGE STATE
        // ===================================================================

        $scope.PHASES = {
            INITIAL : 'initial',
            TOY : {
                CORPUS        : 'toy_corpus',
                CONTEXTWINDOW : 'toy_contextwindow',
                TOKENS        : 'toy_tokens',
                TEMPERATURE   : 'toy_temperature',
                READY         : 'toy_ready'
            },
            SMALL : {
                ARCHITECTURE  : 'small_architecture',
                CONTEXTWINDOW : 'small_contextwindow',
                TEMPERATURE   : 'small_temperature',
                RAGCONTEXT    : 'small_ragcontext',
                READY         : 'small_ready'
            }
        };

        $scope.phase = $scope.PHASES.INITIAL;

        $scope.review = function (newphase) {
            $scope.phase = newphase;
        };

        // all model types
        $scope.loading = true;
        $scope.prompt = {
            message : ''
        };

        // small language models
        $scope.reconfiguring = false;
        $scope.generatedmessages = [];

        // toy language models
        $scope.corpus = [];
        $scope.generatedtokens = [];
        $scope.hovertoken = undefined;
        $scope.hoverexplain = undefined;
        $scope.testfeedbacknomatch = false;
        $scope.testfeedbackmoretokens = false;
        let tokenToRecompute;
        let analyzedCorpus;

        // small language models
        $scope.ageWarningDisplayed = false;

        // -------------------------------------------------------------------



        // ===================================================================
        // SMALL LANGUAGE MODELS - available models
        // ===================================================================

        const modelsWhenShaderF16Supported = [
            {
                id : 'SmolLM2-135M-Instruct-q0f16-MLC',
                version : 'SmolLM2',
                size : '135M',
                billionparameters : 0.135,
                label : 'Smol',
                developer : 'Hugging Face',
                storage : '276 MB',
                storagemb : 276
            },
            {
                id : 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
                version : '2.5',
                size : '0.5B',
                billionparameters : 0.5,
                label : 'Qwen',
                developer : 'Alibaba',
                storage : '289 MB',
                storagemb : 289
            },
            {
                id : 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC-1k',
                version : '1.0',
                size : '1.1B',
                billionparameters : 1.1,
                label : 'Tiny Llama',
                developer : 'Singapore University of Technology and Design',
                storage : '625 MB',
                storagemb : 625
            },
            {
                id : 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
                version : '3.2',
                size : '1B',
                billionparameters : 1.0,
                label : 'Llama',
                developer : 'Meta',
                storage : '711 MB',
                storagemb : 711
            },
            {
                id : 'phi-1_5-q4f16_1-MLC',
                version : '1.5',
                size : '1.3B',
                billionparameters : 1.3,
                label : 'Phi',
                developer : 'Microsoft',
                storage : '806 MB',
                storagemb : 806
            },
            {
                id : 'stablelm-2-zephyr-1_6b-q4f16_1-MLC-1k',
                version : '2',
                size : '1.6B',
                billionparameters : 1.6,
                label : 'Zephyr',
                developer : 'Stability AI',
                storage : '932 MB',
                storagemb : 932
            },
            {
                id : 'gemma-2-2b-it-q4f16_1-MLC-1k',
                version : '2',
                size : '2B',
                billionparameters : 2.0,
                label : 'Gemma',
                developer : 'Google',
                storage : '1.5 GB',
                storagemb : 1500
            },
            {
                id : 'RedPajama-INCITE-Chat-3B-v1-q4f16_1-MLC-1k',
                version : '1',
                size : '3B',
                billionparameters : 3.0,
                label : 'RedPajama',
                developer : 'Together',
                storage : '1.5 GB',
                storagemb : 1500
            }
        ];
        const modelsWhenShaderF16NotSupported = [
            {
                id : 'SmolLM2-135M-Instruct-q0f32-MLC',
                version : 'SmolLM2',
                size : '135M',
                billionparameters : 0.135,
                label : 'Smol',
                developer : 'Hugging Face',
                storage : '269 MB',
                storagemb : 269
            },
            {
                id : 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
                version : '2.5',
                size : '0.5B',
                billionparameters : 0.5,
                label : 'Qwen',
                developer : 'Alibaba',
                storage : '289 MB',
                storagemb : 289
            },
            {
                id : 'TinyLlama-1.1B-Chat-v1.0-q4f32_1-MLC-1k',
                version : '1.0',
                size : '1.1B',
                billionparameters : 1.1,
                label : 'Tiny Llama',
                developer : 'Singapore University of Technology and Design',
                storage : '627 MB',
                storagemb : 627
            },
            {
                id : 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
                version : '3.2',
                size : '1B',
                billionparameters : 1.0,
                label : 'Llama',
                developer : 'Meta',
                storage : '711 MB',
                storagemb : 711
            },
            {
                id : 'phi-1_5-q4f32_1-MLC',
                version : '1.5',
                size : '1.3B',
                billionparameters : 1.3,
                label : 'Phi',
                developer : 'Microsoft',
                storage : '806 MB',
                storagemb : 806
            },
            {
                id : 'stablelm-2-zephyr-1_6b-q4f16_1-MLC-1k',
                version : '2',
                size : '1.6B',
                billionparameters : 1.6,
                label : 'Zephyr',
                developer : 'Stability AI',
                storage : '932 MB',
                storagemb : 932
            },
            {
                id : 'gemma-2-2b-it-q4f32_1-MLC-1k',
                version : '2',
                size : '2B',
                billionparameters : 2.0,
                label : 'Gemma',
                developer : 'Google',
                storage : '1.5 GB',
                storagemb : 1494
            },
            {
                id : 'RedPajama-INCITE-Chat-3B-v1-q4f32_1-MLC-1k',
                version : '1',
                size : '3B',
                billionparameters : 3.0,
                label : 'RedPajama',
                developer : 'Together',
                storage : '1.7 GB',
                storagemb : 1714
            }
        ];

        // -------------------------------------------------------------------



        // ===================================================================
        // PAGE INITIALISATION
        // ===================================================================

        // check the user is logged in
        authService.getProfileDeferred()
            .then((profile) => {
                vm.profile = profile;

                // load saved project info
                loggerService.debug('[ml4kproj] getting project info');
                return projectsService.getProject($scope.projectId, $scope.userId, profile.tenant);
            })
            .then((project) => {
                $scope.project = project;

                // retrieve saved model setup

                if ($scope.project.modeltype === 'small') {
                    return restoreSavedSmallLanguageModel();
                }
                else if ($scope.project.modeltype === 'toy') {
                    return restoreSavedToyLanguageModel();
                }
                else {
                    // incorrect project type - message will be shown
                }
            })
            .then(() => {
                $scope.loading = false;
            })
            .catch((err) => {
                loggerService.error('[ml4klanguage] init error', err);
                displayAlert('errors', err.status, err.data ? err.data : err);
            });

        function restoreSavedSmallLanguageModel() {
            return setupSlmSupport()
                .then(() => {
                    if ($scope.project.slm && $scope.project.slm.id) {
                        $scope.lookupSmallLanguageModelDetails();
                        return $scope.downloadModel()
                            .then(() => {
                                $scope.project.slm.ready = true;
                                $scope.phase = $scope.PHASES.SMALL.READY;
                            });
                    }
                    else {
                        $scope.project.slm = {
                            temperature : 1.0,
                            topp : 1.0
                        };
                        $scope.phase = $scope.PHASES.SMALL.ARCHITECTURE;
                    }
                });
        }
        function restoreSavedToyLanguageModel() {
            loggerService.debug('[ml4klanguage] restoreSavedToyLanguageModel');
            return trainingService.getTraining(
                    $scope.projectId,
                    $scope.userId,
                    $scope.project.classid
                )
                .then((docs) => {
                    $scope.$applyAsync(() => {
                        for (const doc of docs) {
                            $scope.corpus.push({
                                id : doc.id,
                                title : doc.title,
                                type : doc.type
                            });
                        }
                    });

                    loggerService.debug('[ml4klanguage] restored corpus', docs.length);

                    if (!$scope.project.toy) {
                        loggerService.debug('[ml4klanguage] no model config stored - initialising');
                        $scope.project.toy = {
                            ngrams : 0,
                            temperature : 1.0,
                            topp : 1.0
                        };
                    }
                    else {
                        loggerService.debug('[ml4klanguage] restored model config', $scope.project.toy);
                    }

                    $scope.phase = $scope.PHASES.TOY.CORPUS;
                    if (docs.length > 0) {
                        return trainingService.retrieveAsset($scope.project)
                            .then((savedCorpus) => {
                                loggerService.debug('[ml4klanguage] restoring corpus tokens');
                                if (savedCorpus && savedCorpus['1'] && savedCorpus['1'].count > 0) {
                                    analyzedCorpus = savedCorpus;
                                    if ($scope.project.toy.ngrams) {
                                        $scope.project.toy.tokens = analyzedCorpus[$scope.project.toy.ngrams].summary;
                                        selectFirstToken();
                                        $scope.recomputeProbabilities();
                                        $scope.phase = $scope.PHASES.TOY.READY;
                                        $scope.project.toy.ready = true;
                                    }
                                }
                            })
                            .catch((err) => {
                                loggerService.debug('[ml4klanguage] no tokens saved', err);
                            });
                    }
                });
        }

        // -------------------------------------------------------------------



        // ===================================================================
        // CHOOSE MODEL TYPE FOR THE FIRST TIME
        //   starting phase:     INITIAL
        //   finishing phase:    TOY.CORPUS
        //                       SMALL.ARCHITECTURE
        // ===================================================================
        $scope.modelTypeSwitch = function (type) {
            $scope.modeltype = type;
        };
        // invoked when the user clicks Next after choosing project type
        $scope.chooseModelType = function (type) {
            loggerService.debug('[ml4klanguage] chooseModelType', type);

            // ignore clicks while page is updating
            if ($scope.loading) {
                return;
            }

            // ignore clicks if we already have a model type
            if ($scope.project.modeltype) {
                return;
            }

            $scope.loading = true;
            projectsService.setLanguageModelType($scope.project, type)
                .then(() => {
                    if (type === 'toy') {
                        return $q.resolve();
                    }
                    else if (type === 'small') {
                        return setupSlmSupport();
                    }
                    else {
                        loggerService.error('[ml4klanguage] unexpected model type', type);
                        throw new Error('Unexpected model type');
                    }
                })
                .then(() => {
                    if (type === 'toy') {
                        $scope.project.toy = {
                            ngrams : 0,
                            temperature : 1.0,
                            topp : 1.0
                        };
                        $scope.phase = $scope.PHASES.TOY.CORPUS;
                    }
                    else if (type === 'small') {
                        $scope.project.slm = {
                            temperature : 1.0,
                            topp : 1.0
                        };
                        $scope.phase = $scope.PHASES.SMALL.ARCHITECTURE;
                    }

                    $scope.project.modeltype = type;

                    $scope.$applyAsync(() => {
                        $scope.loading = false;
                    });
                })
                .catch((err) => {
                    loggerService.error('[ml4klanguage] Failed to choose model type', err);
                    $scope.loading = false;
                    displayAlert('errors', 500, err);
                });
        };


        // ===================================================================
        // TOY LANGUAGE MODEL - CORPUS MANAGEMENT
        // ===================================================================

        // called on any corpus changes - recomputes the tokens using the updated corpus
        function modifyCorpus() {
            loggerService.debug('[ml4klanguage] modifyCorpus');
            if ($scope.project.toy && analyzedCorpus) {
                $scope.loading = true;
                return parseCorpus()
                    .then(() => {
                        $scope.$applyAsync(() => { $scope.loading = false; });
                    });
            }
        }

        // -------------------------------------------------------------------

        // makes changes to the corpus stored in browser storage

        function addToyCorpusItem (type, title, contents) {
            return trainingService.newTrainingData(
                    $scope.projectId,
                    $scope.userId,
                    $scope.project.classid,
                    $scope.project.type,
                    'local',
                    { type, title, contents }
                )
                .then((added) => {
                    $scope.$applyAsync(() => {
                        $scope.corpus.push({
                            id : added.id,
                            title : added.title,
                            type : added.type
                        });
                    });

                    modifyCorpus();
                })
                .catch((err) => {
                    loggerService.error('[ml4klanguage] Failed to store corpus');
                    displayAlert('errors', 500, err);
                });
        }
        function addToyCorpusItems (items) {
            return trainingService.bulkAddTrainingData(
                    $scope.project,
                    items,
                    $scope.userId,
                    $scope.project.classid
                )
                .then((allAdded) => {
                    $scope.$applyAsync(() => {
                        for (const added of allAdded) {
                            $scope.corpus.push({
                                id : added.id,
                                title : added.title,
                                type : added.type
                            });
                        }
                    });

                    modifyCorpus();
                })
                .catch((err) => {
                    loggerService.error('[ml4klanguage] Failed to store corpus');
                    displayAlert('errors', 500, err);
                });
        }

        // called on clicking the delete button - no dialog/confirmation needed
        $scope.removeCorpusDoc = function (id) {
            return trainingService.deleteTrainingData(
                    $scope.projectId,
                    $scope.userId,
                    $scope.project.classid,
                    id
                )
                .then(() => {
                    $scope.$applyAsync(() => {
                        $scope.corpus = $scope.corpus.filter((doc) => doc.id !== id);
                    });

                    modifyCorpus();
                });
        };


        // UI functions - displays dialogs for adding content to the corpus

        // add free text - invoked on clicking "Add text" button
        $scope.addCorpusText = function (ev) {
            $mdDialog.show({
                locals : {
                    dlgtitle : 'LANGUAGEMODEL.CORPUS.ADDTEXT',
                    placeholder : 'Corpus text'
                },
                controller : function ($scope, locals) {
                    $scope.dlgtitle = locals.dlgtitle;
                    $scope.placeholder = locals.placeholder;

                    $scope.hide = function() {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function(resp) {
                        $mdDialog.hide(resp);
                    };
                },
                templateUrl : 'static/components/languagemodel/corpustext.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (resp) {
                    addToyCorpusItem('text', resp.title, resp.contents);
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };

        // add contents of Wikipedia page - invoked on clicking "Wikipedia" button
        $scope.addWikipediaPage = function (ev) {
            $mdDialog.show({
                locals : {
                    dlgtitle : 'LANGUAGEMODEL.CORPUS.ADDWIKIPEDIA'
                },
                controller : function ($scope, locals) {
                    $scope.dlgtitle = locals.dlgtitle;
                    $scope.title = '';
                    $scope.contents = '';

                    $scope.hide = function() {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function(resp) {
                        $mdDialog.hide(resp);
                    };

                    $scope.search = function (title) {
                        if (title) {
                            wikipediaService.searchByTitle(title)
                                .then((contents) => { $scope.contents = contents });
                        }
                    };
                },
                templateUrl : 'static/components/languagemodel/wikipedia.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (resp) {
                    addToyCorpusItem('wikipedia', resp.title, resp.contents);
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };

        // add contents of a text file - invoked after choosing files from file picker
        $scope.addCorpusFile = function (ev) {
            if (ev.currentTarget && ev.currentTarget.files) {
                return txtService.getContents(ev.currentTarget.files)
                    .then((allFiles) => {
                        addToyCorpusItems(allFiles);
                    })
                    .catch(() => {
                        displayAlert('errors', 500, { message : 'There was a problem reading one of your files' });
                    });
            }
        };

        // -------------------------------------------------------------------



        // ===================================================================
        // TOY LANGUAGE MODEL - CORPUS PROCESSING - turning into n-grams
        // ===================================================================

        function parseCorpus() {
            loggerService.debug('[ml4klanguage] parseCorpus');
            return trainingService.getTraining($scope.projectId, $scope.userId, $scope.project.classid)
                .then((corpus) => {
                    const text = corpus.map((doc) => doc.contents);
                    return languageModelService.generateNgrams($scope.userId, $scope.project.classid, text);
                })
                .then((output) => {
                    if (output.bigrams.count === 0) {
                        displayAlert('warnings', 400, { message : 'Please add more text to your corpus' });
                        $scope.phase = $scope.PHASES.TOY.CORPUS;
                        return;
                    }

                    analyzedCorpus = {
                        '1' : output.bigrams,
                        '2' : output.trigrams,
                        '3' : output.tetragrams
                    };

                    // save the parsed corpus for reuse
                    trainingService.storeAsset($scope.project, analyzedCorpus);
                })
                .catch((err) => {
                    if (err.status) {
                        // API error from generating the ngrams
                        loggerService.error('[ml4klanguage] error generating ngrams', err);
                        $scope.loading = false;
                        displayAlert('errors', err.status, err.data);
                    }
                    else {
                        // logic error
                        throw err;
                    }
                });
        }

        // -------------------------------------------------------------------



        // ===================================================================
        // TOY LANGUAGE MODEL - DISPLAYING TOKENS
        //   starting phase:     TOY.CORPUS
        //   finishing phase:    TOY.CONTEXTWINDOW
        // ===================================================================
        // invoked when the user clicks Next after preparing their corpus for the first time
        $scope.confirmCorpus = function () {
            $scope.phase = $scope.PHASES.TOY.CONTEXTWINDOW;
        };





        // ===================================================================
        // TOY LANGUAGE MODEL - GENERATING TOKENS
        // ===================================================================

        // invoked on clicking the 'Change' button
        $scope.changeNgramSize = function () {
            loggerService.debug('[ml4klanguage] changeNgramSize');

            // clicking the button adds 1 to n-grams - until we reach 3 - then we go round back to 1
            $scope.project.toy.ngrams = ($scope.project.toy.ngrams === 3 ? 1 : $scope.project.toy.ngrams + 1);

            // if we have tokens, switch to the one based on the new ngrams choice
            //  - clearing any current selection
            if ($scope.project.toy.tokens) {
                $scope.project.toy.tokens = analyzedCorpus[$scope.project.toy.ngrams].summary;
                $scope.project.toy.tokens.forEach(deselect);
                tokenToRecompute = undefined;
                delete $scope.confirmTokens;
            }

            // if the user is viewing the tokens, highlight the most common token
            // if the user is viewing probability scores, recompute with the new ngram size
            selectFirstToken();
            $scope.recomputeProbabilities();
        };
        // -------------------------------------------------------------------



        // ===================================================================
        // TOY LANGUAGE MODEL - DISPLAYING TOKENS
        //   starting phase:     TOY.CONTEXTWINDOW
        //   finishing phase:    TOY.TOKENS
        // ===================================================================
        // invoked when the user clicks Next after choosing number of ngrams for the first time
        $scope.initTokens = function () {
            loggerService.debug('[ml4klanguage] initTokens');

            let corpusFn;
            if (analyzedCorpus) {
                // we already have a corpus - no need to parse the corpus again
                corpusFn = $q.resolve();
            }
            else {
                corpusFn = parseCorpus();
            }

            $scope.loading = true;
            corpusFn
                .then(() => {
                    if (analyzedCorpus) {
                        $scope.project.toy.tokens = analyzedCorpus[$scope.project.toy.ngrams].summary;
                        $scope.phase = $scope.PHASES.TOY.TOKENS;
                        selectFirstToken();
                    }
                    $scope.$applyAsync(() => {
                        $scope.loading = false;
                    });
                })
                .catch((err) => {
                    loggerService.error('[ml4klanguage] error parsing corpus', err);
                    $scope.loading = false;
                    displayAlert('errors', 500, err);
                });
        };

        // handle clicks on tokens in the sample tokens view
        $scope.toggleToken = function (token, others, parents) {
            delete $scope.confirmTokens;

            token.selected = !token.selected;
            if (token.selected) {
                others
                    .filter((t) => t.token !== token.token)
                    .forEach(deselect);

                if (parents.length === ($scope.project.toy.ngrams + 1)) {
                    $scope.confirmTokens = {
                        text :combineTokens(parents),
                        count : token.count
                    };
                }
            }
            else {
                deselect(token);
            }
        };

        // handle clicks on tokens in the probability tokens view
        $scope.highlightToken = function (selected, depth, token, others, parents) {
            if (selected) { return; }

            if (depth === $scope.project.toy.ngrams) {
                return;
            }

            $scope.toggleToken(token, others, parents);

            if (depth === ($scope.project.toy.ngrams - 1)) {
                tokenToRecompute = token;
                $scope.recomputeProbabilities();
            }
        };

        // -------------------------------------------------------------------



        // ===================================================================
        // TOY LANGUAGE MODEL - SELECTING TEMPERATURE / TOP-P
        //   starting phase:     TOY.TOKENS
        //   finishing phase:    TOY.TEMPERATURE
        // ===================================================================
        // invoked when the user clicks Next after viewing the sample tokens
        $scope.initToyModelTemperature = function () {
            loggerService.debug('[ml4klanguage] initToyModelTemperature');

            $scope.loading = true;
            $scope.phase = $scope.PHASES.TOY.TEMPERATURE;

            selectFirstToken();
            $scope.recomputeProbabilities();

            $scope.loading = false;
        };

        // when changing the tokens, any existing selection may become invalid
        //  this function deselects any current selection, and selects the
        //  first token instead
        function selectFirstToken () {
            // nothing to do if there aren't any tokens yet
            if (!$scope.project.toy.tokens) {
                return;
            }

            // clear current selection
            $scope.project.toy.tokens.forEach(deselect);

            if ($scope.project.toy.tokens.length === 0) {
                displayAlert('warnings', 400, { message : 'Please add more text to your corpus' });
            }
            else {
                // walk the ngrams tree, building up the joined up text to display
                //  in the "confirmTokens" box
                let nextToken = $scope.project.toy.tokens[0];
                $scope.confirmTokens = { text : '' };
                const selectionLength = ($scope.phase === $scope.PHASES.TOY.TOKENS) ? $scope.project.toy.ngrams + 1 : $scope.project.toy.ngrams;
                let parent;
                for (let i = 0; i < selectionLength; i++) {
                    $scope.confirmTokens = {
                        text : combineTokens([ $scope.confirmTokens.text, nextToken.token ]),
                        count : nextToken.count
                    };

                    nextToken.selected = true;

                    parent = nextToken;
                    nextToken = nextToken.next[0];
                }

                // token to display probability scores for is the parent of the
                //  selected word
                tokenToRecompute = parent;
            }
        }

        // recursively deselect all tokens
        function deselect(token) {
            token.selected = false;
            token.next.forEach(deselect);
        }

        // called when selecting a token, or modifying the temperature/topp score
        //  which impacts an already-selected token
        $scope.recomputeProbabilities = function () {
            $scope.generatedtokens = [];
            $scope.hovertoken = undefined;
            $scope.hoverexplain = undefined;

            if (tokenToRecompute) {
                let totalScaled = 0;
                for (const t of tokenToRecompute.next) {
                    if (t.cumprob > $scope.project.toy.topp) {
                        t.viz = 0;
                    }
                    else {
                        t._temp = Math.pow(t.count, 1 / $scope.project.toy.temperature);
                        totalScaled += t._temp;
                    }
                }
                for (const t of tokenToRecompute.next) {
                    if (t.cumprob <= $scope.project.toy.topp) {
                        t.viz = t._temp / totalScaled * 100;
                        if (t.viz < 1) {
                            t.viz = 0;
                        }
                        delete t._temp;
                    }
                }
            }
        }

        // -------------------------------------------------------------------




        // ===================================================================
        // SMALL LANGUAGE MODEL - SETUP
        // ===================================================================

        // Invoked when creating a new small language model project, or restoring a saved one
        //   Loads the web-llm library used to operate language models
        function setupSlmSupport () {
            return gpuDetectionService.isShaderF16Supported()
                .then((useShaderF16) => {
                    loggerService.debug('[ml4klanguage] shaderf16 support', useShaderF16);
                    $scope.slmModels = useShaderF16 ? modelsWhenShaderF16Supported : modelsWhenShaderF16NotSupported;
                    $scope.sizeChartData = $scope.slmModels.map((m) => {
                        return { id : m.id, label : m.label, value : m.storagemb };
                    });
                    $scope.complexityChartData = $scope.slmModels.map((m) => {
                        return { id : m.id, label : m.label, value : m.billionparameters };
                    });

                    return utilService.loadWebLlmProjectSupport();
                })
                .then((webllm) => {
                    $scope.webllmEngine = new webllm.MLCEngine({
                        // display download progress
                        initProgressCallback : (report) => {
                            if (!$scope.reconfiguring ||
                                ($scope.reconfiguring && report.progress === 1))
                            {
                                $scope.$applyAsync(() => {
                                    $scope.project.slm.download = report.progress * 100;
                                });
                            }
                            // log download progress
                            loggerService.debug('[ml4klanguage] Initialising model', report.text);
                        }
                    });
                });
        }

        $scope.dismissAgeWarning = function () {
            $scope.ageWarningDisplayed = true;
        }

        // -------------------------------------------------------------------



        // ===================================================================
        // SMALL LANGUAGE MODEL - DOWNLOAD MODEL
        // ===================================================================

        // this can be called if the user clicks the Download button, or if they
        //  change the size of the context window for a previously downloaded model
        $scope.downloadModel = function () {
            loggerService.debug('[ml4klanguage] downloadModel', $scope.project.slm.id);

            if ($scope.reconfiguring) {
                // download progress isn't displayed if we're doing this
                //  because of a change to the context window size (as we
                //  assume it should be quick)
            }
            else {
                // placeholder animation to get started until the first
                //  progress report is received
                $scope.project.slm.download = 101;
            }

            $scope.generating = false;
            $scope.resetContextWindow();

            const modelCfg = {};
            if ($scope.project.slm.contextwindow) {
                modelCfg.context_window_size = parseInt($scope.project.slm.contextwindow, 10);
            }

            loggerService.debug('[ml4klanguage] Using model config', modelCfg);

            return $scope.webllmEngine.reload($scope.project.slm.id, modelCfg)
                .then(() => {
                    loggerService.debug('[ml4klanguage] Downloaded model');

                    if (!$scope.reconfiguring) {
                        $scope.phase = $scope.PHASES.SMALL.CONTEXTWINDOW;
                    }
                })
                .catch((err) => {
                    loggerService.error('[ml4klanguage] Failed to download model', err);
                    if (err.message && err.message.startsWith('WebGPU is not supported')) {
                        displayAlert('errors', 400,
                            { message : 'Running small language models in Machine Learning for Kids uses ' +
                                        'a web browser feature called "WebGPU". WebGPU is not enabled in your ' +
                                        'browser. '});
                    }
                    else if (err.message && err.message.includes('insufficient memory or other GPU constraints')) {
                        if ($scope.project.slm.id === 'SmolLM2-135M-Instruct-q0f16-MLC') {
                            displayAlert('errors', 500,
                                { message : 'Sorry! Model could not be loaded - this could be because your computer ' +
                                            'does not have enough memory to run a small language model.'});
                        }
                        else {
                            displayAlert('errors', 400,
                                { message : 'Model could not be loaded - this could be because your computer ' +
                                            'does not have enough memory to run the model you have chosen. ' +
                                            'Try choosing a smaller model.'});
                        }
                    }
                    else if (err.message && err.message.startsWith('Cannot initialize runtime because of requested')) {
                        displayAlert('errors', 400,
                            { message : 'Running small language models in Machine Learning for Kids needs ' +
                                        'powerful computer hardware. Sorry, your computer does not meet the WebGPU ' +
                                        'requirements. '});
                    }
                    else {
                        displayAlert('errors', 500, err);
                    }
                });
        };

        // the selected model has changed - update the UI with info about the new model
        $scope.lookupSmallLanguageModelDetails = function () {
            loggerService.debug('[ml4klanguage] lookupSmallLanguageModelDetails');

            if ($scope.project.slm.id) {
                const identifiedModel = $scope.slmModels.find((m) => m.id === $scope.project.slm.id);
                $scope.project.slm.version = identifiedModel.version;
                $scope.project.slm.size = identifiedModel.size;
                $scope.project.slm.label = identifiedModel.label;
                $scope.project.slm.developer = identifiedModel.developer;
                $scope.project.slm.storage = identifiedModel.storage;
                // reset current download status
                $scope.project.slm.ready = false;
                delete $scope.project.slm.download;
                $scope.phase = $scope.PHASES.SMALL.ARCHITECTURE;
            }
        };

        // size of context window has been modified
        $scope.modifySmallModelContextWindow = function () {
            loggerService.debug('[ml4klanguage] modifySmallModelContextWindow');

            $scope.reconfiguring = true;
            $scope.downloadModel()
                .then(() => {
                    $scope.$applyAsync(() => {
                        $scope.reconfiguring = false;
                    });
                });
        };


        // -------------------------------------------------------------------



        // ===================================================================
        // SMALL LANGUAGE MODEL - SELECTING TEMPERATURE / TOP-P
        //   starting phase:     SMALL.CONTEXTWINDOW
        //   finishing phase:    SMALL.TEMPERATURE
        // ===================================================================
        // invoked when the user clicks Next after viewing the sample tokens
        $scope.initSmallModelTemperature = function () {
            loggerService.debug('[ml4klanguage] initSmallModelTemperature');
            $scope.phase = $scope.PHASES.SMALL.TEMPERATURE;
        };

        // -------------------------------------------------------------------


        // ===================================================================
        // SMALL LANGUAGE MODEL - PROVIDING RAG CONTEXT DOCUMENT
        //   starting phase:     SMALL.TEMPERATURE
        //   finishing phase:    SMALL.RAGCONTEXT
        // ===================================================================
        // invoked when the user clicks Next after specifying temp / top-p
        $scope.initSmallModelContext = function () {
            loggerService.debug('[ml4klanguage] initSmallModelContext');
            $scope.phase = $scope.PHASES.SMALL.RAGCONTEXT;
        };
        $scope.smallModelInitialContextClear = function () {
            $scope.resetContextWindow();

            if (!$scope.project.slm.initialcontext) {
                $scope.project.slm.initialcontext = {};
            }
            $scope.project.slm.initialcontext.state = 'none';

            if ($scope.phase === $scope.PHASES.SMALL.READY) {
                saveSmallLanguageModel();
            }
        };
        $scope.smallModelInitialContextSet = function () {
            $scope.resetContextWindow();

            if (!$scope.project.slm.initialcontext) {
                $scope.project.slm.initialcontext = {};
            }
            $scope.project.slm.initialcontext.state = 'provide';

            if ($scope.phase === $scope.PHASES.SMALL.READY) {
                saveSmallLanguageModel();
            }
        };
        $scope.removeContextDoc = function () {
            if ($scope.project.slm.initialcontext) {
                delete $scope.project.slm.initialcontext.doc;
            }

            if ($scope.phase === $scope.PHASES.SMALL.READY) {
                saveSmallLanguageModel();
            }
        };
        $scope.addContextText = function (ev) {
            $mdDialog.show({
                locals : {
                    dlgtitle : 'LANGUAGEMODEL.INITIALCONTEXT.ADDTEXT',
                    placeholder : 'Initial context text',
                    contents : $scope.project.slm.initialcontext && $scope.project.slm.initialcontext.doc && $scope.project.slm.initialcontext.doc.contents ? $scope.project.slm.initialcontext.doc.contents : '',
                },
                controller : function ($scope, locals) {
                    $scope.dlgtitle = locals.dlgtitle;
                    $scope.placeholder = locals.placeholder;
                    $scope.contents = locals.contents;
                    $scope.initialcontext = true;

                    $scope.hide = function() {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function(resp) {
                        $mdDialog.hide(resp);
                    };
                },
                templateUrl : 'static/components/languagemodel/corpustext.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (resp) {
                    $scope.project.slm.initialcontext = {
                        state : 'provide',
                        doc : {
                            type : 'text',
                            title : 'text',
                            contents : resp.contents
                        }
                    };
                    $scope.resetContextWindow();
                    saveSmallLanguageModel();
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };
        $scope.addContextFile = function (ev) {
            if (ev.currentTarget && ev.currentTarget.files) {
                return txtService.getContents(ev.currentTarget.files)
                    .then((allFiles) => {
                        $scope.project.slm.initialcontext = {
                            state : 'provide',
                            doc : allFiles[0]
                        };

                        saveSmallLanguageModel();
                        $scope.resetContextWindow();
                    })
                    .catch(() => {
                        displayAlert('errors', 500, { message : 'There was a problem reading your file' });
                    });
            }
        };
        $scope.addContextWikipediaPage = function (ev) {
            $mdDialog.show({
                locals : {
                    dlgtitle : 'LANGUAGEMODEL.INITIALCONTEXT.ADDWIKIPEDIA',
                    title : $scope.project.slm.initialcontext &&
                                $scope.project.slm.initialcontext.doc &&
                                $scope.project.slm.initialcontext.doc.contents &&
                                $scope.project.slm.initialcontext.doc.type === 'wikipedia' ? $scope.project.slm.initialcontext.doc.title : '',
                    contents : $scope.project.slm.initialcontext &&
                                $scope.project.slm.initialcontext.doc &&
                                $scope.project.slm.initialcontext.doc.contents &&
                                $scope.project.slm.initialcontext.doc.type === 'wikipedia' ? $scope.project.slm.initialcontext.doc.contents : '',
                },
                controller : function ($scope, locals) {
                    $scope.dlgtitle = locals.dlgtitle;
                    $scope.title = locals.title;
                    $scope.contents = locals.contents;

                    $scope.hide = function() {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function(resp) {
                        $mdDialog.hide(resp);
                    };

                    $scope.search = function (title) {
                        if (title) {
                            wikipediaService.searchByTitle(title)
                                .then((contents) => { $scope.contents = contents });
                        }
                    };
                },
                templateUrl : 'static/components/languagemodel/wikipedia.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (resp) {
                    $scope.project.slm.initialcontext = {
                        state : 'provide',
                        doc : {
                            type : 'wikipedia',
                            title : resp.title,
                            contents : resp.contents
                        }
                    };

                    saveSmallLanguageModel();
                    $scope.resetContextWindow();
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };

        // -------------------------------------------------------------------




        // ===================================================================
        // SAVE MODEL
        // ===================================================================
        // save the configuration for the current project
        function saveSmallLanguageModel() {
            return projectsService.storeSmallLanguageModelConfig($scope.project, {
                    id : $scope.project.slm.id,
                    contextwindow : $scope.project.slm.contextwindow,
                    temperature : $scope.project.slm.temperature,
                    topp : $scope.project.slm.topp,
                    initialcontext : $scope.project.slm.initialcontext
                })
                .then((updated) => {
                    updated.slm.download = $scope.project.slm.download;
                    updated.slm.ready = true;
                    return updated;
                });
        }
        function saveToyLanguageModel() {
            return projectsService.storeToyLanguageModelConfig($scope.project, {
                    ngrams : $scope.project.toy.ngrams,
                    temperature : $scope.project.toy.temperature,
                    topp : $scope.project.toy.topp
                })
                .then((updated) => {
                    updated.toy.ready = true;
                    updated.toy.tokens = $scope.project.toy.tokens;
                    return updated;
                });
        }

        // -------------------------------------------------------------------


        // ===================================================================
        // enables the testing view and the Scratch launch button
        // ===================================================================
        $scope.setProjectReady = function () {
            loggerService.debug('[ml4klanguage] setProjectReady');

            if ($scope.project.modeltype === 'toy') {
                saveToyLanguageModel()
                    .then((updated) => {
                        $scope.$applyAsync(() => {
                            $scope.phase = $scope.PHASES.TOY.READY;
                            $scope.project = updated;
                        });
                    })
                    .catch((err) => {
                        loggerService.error('[ml4klanguage] error saving model', err);
                        displayAlert('errors', 500, err);
                    });
            }
            else if ($scope.project.modeltype === 'small') {
                saveSmallLanguageModel()
                    .then((updated) => {
                        $scope.$applyAsync(() => {
                            $scope.phase = $scope.PHASES.SMALL.READY;
                            $scope.project = updated;
                        });
                    })
                    .catch((err) => {
                        loggerService.error('[ml4klanguage] error saving model', err);
                        displayAlert('errors', 500, err);
                    });
            }
        };

        // -------------------------------------------------------------------





        //=====================================================================
        // LANGUAGE MODEL - testing
        //=====================================================================
        $scope.testModel = function () {
            if (!$scope.prompt.message || $scope.prompt.message.trim().length === 0 || $scope.generating || $scope.loading || $scope.reconfiguring) {
                return;
            }

            const prompt = $scope.prompt.message;

            loggerService.debug('[ml4klanguage] testModel', prompt);

            $scope.generating = true;
            $scope.testfeedbacknomatch = false;
            $scope.testfeedbackmoretokens = false;

            let submitFn;
            if ($scope.project.modeltype === 'toy') {
                submitFn = useToyLanguageModel(prompt);
            }
            else if ($scope.project.modeltype === 'small') {
                submitFn = useSmallLanguageModel(prompt);
            }

            submitFn
                .then(() => {
                    $scope.$applyAsync(() => {
                        $scope.generating = false;
                        $scope.textgenerated = true;
                    });
                })
                .catch((err) => {
                    loggerService.error('[ml4klanguage] error submitting prompt', err);
                    displayAlert('errors', 500, err);
                });
        };



        //=====================================================================
        //  using the toy language model
        //=====================================================================

        const MAX_LENGTH = 500;

        $scope.shouldMerge = function (tok) {
            return ["'s", "'d", "."].includes(tok);
        };

        function combineTokens(alltokens) {
            return alltokens.reduce((acc, next) => {
                return acc + ($scope.shouldMerge(next) ? next : ' ' + next);
            });
        }

        function lookupBigrams(token0) {
            if (token0 in analyzedCorpus['1'].lookup)
            {
                const tok = analyzedCorpus['1'].lookup[token0];
                return { count : tok.count, next : tok.next };
            }
            return { count : 0, next : [] };
        }
        function lookupTrigrams(token0, token1) {
            if (token0 in analyzedCorpus['2'].lookup &&
                token1 in analyzedCorpus['2'].lookup[token0].next)
            {
                const tok = analyzedCorpus['2'].lookup[token0].next[token1];
                return { count : tok.count, next : tok.next };
            }
            return { count : 0, next : [] };
        }
        function lookupTetragrams(token0, token1, token2) {
            if (token0 in analyzedCorpus['3'].lookup &&
                token1 in analyzedCorpus['3'].lookup[token0].next &&
                token2 in analyzedCorpus['3'].lookup[token0].next[token1].next)
            {
                const tok = analyzedCorpus['3'].lookup[token0].next[token1].next[token2];
                return { count : tok.count, next : tok.next };
            }
            return { count : 0, next : [] };
        }


        function getCandidateNgrams(allNgramsList) {
            const candidates = allNgramsList.filter((i) => i.cumprob <= $scope.project.toy.topp);
            return (candidates.length > 0) ?
                    // return the candidates that meet top-p
                    candidates :
                    // but if there aren't any, force the first option - unusual, but
                    //  otherwise it's difficult to generate anything with a small corpus
                    //  so focus on making something usable over being overly faithful
                    [ allNgramsList[0] ];

        }
        function computeCandidateProbabilities(candidates) {
            let total = 0.0;
            const computedCandidates = candidates.map((c) => {
                const val = Math.pow(c.count, 1 / $scope.project.toy.temperature);
                total += val;
                return { token : c.token, count : c.count, val };
            });
            return computedCandidates.map((c) => {
                return { token : c.token, count : c.count, prob : c.val / total };
            });
        }
        function selectCandidate(candidates) {
            const rand = Math.random();
            let cum = 0;
            for (const candidate of candidates) {
                cum += candidate.prob;
                if (rand < cum) {
                    return candidate;
                }
            }
            throw new Error('Failure to select next token');
        }
        function chooseNgram(allNgrams) {
            const candidates = getCandidateNgrams(allNgrams);
            const computedCandidates = computeCandidateProbabilities(candidates);
            return selectCandidate(computedCandidates);
        }

        function representAsText(tok) {
            if (tok === '<STOP>') {
                return '.';
            }
            else {
                return tok;
            }
        }

        function genToken(idx, nextToken, candidates, input) {
            return {
                idx,
                text : representAsText(nextToken.token),
                token : nextToken.token,
                count : nextToken.count,
                prob : Math.round(100 * nextToken.prob),
                options : candidates.count,
                candidates : candidates.next.length,
                input
            };
        }

        function runBigrams(generatedTokens, token0String) {
            let bigramCandidates = lookupBigrams(token0String);
            while (bigramCandidates.next.length > 0 && generatedTokens.length < MAX_LENGTH) {
                const nextToken = chooseNgram(bigramCandidates.next);
                generatedTokens.push(
                    genToken(
                        generatedTokens.length,
                        nextToken,
                        bigramCandidates,
                        combineTokens([ token0String ])));

                token0String = nextToken.token;
                bigramCandidates = lookupBigrams(token0String);
            }
        }
        function runTrigrams(generatedTokens, token0String, token1String) {
            let trigramCandidates = lookupTrigrams(token0String, token1String);
            while (trigramCandidates.next.length > 0 && generatedTokens.length < MAX_LENGTH) {
                const nextToken = chooseNgram(trigramCandidates.next);
                generatedTokens.push(
                    genToken(
                        generatedTokens.length,
                        nextToken,
                        trigramCandidates,
                        combineTokens([ token0String, token1String ])));

                token0String = token1String;
                token1String = nextToken.token;
                trigramCandidates = lookupTrigrams(token0String, token1String);
            }
        }
        function runTetragrams(generatedTokens, token0String, token1String, token2String) {
            let tetragramCandidates = lookupTetragrams(token0String, token1String, token2String);
            while (tetragramCandidates.next.length > 0 && generatedTokens.length < MAX_LENGTH) {
                const nextToken = chooseNgram(tetragramCandidates.next);
                generatedTokens.push(
                    genToken(
                        generatedTokens.length,
                        nextToken,
                        tetragramCandidates,
                        combineTokens([ token0String, token1String, token2String ])));

                token0String = token1String;
                token1String = token2String;
                token2String = nextToken.token;
                tetragramCandidates = lookupTetragrams(token0String, token1String, token2String);
            }
        }

        async function useToyLanguageModel(prompt) {
            $scope.hovertoken = undefined;
            $scope.hoverexplain = undefined;

            $scope.generatedtokens = [ { idx : 0, text : '...' } ];

            if ($scope.project.toy.ready && analyzedCorpus) {
                const promptTokens = prompt.split(' ');
                if (promptTokens.length < $scope.project.toy.ngrams) {
                    $scope.testfeedbackmoretokens = true;
                    return $q.resolve('');
                }
                const tokensNeededIdx = promptTokens.length - $scope.project.toy.ngrams;
                const tokensToSubmit = promptTokens.slice(tokensNeededIdx);
                const tokensToIgnore = promptTokens.slice(0, tokensNeededIdx).join(' ');

                const generatedTokens = [ { idx : 0, text : tokensToIgnore, prompt : true }, { idx : 1, text : tokensToSubmit.join(' '), prompt : true } ];

                if ($scope.project.toy.ngrams === 1) {
                    runBigrams(generatedTokens, tokensToSubmit[0]);
                }
                else if ($scope.project.toy.ngrams === 2) {
                    runTrigrams(generatedTokens, tokensToSubmit[0], tokensToSubmit[1]);
                }
                else if ($scope.project.toy.ngrams === 3) {
                    runTetragrams(generatedTokens, tokensToSubmit[0], tokensToSubmit[1], tokensToSubmit[2]);
                }
                else {
                    return $q.reject('Context window size not selected');
                }

                if (generatedTokens.length === 2) {
                    $scope.testfeedbacknomatch = true;
                    return $q.resolve('');
                }

                $scope.generatedtokens = generatedTokens;

                return $q.resolve();
            }
            return $q.reject('Model not ready');
        }



        $scope.setHoverToken = function (generatedTokensIdx) {
            if ($scope.generatedtokens[generatedTokensIdx].prompt) {
                // ignore prompt words - they were generated because the user provided them
                return;
            }
            $scope.hovertoken = generatedTokensIdx;
            $scope.hoverexplain = $scope.generatedtokens[generatedTokensIdx];
        };

        function useRagContext() {
            return $scope.project.slm.initialcontext &&
                   $scope.project.slm.initialcontext.state === 'provide' &&
                   $scope.project.slm.initialcontext.doc &&
                   $scope.project.slm.initialcontext.doc.contents;
        }

        function startNewContext() {
            let systemPromptInsert = '';
            if (useRagContext()) {
                systemPromptInsert =
                    'You will be given additional context to help answer questions. ' +
//                    'Prioritize this context over outside knowledge. ';
                    'Answer only using the provided context. ';
            }
            return [
                {
                    role : 'system',
                    content :
                        'You are a friendly and supportive AI assistant for children. ' +
                        'Use simple, clear, and encouraging language. Keep responses short. ' +
                        'Avoid harmful, inappropriate, scary, or violent content. ' +
                        'Always be positive and constructive. Avoid sarcasm or harsh language. ' +
                        systemPromptInsert +
                        'Promote digital safety by reminding children not to share personal ' +
                        'information. If a child asks something unsafe, gently guide them toward ' +
                        'a trusted adult.'
                }
            ];
        }

        $scope.resetContextWindow = function () {
            $scope.generatedmessages = [];
        };

        function scrollToNewMessage () {
            $timeout(() => {
                $scope.prompt.message = '';
                const messagesContainer = document.getElementById('smallmodelmessages');
                if (messagesContainer) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }, 400);
        }

        async function useSmallLanguageModel(prompt) {
            if ($scope.generatedmessages.length === 0) {
                $scope.generatedmessages = startNewContext();
            }

            const ragPrompt = $scope.generatedmessages.length === 1 && useRagContext();

            $scope.generatedmessages.push({
                role : 'user',
                render : prompt,
                content : ragPrompt ?
                            "Question: " + prompt + "\n\nContext:\n" + $scope.project.slm.initialcontext.doc.contents :
                            prompt
            });
            scrollToNewMessage();

            try {
                const completion = await $scope.webllmEngine.chat.completions.create({
                    stream: true,
                    messages : $scope.generatedmessages.filter((m) => !m.inprogress).map((m) => { return { role : m.role, content : m.content }}),
                    top_p : $scope.project.slm.topp,
                    temperature : $scope.project.slm.temperature
                });

                const nextMessageIdx = $scope.generatedmessages.push({
                    role : 'assistant', content : '', render : '...', inprogress : true
                }) - 1;
                scrollToNewMessage();

                for await (const chunk of completion) {
                    const curDelta = chunk.choices[0].delta.content;
                    if (curDelta) {
                        const formatted = curDelta.replace(/\n/g, '<br>');
                        $scope.$applyAsync(() => {
                            $scope.generatedmessages[nextMessageIdx].content += curDelta;
                            if ($scope.generatedmessages[nextMessageIdx].render === '...') {
                                $scope.generatedmessages[nextMessageIdx].render = formatted;
                            }
                            else {
                                $scope.generatedmessages[nextMessageIdx].render  += formatted;
                            }
                        });
                    }
                }

                const finalMessage = await $scope.webllmEngine.getMessage();
                const response = finalMessage.replace(/\n/g, '<br>');

                loggerService.debug('[ml4klanguage] response', response);
                $scope.generatedmessages[nextMessageIdx].content = finalMessage;
                $scope.generatedmessages[nextMessageIdx].render = response;
                delete $scope.generatedmessages[nextMessageIdx].inprogress;
            }
            catch (err) {
                loggerService.error('[ml4klanguage] failure from small language model', err);
                $scope.generatedmessages = $scope.generatedmessages.filter((m) => !m.inprogress);

                if (err.message.includes('tokens exceed context window size') && $scope.generatedmessages.length > 1)
                {
                    if (ragPrompt) {
                        displayAlert('errors', err.status, { message : simplifyError(err.message) });
                    }
                    else {
                        // remove the user prompt just added
                        $scope.generatedmessages.pop();

                        // remove the oldest non-system message
                        $scope.generatedmessages.splice(1, 1);

                        // retry
                        return useSmallLanguageModel(prompt);
                    }
                }
                else {
                    throw err;
                }
            }
        }


        /*
        $scope.debug = function (p) {
            return JSON.stringify(p, null, 4).replaceAll('    ', ' &nbsp; &nbsp;').replace(/\n/g, '<br>');
        };
        */

        function simplifyError(str) {
            const tooManyTokensErr = 'Consider shortening the prompt, or increase `context_window_size`, or using sliding window via `sliding_window_size`';
            if (str.includes(tooManyTokensErr)) {
                return str.replace(tooManyTokensErr,
                    useRagContext() ?
                        ' Try a shorter prompt and initial context, or increase the size of the context window' :
                        ' Try a shorter prompt or increase the size of the context window');
            }
            return str;
        }

        $scope.getController = function () {
            return vm;
        };
    }
}());
