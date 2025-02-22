(function () {

    angular
        .module('app')
        .controller('LanguageModelController', LanguageModelController);

    LanguageModelController.$inject = [
        'authService', 'projectsService', 'trainingService', 'utilService',
        'loggerService',
        '$mdDialog',
        '$stateParams',
        '$scope', '$timeout'
    ];

    function LanguageModelController(authService, projectsService, trainingService, utilService, loggerService, $mdDialog, $stateParams, $scope, $timeout) {
        var vm = this;
        vm.authService = authService;

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

            vm[type].push({
                alertid : alertId++,
                message : errObj.message || errObj.error || 'Unknown error',
                status : status
            });
        }
        vm.displayAlert = displayAlert;

        $scope.loading = true;
        $scope.reconfiguring = false;
        $scope.projectId = $stateParams.projectId;
        $scope.userId = $stateParams.userId;

        $scope.generated = 'Generated text';



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

        $scope.corpus = [];

        const temp_tokens = [
            {
                token : 'ipsum',
                count : 98,
                next : [
                    {
                        token : 'laoreet',
                        count : 28,
                        next : [
                            {
                                token : 'nibh',
                                count : 10,
                                next : [
                                    {
                                        token : 'ante',
                                        count : 6,
                                        next : []
                                    },
                                    {
                                        token : 'malesuada',
                                        count : 3,
                                        next : []
                                    },
                                    {
                                        token : 'tristique',
                                        count : 1,
                                        next : []
                                    }
                                ]
                            },
                            {
                                token : 'augue',
                                count : 8,
                                next : []
                            },
                            {
                                token : 'curabitur',
                                count : 5,
                                next : []
                            },
                            {
                                token : 'consequat',
                                count : 4,
                                next : []
                            },
                            {
                                token : 'adipiscing',
                                count : 1,
                                next : []
                            }
                        ]
                    },
                    {
                        token : 'elit',
                        count : 20,
                        next : []
                    },
                    {
                        token : 'nec',
                        count : 18,
                        next : []
                    },
                    {
                        token : 'venenatis',
                        count : 14,
                        next : [
                            {
                                token : 'ullamcorper',
                                count : 8,
                                next : []
                            },
                            {
                                token : 'rutrum',
                                count : 5,
                                next : []
                            },
                            {
                                token : 'tortor',
                                count : 3,
                                next : [
                                    {
                                        token : 'consectetur',
                                        count : 2,
                                        next : []
                                    },
                                    {
                                        token : 'velit',
                                        count : 1,
                                        next : []
                                    }
                                ]
                            },
                            {
                                token : 'veniam',
                                count : 1,
                                next : []
                            }
                        ]
                    },
                    {
                        token : 'lacinia',
                        count : 10,
                        next : []
                    },
                    {
                        token : 'efficitur',
                        count : 8,
                        next : []
                    }
                ]
            },
            {
                token : 'odor',
                count : 92,
                next : []
            },
            {
                token : 'amet',
                count : 88,
                next : []
            },
            {
                token : 'consectetuer',
                count : 71,
                next : []
            },
            {
                token : 'lorem',
                count : 63,
                next : [
                    {
                        token : 'sunt',
                        count : 30,
                        next : [
                            {
                                token : 'ultricies',
                                count : 14,
                                next : [
                                    {
                                        token : 'placerat',
                                        count : 3,
                                        next : []
                                    },
                                    {
                                        token : 'platea',
                                        count : 3,
                                        next : []
                                    },
                                    {
                                        token : 'torquent',
                                        count : 2,
                                        next : []
                                    },
                                    {
                                        token : 'consequat',
                                        count : 2,
                                        next : []
                                    },
                                    {
                                        token : 'potenti',
                                        count : 2,
                                        next : []
                                    },
                                    {
                                        token : 'tristique',
                                        count : 1,
                                        next : []
                                    },
                                    {
                                        token : 'dapibus',
                                        count : 1,
                                        next : []
                                    }
                                ]
                            },
                            {
                                token : 'eget',
                                count : 8,
                                next : []
                            },
                            {
                                token : 'molestie',
                                count : 5,
                                next : []
                            },
                            {
                                token : 'fermentum',
                                count : 1,
                                next : []
                            },
                            {
                                token : 'dapibus',
                                count : 1,
                                next : []
                            },
                            {
                                token : 'posuere',
                                count : 1,
                                next : []
                            }
                        ]
                    },
                    {
                        token : 'culpa',
                        count : 20,
                        next : []
                    },
                    {
                        token : 'officia',
                        count : 7,
                        next : []
                    },
                    {
                        token : 'mollit',
                        count : 3,
                        next : []
                    },
                    {
                        token : 'laborum',
                        count : 1,
                        next : []
                    },
                    {
                        token : 'eiusmod',
                        count : 1,
                        next : []
                    },
                    {
                        token : 'adipiscing',
                        count : 1,
                        next : []
                    }
                ]
            },
            {
                token : 'fugiat',
                count : 62,
                next : [
                    {
                        token : 'molestie',
                        count : 14,
                        next : []
                    },
                    {
                        token : 'augue',
                        count : 13,
                        next : [],
                    },
                    {
                        token : 'dolor',
                        count : 10,
                        next : []
                    },
                    {
                        token : 'reprehenderit',
                        count : 8,
                        next : []
                    },
                    {
                        token : 'aliquip',
                        count : 7,
                        next : []
                    },
                    {
                        token : 'eiusmod',
                        count : 7,
                        next : []
                    },
                    {
                        token : 'nulla',
                        count : 3,
                        next : []
                    }
                ]
            },
            {
                token : 'adipiscing',
                count : 51,
                next : []
            },
            {
                token : 'esse',
                count : 36,
                next : []
            }
        ];

        const temp_tokens_with_pos = [
            {
                token : 'ipsum [NOUN]',
                count : 98,
                next : [
                    {
                        token : 'laoreet [VERB]',
                        count : 28,
                        next : [
                            {
                                token : 'nibh',
                                count : 10,
                                next : [
                                    {
                                        token : 'ante',
                                        count : 6,
                                        next : []
                                    },
                                    {
                                        token : 'malesuada',
                                        count : 3,
                                        next : []
                                    },
                                    {
                                        token : 'tristique',
                                        count : 1,
                                        next : []
                                    }
                                ]
                            },
                            {
                                token : 'augue',
                                count : 8,
                                next : []
                            },
                            {
                                token : 'curabitur',
                                count : 5,
                                next : []
                            },
                            {
                                token : 'consequat',
                                count : 4,
                                next : []
                            },
                            {
                                token : 'adipiscing',
                                count : 1,
                                next : []
                            }
                        ]
                    },
                    {
                        token : 'elit',
                        count : 20,
                        next : []
                    },
                    {
                        token : 'nec',
                        count : 18,
                        next : []
                    },
                    {
                        token : 'venenatis',
                        count : 14,
                        next : [
                            {
                                token : 'ullamcorper',
                                count : 8,
                                next : []
                            },
                            {
                                token : 'rutrum',
                                count : 5,
                                next : []
                            },
                            {
                                token : 'tortor',
                                count : 3,
                                next : [
                                    {
                                        token : 'consectetur',
                                        count : 2,
                                        next : []
                                    },
                                    {
                                        token : 'velit',
                                        count : 1,
                                        next : []
                                    }
                                ]
                            },
                            {
                                token : 'veniam',
                                count : 1,
                                next : []
                            }
                        ]
                    },
                    {
                        token : 'lacinia',
                        count : 10,
                        next : []
                    },
                    {
                        token : 'efficitur',
                        count : 8,
                        next : []
                    }
                ]
            },
            {
                token : 'odor [VERB]',
                count : 92,
                next : []
            },
            {
                token : 'amet [NOUN]',
                count : 88,
                next : []
            },
            {
                token : 'consectetuer [NOUN]',
                count : 71,
                next : []
            },
            {
                token : 'lorem [VERB]',
                count : 63,
                next : [
                    {
                        token : 'sunt',
                        count : 30,
                        next : [
                            {
                                token : 'ultricies',
                                count : 14,
                                next : [
                                    {
                                        token : 'placerat',
                                        count : 3,
                                        next : []
                                    },
                                    {
                                        token : 'platea',
                                        count : 3,
                                        next : []
                                    },
                                    {
                                        token : 'torquent',
                                        count : 2,
                                        next : []
                                    },
                                    {
                                        token : 'consequat',
                                        count : 2,
                                        next : []
                                    },
                                    {
                                        token : 'potenti',
                                        count : 2,
                                        next : []
                                    },
                                    {
                                        token : 'tristique',
                                        count : 1,
                                        next : []
                                    },
                                    {
                                        token : 'dapibus',
                                        count : 1,
                                        next : []
                                    }
                                ]
                            },
                            {
                                token : 'eget',
                                count : 8,
                                next : []
                            },
                            {
                                token : 'molestie',
                                count : 5,
                                next : []
                            },
                            {
                                token : 'fermentum',
                                count : 1,
                                next : []
                            },
                            {
                                token : 'dapibus',
                                count : 1,
                                next : []
                            },
                            {
                                token : 'posuere',
                                count : 1,
                                next : []
                            }
                        ]
                    },
                    {
                        token : 'culpa',
                        count : 20,
                        next : []
                    },
                    {
                        token : 'officia',
                        count : 7,
                        next : []
                    },
                    {
                        token : 'mollit',
                        count : 3,
                        next : []
                    },
                    {
                        token : 'laborum',
                        count : 1,
                        next : []
                    },
                    {
                        token : 'eiusmod',
                        count : 1,
                        next : []
                    },
                    {
                        token : 'adipiscing',
                        count : 1,
                        next : []
                    }
                ]
            },
            {
                token : 'fugiat [ADJ]',
                count : 62,
                next : [
                    {
                        token : 'molestie',
                        count : 14,
                        next : []
                    },
                    {
                        token : 'augue',
                        count : 13,
                        next : [],
                    },
                    {
                        token : 'dolor',
                        count : 10,
                        next : []
                    },
                    {
                        token : 'reprehenderit',
                        count : 8,
                        next : []
                    },
                    {
                        token : 'aliquip',
                        count : 7,
                        next : []
                    },
                    {
                        token : 'eiusmod',
                        count : 7,
                        next : []
                    },
                    {
                        token : 'nulla',
                        count : 3,
                        next : []
                    }
                ]
            },
            {
                token : 'adipiscing [VERB]',
                count : 51,
                next : []
            },
            {
                token : 'esse [NOUN]',
                count : 36,
                next : []
            }
        ];

        let tokenToRecompute;


        authService.getProfileDeferred()
            .then((profile) => {
                vm.profile = profile;

                loggerService.debug('[ml4kproj] getting project info');
                return projectsService.getProject($scope.projectId, $scope.userId, profile.tenant);
            })
            .then((project) => {
                $scope.project = project;

                if ($scope.project.modeltype === 'small') {
                    return setupSlmSupport()
                        .then(() => {
                            if ($scope.project.slm && $scope.project.slm.id) {
                                $scope.lookupSlmInfo();
                                return $scope.downloadModel()
                                    .then(() => {
                                        $scope.project.slm.ready = true;
                                    })
                            }
                            else {
                                $scope.project.slm = { };
                            }
                        });
                }
                else if ($scope.project.modeltype === 'toy') {
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
                        });

                }
            })
            .then(() => {
                $scope.loading = false;
            })
            .catch((err) => {
                loggerService.error('[ml4klangauge] error', err);
                displayAlert('errors', err.status, err.data ? err.data : err);
            });



        $scope.lookupSlmInfo = function () {
            if ($scope.project.slm.id) {
                const identifiedModel = $scope.slmModels.find((m) => m.id === $scope.project.slm.id);
                $scope.project.slm.version = identifiedModel.version;
                $scope.project.slm.size = identifiedModel.size;
                $scope.project.slm.label = identifiedModel.label;
                $scope.project.slm.developer = identifiedModel.developer;
                $scope.project.slm.storage = identifiedModel.storage;
                $scope.project.slm.ready = false;
                delete $scope.project.slm.download;
            }
        };

        function setupSlmSupport () {
            return utilService.loadWebLlmProjectSupport()
                .then((webllm) => {
                    $scope.webllmEngine = new webllm.MLCEngine();
                    $scope.webllmEngine.setInitProgressCallback((report) => {
                        if (!$scope.reconfiguring ||
                            ($scope.reconfiguring && report.progress === 1))
                        {
                            $scope.$applyAsync(() => {
                                $scope.project.slm.download = report.progress * 100;
                            });
                        }
                        loggerService.debug('[ml4klangauge] Initialising model', report.text);
                    });
                });
        }


        $scope.initModelType = function (type) {
            if ($scope.loading) {
                return;
            }

            if (type === 'small') {
                $scope.loading = true;

                projectsService.setLanguageModelType($scope.project, type)
                    .then(() => {
                        return setupSlmSupport();
                    })
                    .then(() => {
                        $scope.project.slm = { };
                        $scope.project.modeltype = type;
                        $scope.$applyAsync(() => {
                            $scope.loading = false;
                        });
                    })
                    .catch((err) => {
                        loggerService.error('[ml4klangauge] Failed to get webllm library');
                        displayAlert('errors', 500, err);
                        $scope.loading = false;
                    });
            }
            else {
                $scope.loading = true;

                projectsService.setLanguageModelType($scope.project, type)
                    .then(() => {
                        $scope.project.modeltype = type;
                        $scope.$applyAsync(() => {
                            $scope.loading = false;
                        });
                    })
                    .catch((err) => {
                        loggerService.error('[ml4klangauge] Failed to get webllm library');
                        displayAlert('errors', 500, err);
                        $scope.loading = false;
                    });
            }
        };

        $scope.modifySlmContextWindow = function () {
            loggerService.debug('[ml4klangauge] Modifying context window');
            $scope.reconfiguring = true;
            $scope.downloadModel()
                .then(() => {
                    $scope.$applyAsync(() => {
                        $scope.reconfiguring = false;
                    });
                });
        };

        $scope.downloadModel = function () {
            loggerService.debug('[ml4klangauge] Downloading model', $scope.project.slm.id);
            if (!$scope.reconfiguring) {
                $scope.project.slm.download = 0;
            }
            const modelCfg = {};
            if ($scope.project.slm.contextwindow) {
                modelCfg.context_window_size = parseInt($scope.project.slm.contextwindow, 10);
            }
            loggerService.debug('[ml4klangauge] Using model config', modelCfg);
            return $scope.webllmEngine.reload($scope.project.slm.id, modelCfg)
                .then((a) => {
                    loggerService.debug('[ml4klangauge] Downloaded model');
                })
                .catch((err) => {
                    loggerService.error('[ml4klangauge] Failed to download model');
                    displayAlert('errors', 500, err);
                });
        };


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
                })
                .catch((err) => {
                    loggerService.error('[ml4klangauge] Failed to store corpus');
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
                    for (const added of allAdded) {
                        $scope.$applyAsync(() => {
                            $scope.corpus.push({
                                id : added.id,
                                title : added.title,
                                type : added.type
                            });
                        });
                    }
                })
                .catch((err) => {
                    loggerService.error('[ml4klangauge] Failed to store corpus');
                    displayAlert('errors', 500, err);
                });
        }



        $scope.addCorpusText = function (ev) {
            $mdDialog.show({
                locals : {
                    project : $scope.project
                },
                controller : function ($scope, locals) {
                    $scope.project = locals.project;
                    $scope.values = {};

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

        $scope.removeCorpusDoc = function (id) {
            $scope.corpus = $scope.corpus.filter((doc) => doc.id !== id);
        };

        $scope.changeNgramSize = function () {
            $scope.project.toy.ngrams = ($scope.project.toy.ngrams === 3 ? 1 : $scope.project.toy.ngrams + 1);
            if ($scope.project.toy.temperature || $scope.project.toy.topp) {
                $scope.initToyTemperature();
                $scope.recomputeToyScores();
            }
            else {
                if ($scope.project.toy.tokens) {
                    $scope.project.toy.tokens.forEach(deselect);
                }
                delete $scope.confirmTokens;
            }
        };

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
            return processedTokens;
        }

        function sumCounts(tokens) {
            let count = 0;
            tokens.forEach((t) => count += t.count);
            return count;
        }

        $scope.initTokens = function () {
            const totalCounts = sumCounts(temp_tokens);
            $scope.project.toy.tokens = generateCumulativeProbability(temp_tokens, totalCounts);
        };

        function deselect(token) {
            token.selected = false;
            token.next.forEach(deselect);
        }

        $scope.toggleToken = function (token, others, parents) {
            delete $scope.confirmTokens;

            token.selected = !token.selected;
            if (token.selected) {
                others
                    .filter((t) => t.token !== token.token)
                    .forEach(deselect);

                if (parents.length === ($scope.project.toy.ngrams + 1)) {
                    $scope.confirmTokens = {
                        text : parents.join(' '),
                        count : token.count
                    };
                }
            }
        };

        $scope.highlightToken = function (selected, depth, token, others, parents) {
            if (selected) { return; }

            $scope.toggleToken(token, others, parents);

            if (depth === ($scope.project.toy.ngrams - 1)) {
                tokenToRecompute = token;
                $scope.recomputeToyScores();
            }
        };

        $scope.recomputeToyScores = function () {
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

        $scope.initToyTemperature = function () {
            $scope.project.toy.tokens.forEach(deselect);

            let nextToken = $scope.project.toy.tokens[0];
            $scope.confirmTokens = {
                text : ''
            };
            let parent;

            for (let i = 0; i < $scope.project.toy.ngrams; i++) {
                $scope.confirmTokens = {
                    text : $scope.confirmTokens.text + ' ' + nextToken.token,
                    count : nextToken.count
                };

                nextToken.selected = true;

                parent = nextToken;
                nextToken = nextToken.next[0];
            }

            tokenToRecompute = parent;
        };

        $scope.setAttention = function (val) {
            $scope.attention = val;
            if ($scope.project.toy.attention) {
                $scope.project.toy.attention = val;

                if (val === 'spelling') {
                    $scope.project.toy.tokens = temp_tokens;
                }
                else if (val === 'pos') {
                    $scope.project.toy.tokens = temp_tokens_with_pos;
                }
            }
        };

        $scope.storeSlmConfig = function () {
            projectsService.storeSmallLanguageModelConfig($scope.project, {
                    id : $scope.project.slm.id,
                    contextwindow : $scope.project.slm.contextwindow,
                    temperature : $scope.project.slm.temperature,
                    topp : $scope.project.slm.topp
                })
                .then((updated) => {
                    updated.slm.download = $scope.project.slm.download;
                    updated.slm.ready = true;

                    $scope.$applyAsync(() => {
                        $scope.project = updated;
                    });
                })
                .catch((err) => {
                    loggerService.error('[ml4klangauge] error submitting prompt', err);
                    displayAlert('errors', 500, err);
                });
        }

        async function useSlm(prompt) {
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


        $scope.generateText = function (prompt) {
            $scope.generating = true;
            $scope.generated = '...';

            loggerService.debug('[ml4klanguage] generating text for prompt', prompt);
            if ($scope.project.modeltype === 'small') {
                useSlm(prompt)
                    .then((response) => {
                        $scope.$applyAsync(() => {
                            $scope.generated = response;
                            $scope.generating = false;
                            $scope.textgenerated = true;
                        });
                    })
                    .catch((err) => {
                        loggerService.error('[ml4klangauge] error submitting prompt', err);
                        displayAlert('errors', 500, err);
                    });
            }
            else {
                $timeout(() => {
                    $scope.generated = 'Response to the prompt ' + prompt + ' will go here';
                    $scope.textgenerated = true;
                    $scope.generating = false;
                }, 1000);
            }
        };

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
