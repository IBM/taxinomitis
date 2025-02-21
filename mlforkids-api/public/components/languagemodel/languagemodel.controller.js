(function () {

    angular
        .module('app')
        .controller('LanguageModelController', LanguageModelController);

    LanguageModelController.$inject = [
        'authService',
        'loggerService',
        '$mdDialog',
        '$stateParams',
        '$scope', '$timeout'
    ];

    function LanguageModelController(authService, loggerService, $mdDialog, $stateParams, $scope, $timeout) {
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

        $scope.loadingtraining = true;
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

        $scope.corpus = [
            {
                id    : 0,
                label : 'my volcano project',
                type  : 'text'
            },
            {
                id    : 1,
                label : 'vesuvius.txt',
                type  : 'text'
            },
            {
                id    : 2,
                label : 'Mount Etna',
                type  : 'wikipedia'
            },
            {
                id    : 3,
                label : 'krakatoa.txt',
                type  : 'text'
            }
        ];
        let nextCorpusId = 4;

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


        // check that they're authenticated before doing anything else
        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                $scope.project = {
                    id : $scope.projectId
                };
            })
            .catch(function (err) {
                loggerService.error('[ml4ktraining] error', err);
                displayAlert('errors', err.status, err.data ? err.data : err);
            });

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
                    console.log(resp);
                    $scope.corpus.push({
                        id : nextCorpusId++,
                        label : resp.title,
                        type : 'text'
                    });
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };
        $scope.addCorpusFile = function (ev) {
            if (ev.currentTarget && ev.currentTarget.files) {
                for (let idx = 0; idx < ev.currentTarget.files.length; idx++) {
                    const newFile = {
                        id : nextCorpusId++,
                        label : ev.currentTarget.files[idx].name,
                        type : 'text'
                    };
                    $scope.$applyAsync(() => { $scope.corpus.push(newFile) });
                }
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
            // console.log(JSON.stringify($scope.project.toy.tokens, null, 4));
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

        $scope.downloadModel = function () {
            $scope.project.slm.download = 0;
            console.log('simulating download');
            $timeout(() => { $scope.project.slm.download = 33; }, 300);
            $timeout(() => { $scope.project.slm.download = 50; }, 800);
            $timeout(() => { $scope.project.slm.download = 66; }, 1200);
            $timeout(() => { $scope.project.slm.download = 90; }, 1800);
            $timeout(() => { $scope.project.slm.download = 100; }, 2100);
        };

        $scope.generateText = function (prompt) {
            $scope.generating = true;
            $scope.generated = '...';
            $timeout(() => {
                $scope.generated = 'Response to the prompt ' + prompt + ' will go here';
                $scope.textgenerated = true;
                $scope.generating = false;
            }, 1000);
        };


        $scope.getController = function () {
            return vm;
        };
    }
}());
