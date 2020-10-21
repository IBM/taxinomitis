(function () {

    angular
        .module('app')
        .controller('ModelTextDescribeController', ModelTextDescribeController);

        ModelTextDescribeController.$inject = [
            'authService', 'projectsService', 'trainingService', 'fcnnVisualisationService', 'loggerService', 'utilService',
            '$stateParams', '$scope', '$timeout', '$interval', '$document'
        ];

    function ModelTextDescribeController(authService, projectsService, trainingService, fcnnVisualisationService, loggerService, utilService, $stateParams, $scope, $timeout, $interval, $document) {
        var vm = this;
        vm.authService = authService;


        $scope.loading = true;

        $scope.projectId = $stateParams.projectId;
        $scope.userId = $stateParams.userId;
        $scope.modelId = $stateParams.modelId;

        $scope.modelinfo = undefined;

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

            // create alert and display it
            var newId = alertId++;
            var newAlert = {
                code : errObj.code,
                alertid : newId,
                message : errObj.message || errObj.error || 'Unknown error',
                status : status
            };
            vm[type].push(newAlert);

            return newId;
        }

        function scrollToNewItem(itemId) {
            $timeout(function () {
                var newItem = document.getElementById(itemId);
                $document.duScrollToElementAnimated(angular.element(newItem));
            }, 0);
        }

        utilService.loadScript('https://d3js.org/d3.v5.min.js')
            .then(function () {
                return authService.getProfileDeferred();
            })
            .then(function (profile) {
                vm.profile = profile;

                loggerService.debug('[ml4kdesc] Getting project info');
                return projectsService.getProject($scope.projectId, $scope.userId, profile.tenant);
            })
            .then(function (project) {
                loggerService.debug('[ml4kdesc] project', project);
                $scope.project = project;
                loggerService.debug('[ml4kdesc] getting ML models');
                return trainingService.getModels($scope.projectId, $scope.userId, vm.profile.tenant);
            })
            .then(function (models) {
                loggerService.debug('[ml4kdesc] models', models);
                $scope.loading = false;
                if (models && models.length > 0) {
                    $scope.modelinfo = models[0];
                    initializeVisualisation();
                }
            })
            .catch(function (err) {
                var errId = displayAlert('errors', err.status, err.data);
                scrollToNewItem('errors' + errId);
                $scope.loading = false;
            });


        //-------------------------------------------------------------------------------
        // Adding the model graphic to the page
        //-------------------------------------------------------------------------------

        var INITIAL_ARCHITECTURE = [  9,  7,  9,  5,  7,  1 ];
        var INITIAL_SPACING      = [  20, 20, 20, 20, 20, 20 ];

        function initializeVisualisation() {
            loggerService.debug('[ml4kdesc] initializing visualization');

            $timeout(function () {
                fcnnVisualisationService.init('mlforkidsmodelvizimg');
                fcnnVisualisationService.prepareNN(INITIAL_ARCHITECTURE, INITIAL_SPACING);
                fcnnVisualisationService.redraw();
                fcnnVisualisationService.redistribute();
                fcnnVisualisationService.decorate();
            }, 0);
        }


        //-------------------------------------------------------------------------------
        // Stepping through the wizard
        //-------------------------------------------------------------------------------

        vm.wizardPage = 1;

        vm.searchBoxLinks = [
            // 0 :
            '',
            // 1 :
            'https://duckduckgo.com/?q=neural+networks',
            // 2 :
            'https://duckduckgo.com/?q=deep+learning',
            // 3 :
            'https://duckduckgo.com/?q=input+layer+neural+networks',
            // 4 :
            'https://duckduckgo.com/?q=encoding+text+classification',
            // 5 :
            'https://duckduckgo.com/?q=bag+of+words',
            // 6 :
            'https://duckduckgo.com/?q=word+embedding+neural+network'
        ];

        var runningAnimations = [];

        vm.previousPage = function () {
            if (vm.wizardPage > 1) {
                vm.wizardPage = vm.wizardPage - 1;
            }
            if (vm.wizardPage === 2) {
                restoreDefaultNetwork();
            }
            if (vm.wizardPage === 4) {
                generateCustomModelNetwork();
                displayTrainingExampleInput();
            }
            if (vm.wizardPage === 5) {
                generateLargeInputLayerNetwork();
                displayTrainingExampleInput();
            }
            displayPage();
        };

        vm.nextPage = function () {
            if (vm.wizardPage < 28) {
                vm.wizardPage = vm.wizardPage + 1;
            }
            if (vm.wizardPage === 3) {
                generateCustomModelNetwork();
            }
            if (vm.wizardPage === 5) {
                generateLargeInputLayerNetwork();
                displayTrainingExampleInput();
            }
            if (vm.wizardPage === 6) {
                generateCustomModelNetwork();
                displayTrainingExampleInput();
            }
            displayPage();
        };

        function displayPage() {
            loggerService.debug('[ml4kdesc] displaying wizard page', vm.wizardPage);

            cancelRunningAnimations();

            switch (vm.wizardPage) {
                case 1:
                    // nothing to do
                    break;
                case 2:
                    highlightNetworkLayersInSequence();
                    break;
                case 3:
                    displayTrainingExampleInput();
                    break;
                case 4:
                    populateInputLayerWithRandomNumbers();
                    break;
                case 5:
                    displayBagOfWordsInputLayerAnnotations();
                    break;
                case 6:
                    populateInputLayerWithWord2Vec();
                    break;
                case 7:
                    populateInputLayerWithRandomNumbers();
                    break;
            }
        }

        //-------------------------------------------------------------------------------
        // Update the model graphic
        //-------------------------------------------------------------------------------

        function restoreDefaultNetwork() {
            loggerService.debug('[ml4kdesc] restoring the default initial network diagram');

            fcnnVisualisationService.prepareNN(INITIAL_ARCHITECTURE, INITIAL_SPACING);
            fcnnVisualisationService.redraw();
            fcnnVisualisationService.redistribute();
            fcnnVisualisationService.decorate();
        }

        function cancelRunningAnimations() {
            loggerService.debug('[ml4kdesc] stopping previous animations');

            for (var i = 0; i < runningAnimations.length; i++) {
                $interval.cancel(runningAnimations[i]);
            }
            runningAnimations = [];
            fcnnVisualisationService.remove_focus();
        }

        function highlightNetworkLayersInSequence() {
            loggerService.debug('[ml4kdesc] animating network layers');

            var highlightedLayer = 0;

            fcnnVisualisationService.toggleLayerHighlight(highlightedLayer);
            runningAnimations.push($interval(function () {
                fcnnVisualisationService.toggleLayerHighlight(highlightedLayer);
                highlightedLayer += 1;
                fcnnVisualisationService.toggleLayerHighlight(highlightedLayer);
            }, 400, 100));
        }

        var CUSTOM_INPUT_LAYER_SIZE = 7;

        function generateCustomModelNetwork() {
            loggerService.debug('[ml4kdesc] generating network diagram based on ML project');

            // number of nodes in each layer
            var architecture = [ 1, CUSTOM_INPUT_LAYER_SIZE, 5, 8, $scope.project.labels.length ];
            // pixels between the nodes in each layer
            var betweenNodesInLayer = [ 0, 20, 20, 20, 100 ];

            fcnnVisualisationService.prepareNN(architecture, betweenNodesInLayer);
            fcnnVisualisationService.redraw();
            fcnnVisualisationService.redistribute();
            fcnnVisualisationService.decorate();
        }

        var BAG_OF_WORDS_INPUT_LAYER_SIZE = 10;

        function generateLargeInputLayerNetwork() {
            loggerService.debug('[ml4kdesc] restoring the network diagram with larger input layer');

            // number of nodes in each layer
            var architecture = [ 1, BAG_OF_WORDS_INPUT_LAYER_SIZE, 5, 8, $scope.project.labels.length ];
            // pixels between the nodes in each layer
            var betweenNodesInLayer = [ 0, 20, 20, 20, 100 ];

            fcnnVisualisationService.prepareNN(architecture, betweenNodesInLayer);
            fcnnVisualisationService.redraw();
            fcnnVisualisationService.redistribute();
            fcnnVisualisationService.decorate();
        }



        function displayTrainingExampleInput() {
            loggerService.debug('[ml4kdesc] displaying training example in diagram');

            fcnnVisualisationService.updateInputText('SOME GENERIC PLACEHOLDER HEADLINE WILL GO HERE');
        }

        function populateInputLayerWithRandomNumbers() {
            loggerService.debug('[ml4kdesc] populating input layer (random)');

            var nodeIdx = 0;
            var values = {};
            runningAnimations.push($interval(function () {
                values['1_' + nodeIdx] = { value : getRandomInt(0, 12) };
                fcnnVisualisationService.updateLabels(values);

                nodeIdx += 1;
            }, 400, CUSTOM_INPUT_LAYER_SIZE));
        }

        function populateInputLayerWithWord2Vec() {
            loggerService.debug('[ml4kdesc] populating input layer (word2vec)');

            var nodeIdx = 0;
            var values = {};
            runningAnimations.push($interval(function () {
                var nodeid = '1_' + nodeIdx;
                values[nodeid] = { value : getRandomInt(1, 20) };
                fcnnVisualisationService.updateLabels(values);
                fcnnVisualisationService.showAnnotation(nodeid, 'PLACEHOLDER');

                nodeIdx += 1;
            }, 400, CUSTOM_INPUT_LAYER_SIZE));
        }

        function displayBagOfWordsInputLayerAnnotations() {
            loggerService.debug('[ml4kdesc] populating input layer (bag of words)');

            var nodeIdx = 0;
            var values = {};
            runningAnimations.push($interval(function () {
                var nodeid = '1_' + nodeIdx;
                values[nodeid] = { value : placeholderBagOfWords[nodeid].count };
                fcnnVisualisationService.updateLabels(values);
                fcnnVisualisationService.showAnnotation(nodeid, 'number of times that the word "' + placeholderBagOfWords[nodeid].word + '" appears');

                nodeIdx += 1;
            }, 400, BAG_OF_WORDS_INPUT_LAYER_SIZE));
        }

        var placeholderBagOfWords = {
            '1_0' : {
                word : 'HEADLINE',
                count : 1
            },
            '1_1' : {
                word : 'FURY',
                count : 0
            },
            '1_2' : {
                word : 'LONDON',
                count : 0
            },
            '1_3' : {
                word : 'GO',
                count : 1
            },
            '1_4' : {
                word : 'WILL',
                count : 1
            },
            '1_5' : {
                word : 'OPEN',
                count : 0
            },
            '1_6' : {
                word : 'PLACEHOLDER',
                count : 1
            },
            '1_7' : {
                word : 'TESTING',
                count : 0
            },
            '1_8' : {
                word : 'VALUES',
                count : 0
            },
            '1_9' : {
                word : 'QUEEN',
                count : 1
            }
        };




        //-------------------------------------------------------------------------------
        // Moving the model graphic around
        //-------------------------------------------------------------------------------

        var operation;

        vm.stop = function() {
            if (operation) {
                $interval.cancel(operation);
                clearInterval(operation);
                operation = undefined;
            }
        };

        var REPEAT_INTERVAL = 50;
        var SCROLL_PIXELS = 20;
        var scale = 100;


        vm.grow = function() {
            vm.stop();
            var image = document.getElementById("mlforkidsmodelvizimg");
            operation = $interval(function () {
                scale += 10;
                image.style["width"] = scale + "%";
            }, REPEAT_INTERVAL);
        };

        vm.shrink = function() {
            vm.stop();
            var image = document.getElementById("mlforkidsmodelvizimg");
            operation = $interval(function () {
                if (scale > 100) {
                    scale -= 10;
                    image.style["width"] = scale + "%";
                }
            }, REPEAT_INTERVAL);
        };

        vm.goleft = function() {
            vm.stop();
            var container = document.getElementById("mlforkidsmodelvizimghost");
            operation = $interval(function () {
                container.scrollLeft += SCROLL_PIXELS;
            }, REPEAT_INTERVAL);
        };
        vm.goright = function() {
            vm.stop();
            var container = document.getElementById("mlforkidsmodelvizimghost");
            operation = $interval(function () {
                container.scrollLeft -= SCROLL_PIXELS;
            }, REPEAT_INTERVAL);
        };
        vm.goup = function() {
            vm.stop();
            var container = document.getElementById("mlforkidsmodelvizimghost");
            operation = $interval(function () {
                container.scrollTop -= SCROLL_PIXELS;
            }, REPEAT_INTERVAL);
        };
        vm.godown = function() {
            vm.stop();
            var container = document.getElementById("mlforkidsmodelvizimghost");
            operation = $interval(function () {
                container.scrollTop += SCROLL_PIXELS;
            }, REPEAT_INTERVAL);
        };



        //-------------------------------------------------------------------------------

        function getRandomInt(min, max) {
            min = Math.ceil(min);
            max = Math.floor(max);
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
    }
}());
