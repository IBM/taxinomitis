(function () {

    angular
        .module('app')
        .controller('LanguageModelController', LanguageModelController);

    LanguageModelController.$inject = [
        'authService', 'projectsService', 'trainingService',
        'wikipediaService', 'languageModelService',
        'utilService', 'loggerService',
        '$mdDialog',
        '$stateParams',
        '$scope', '$timeout'
    ];

    function LanguageModelController(authService, projectsService, trainingService, wikipediaService, languageModelService, utilService, loggerService, $mdDialog, $stateParams, $scope, $timeout) {
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

            $scope.$applyAsync(() => {
                vm[type].push({
                    alertid : alertId++,
                    message : errObj.message || errObj.error || 'Unknown error',
                    status : status
                });
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
                READY         : 'small_ready'
            }
        };

        $scope.phase = $scope.PHASES.INITIAL;

        // all model types
        $scope.loading = true;
        $scope.reconfiguring = false;
        $scope.generated = 'Generated text';

        // toy language models
        $scope.corpus = [];
        let tokenToRecompute;
        let analyzedCorpus;

        // -------------------------------------------------------------------



        // ===================================================================
        // SMALL LANGUAGE MODELS - available models
        // ===================================================================

        $scope.slmModels = [
            {
                id : 'SmolLM2-135M-Instruct-q0f16-MLC',
                version : 'SmolLM2',
                size : '135M',
                label : 'Smol',
                developer : 'Hugging Face',
                storage : '276 MB'
            },
            {
                id : 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC-1k',
                version : '1.0',
                size : '1.1B',
                label : 'Tiny Llama',
                developer : 'Singapore University of Technology and Design',
                storage : '625 MB'
            },
            {
                id : 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
                version : '3.2',
                size : '1B',
                label : 'Llama',
                developer : 'Meta',
                storage : '711 MB'
            },
            {
                id : 'phi-1_5-q4f16_1-MLC',
                version : '1.5',
                size : '1.3B',
                label : 'Phi',
                developer : 'Microsoft',
                storage : '806 MB'
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
                loggerService.error('[ml4klanguage] error', err);
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
                    for (const doc of docs) {
                        $scope.$applyAsync(() => {
                            $scope.corpus.push({
                                id : doc.id,
                                title : doc.title,
                                type : doc.type
                            });
                        });
                    }

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
                                analyzedCorpus = savedCorpus;
                                if ($scope.project.toy.ngrams) {
                                    $scope.phase = $scope.PHASES.TOY.READY;
                                    $scope.project.toy.ready = true;
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
                        return Promise.resolve();
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
            if ($scope.project.toy && $scope.project.toy.tokens) {
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
                controller : function ($scope) {
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
                controller : function ($scope) {
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
                const allFiles = [];
                for (let idx = 0; idx < ev.currentTarget.files.length; idx++) {
                    allFiles.push({
                        type : 'text',
                        title : ev.currentTarget.files[idx].name,
                        contents : 'placeholder'
                    });
                }
                addToyCorpusItems(allFiles);
            }
        };

        // -------------------------------------------------------------------



        // ===================================================================
        // TOY LANGUAGE MODEL - CORPUS PROCESSING - turning into n-grams
        // ===================================================================

        function parseCorpus() {
            return trainingService.getTraining($scope.projectId, $scope.userId, $scope.project.classid)
                .then((corpus) => {
                    const text = corpus.map((doc) => doc.contents);
                    return languageModelService.generateNgrams($scope.userId, $scope.project.classid, text);
                })
                .then((output) => {
                    const bigramCounts    = sumCounts(output.bigrams.sorted);
                    const trigramCounts   = sumCounts(output.trigrams.sorted);
                    const tetragramCounts = sumCounts(output.tetragrams.sorted);
                    analyzedCorpus = {
                        '1' : {
                            totalTokens : bigramCounts,
                            lookup : output.bigrams.lookup,
                            sorted : output.bigrams.sorted,
                            summary : generateCumulativeProbability(output.bigrams.sorted, bigramCounts)
                        },
                        '2' : {
                            totalTokens : trigramCounts,
                            lookup : output.trigrams.lookup,
                            sorted : output.trigrams.sorted,
                            summary : generateCumulativeProbability(output.trigrams.sorted, trigramCounts)
                        },
                        '3' : {
                            totalTokens : tetragramCounts,
                            lookup : output.tetragrams.lookup,
                            sorted : output.tetragrams.sorted,
                            summary : generateCumulativeProbability(output.tetragrams.sorted, tetragramCounts)
                        }
                    };

                    // save the parsed corpus for reuse
                    trainingService.storeAsset($scope.project, analyzedCorpus);
                });
        }

        function generateCumulativeProbability(tokens, parentsize) {
            let cumulativeProbability = 0;
            const processedTokens = tokens.map((t) => {
                const probability = t.count / parentsize;
                cumulativeProbability = Math.min(cumulativeProbability + probability, 1.0);
                return {
                    token : t.token,
                    count : t.count,
                    probability,
                    cumulativeProbability,
                    next : generateCumulativeProbability(t.next, t.count)
                };
            });
            return processedTokens.slice(0, 15);
        }

        function sumCounts(tokens) {
            let count = 0;
            tokens.forEach((t) => count += t.count);
            return count;
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
            if ($scope.phase === $scope.PHASES.TOY.TOKENS) {
                selectFirstToken();
            }

            // if the user is viewing probability scores, recompute with the new ngram size
            if ($scope.phase === $scope.PHASES.TOY.TEMPERATURE) {
                selectFirstToken();
                $scope.recomputeProbabilities();
            }
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

            $scope.loading = true;
            parseCorpus()
                .then(() => {
                    $scope.project.toy.tokens = analyzedCorpus[$scope.project.toy.ngrams].summary;
                    $scope.$applyAsync(() => {
                        $scope.phase = $scope.PHASES.TOY.TOKENS;
                        selectFirstToken();
                        $scope.loading = false;
                    });
                })
                .catch((err) => {
                    loggerService.error('[ml4klanguage] error generating ngrams', err);
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
                        text : parents.join(' ').replaceAll(" 's ", "'s "),
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

            // walk the ngrams tree, building up the joined up text to display
            //  in the "confirmTokens" box
            let nextToken = $scope.project.toy.tokens[0];
            $scope.confirmTokens = { text : '' };
            const selectionLength = ($scope.phase === $scope.PHASES.TOY.TOKENS) ? $scope.project.toy.ngrams + 1 : $scope.project.toy.ngrams;
            let parent;
            for (let i = 0; i < selectionLength; i++) {
                $scope.confirmTokens = {
                    text : $scope.confirmTokens.text + ' ' + nextToken.token,
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

        // recursively deselect all tokens
        function deselect(token) {
            token.selected = false;
            token.next.forEach(deselect);
        }

        // called when selecting a token, or modifying the temperature/topp score
        //  which impacts an already-selected token
        $scope.recomputeProbabilities = function () {
            loggerService.debug('[ml4klanguage] recomputeProbabilities');

            if (tokenToRecompute) {
                let totalScaled = 0;
                for (const t of tokenToRecompute.next) {
                    if (t.cumulativeProbability > $scope.project.toy.topp) {
                        t.viz = 0;
                    }
                    else {
                        t._temp = Math.pow(t.count, 1 / $scope.project.toy.temperature);
                        totalScaled += t._temp;
                    }
                }
                for (const t of tokenToRecompute.next) {
                    if (t.cumulativeProbability <= $scope.project.toy.topp) {
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
            return utilService.loadWebLlmProjectSupport()
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

        // -------------------------------------------------------------------



        // ===================================================================
        // SMALL LANGUAGE MODEL - DOWNLOAD MODEL
        // ===================================================================

        // this can be called if the user clicks the Download button, or if they
        //  change the size of the context window for a previously downloaded model
        $scope.downloadModel = function () {
            loggerService.debug('[ml4klanguage] downloadModel', $scope.project.slm.id);

            if (!$scope.reconfiguring) {
                // download progress isn't displayed if we're doing this
                //  because of a change to the context window size (as we
                //  assume it should be quick)
                $scope.project.slm.download = 0;
            }

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
                    loggerService.error('[ml4klanguage] Failed to download model');
                    displayAlert('errors', 500, err);
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
        // SAVE MODEL
        // ===================================================================
        // save the configuration for the current project
        function saveSmallLanguageModel() {
            return projectsService.storeSmallLanguageModelConfig($scope.project, {
                    id : $scope.project.slm.id,
                    contextwindow : $scope.project.slm.contextwindow,
                    temperature : $scope.project.slm.temperature,
                    topp : $scope.project.slm.topp
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
        $scope.testModel = function (prompt) {
            loggerService.debug('[ml4klanguage] testModel', prompt);

            $scope.generating = true;
            $scope.generated = '...';

            let submitFn;
            if ($scope.project.modeltype === 'toy') {
                submitFn = useToyLanguageModel(prompt);
            }
            else if ($scope.project.modeltype === 'small') {
                submitFn = useSmallLanguageModel(prompt);
            }

            submitFn
                .then((response) => {
                    $scope.$applyAsync(() => {
                        $scope.generated = response;
                        $scope.generating = false;
                        $scope.textgenerated = true;
                    });
                })
                .catch((err) => {
                    loggerService.error('[ml4klanguage] error submitting prompt', err);
                    displayAlert('errors', 500, err);
                });
        };


        function getTokenWithHighestCount(obj) {
            let highest;
            for (const key in obj) {
                if (!highest || obj[key].count > highest.count) {
                    highest = obj[key];
                }
            }
            return highest;
        }

        function runBigrams() {
            let generated = '';
            console.log('using bigrams');
            const lookup = analyzedCorpus['1'].lookup;
            const sorted = analyzedCorpus['1'].sorted;

            let token0Object = sorted[0];
            let token0Bigrams = lookup[token0Object.token].next;
            generated = token0Object.token;

            let token1Object = getTokenWithHighestCount(token0Bigrams);
            while (token1Object && generated.length < 1000) {
                if (token1Object.token === "'s") {
                    generated += token1Object.token;
                }
                else {
                    generated += ' ' + token1Object.token;
                }

                token0Object = lookup[token1Object.token];
                token1Object = getTokenWithHighestCount(token0Object.next);
            }
            return generated;
        }
        function runTrigrams() {
            let generated = '';
            console.log('using trigrams');
            const lookup = analyzedCorpus['2'].lookup;
            const sorted = analyzedCorpus['2'].sorted;

            let token0Object = sorted[0];
            let token1Object = token0Object.next[0];

            let token1Trigrams = lookup[token0Object.token].next[token1Object.token].next;
            generated = token0Object.token + ' ' + token1Object.token;

            let token2Object = getTokenWithHighestCount(token1Trigrams);
            while (token2Object && generated.length < 1000) {
                if (token2Object.token === "'s") {
                    generated += token2Object.token;
                }
                else {
                    generated += ' ' + token2Object.token;
                }

                const newToken0 = token1Object.token;
                const newToken1 = token2Object.token;

                token0Object = lookup[newToken0];
                token1Object = token0Object.next[newToken1];

                token2Object = getTokenWithHighestCount(token1Object.next);
            }
            return generated;
        }
        function runTetragrams() {
            let generated = '';
            console.log('using tetragrams');
            const lookup = analyzedCorpus['3'].lookup;
            const sorted = analyzedCorpus['3'].sorted;

            let token0Object = sorted[0];
            let token1Object = token0Object.next[0];
            let token2Object = token1Object.next[0];

            let token2Trigrams = lookup[token0Object.token].next[token1Object.token].next[token2Object.token].next;
            generated = token0Object.token + ' ' + token1Object.token + ' ' + token2Object.token;

            let token3Object = getTokenWithHighestCount(token2Trigrams);
            while (token3Object && generated.length < 1000) {
                if (token3Object.token === "'s") {
                    generated += token3Object.token;
                }
                else {
                    generated += ' ' + token3Object.token;
                }

                const newToken0 = token1Object.token;
                const newToken1 = token2Object.token;
                const newToken2 = token3Object.token;

                token0Object = lookup[newToken0];
                token1Object = token0Object.next[newToken1];
                token2Object = token1Object.next[newToken2];

                token3Object = getTokenWithHighestCount(token2Object.next);
            }
            return generated;
        }

        async function useToyLanguageModel(prompt) {
            if ($scope.project.toy.ready) {
                return Promise.resolve('<h3>bigrams</h3>' + runBigrams() + '<hr>' + '<h3>trigrams</h3>' + runTrigrams() + '<hr>' + '<h3>tetragrams</h3>' + runTetragrams());
            }
            return Promise.reject('Model not ready');
        }






        async function useSmallLanguageModel(prompt) {
            const completion = await $scope.webllmEngine.chat.completions.create({
                stream: true,
                messages : [
                    { role : 'system', content : 'You are a helpful AI agent helping users.' },
                    { role : 'user',   content : prompt }
                ],
                top_p : $scope.project.slm.topp,
                temperature : $scope.project.slm.temperature
            });

            $scope.generated = '';
            for await (const chunk of completion) {
                const curDelta = chunk.choices[0].delta.content;
                if (curDelta) {
                    const formatted = curDelta.replace(/\n/g, '<br>');
                    $scope.$applyAsync(() => {
                        $scope.generated += formatted;
                    });
                }
            }

            const finalMessage = await $scope.webllmEngine.getMessage();
            return finalMessage.replace(/\n/g, '<br>');
        }


        /*
        $scope.debug = function (p) {
            return JSON.stringify(p, null, 4).replaceAll('    ', ' &nbsp; &nbsp;').replace(/\n/g, '<br>');
        };
        */

        $scope.getController = function () {
            return vm;
        };
    }
}());
