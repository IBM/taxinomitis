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
        $scope.currentExample = undefined;

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
                if (models && models.length > 0 && models[0].status === 'Available') {
                    return trainingService.getModel($scope.project.id, $scope.userId, vm.profile.tenant, $scope.modelId, models[0].updated);
                }
                else {
                    var errId = displayAlert('errors', 400, { message : 'Model not ready to be described' });
                    scrollToNewItem('errors' + errId);
                    $scope.loading = false;
                }
            })
            .then(function (modelinfo) {
                loggerService.debug('[ml4kdesc] model info', modelinfo);

                $scope.loading = false;
                $scope.modelinfo = modelinfo;
                initializeVisualisation();
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

        var WEIGHTS = {};
        var BIAS = {};
        var VALUES = {};

        function initializeVisualisation() {
            loggerService.debug('[ml4kdesc] initializing visualization');

            initializeModelValues();

            $timeout(function () {
                fcnnVisualisationService.init('mlforkidsmodelvizimg');
                fcnnVisualisationService.prepareNN(INITIAL_ARCHITECTURE, INITIAL_SPACING);
                fcnnVisualisationService.redraw();
                fcnnVisualisationService.redistribute();
                fcnnVisualisationService.decorate();
            }, 0);
        }

        function initializeModelValues() {
            loggerService.debug('[ml4kdesc] initializing weights and bias values');

            for (var startLayer = 1; startLayer < 8; startLayer++) {
                var endLayer = startLayer + 1;

                for (var startNode = 0; startNode < 10; startNode++) {
                    var startNodeId = startLayer + '_' + startNode;

                    BIAS[startNodeId] = (5 - (startNode % 5));
                    VALUES[startNodeId] = 0;
                    WEIGHTS[startNodeId] = {};

                    for (var endNode = 0; endNode < 10; endNode++) {
                        var endNodeId = endLayer + '_' + endNode;

                        WEIGHTS[startNodeId][endNodeId] = getRandomInt(1, 5);
                    }
                }
            }
        }


        //-------------------------------------------------------------------------------
        // Stepping through the wizard
        //-------------------------------------------------------------------------------

        var FIRST_PAGE = 1;
        var LAST_PAGE = 29;

        vm.wizardPage = FIRST_PAGE;

        vm.wizardBusy = false;

        function wizardStepComplete() {
            vm.wizardBusy = false;
        }

        vm.searchBoxLinks = [
            // 0 :
            '',
            // 1 :
            'https://duckduckgo.com/?q=neural+networks',
            // 2 :
            'https://duckduckgo.com/?q=deep+learning',
            // 3 :
            'https://duckduckgo.com/?q=input+layer+neural+network',
            // 4 :
            'https://duckduckgo.com/?q=encoding+text+classification',
            // 5 :
            'https://duckduckgo.com/?q=bag+of+words',
            // 6 :
            'https://duckduckgo.com/?q=word+embedding+neural+network',
            // 7 :
            'https://duckduckgo.com/?q=feature+selection+machine+learning',
            // 8 :
            'https://duckduckgo.com/?q=hidden+layer+neural+network',
            // 9 :
            'https://duckduckgo.com/?q=activation+function+neural+network',
            // 10 :
            'https://duckduckgo.com/?q=weight+bias+neural+network',
            // 11 :
            'https://duckduckgo.com/?q=weight+bias+neural+network',
            // 12 :
            'https://duckduckgo.com/?q=hidden+layer+neural+network',
            // 13 :
            'https://duckduckgo.com/?q=hidden+layer+neural+network',
            // 14 :
            'https://duckduckgo.com/?q=activation+function+neural+network',
            // 15 :
            'https://duckduckgo.com/?q=hidden+layer+neural+network',
            // 16 :
            'https://duckduckgo.com/?q=output+layer+neural+network',
            // 17 :
            'https://duckduckgo.com/?q=loss+function+neural+networks+artificial+intelligence',
            // 18 :
            'https://duckduckgo.com/?q=back+propagation+neural+network',
            // 19 :
            'https://duckduckgo.com/?q=neural+networks',
            // 20:
            'https://duckduckgo.com/?q=encoding+text+classification',
            // 21 :
            'https://duckduckgo.com/?q=hidden+layer+neural+network',
            // 22 :
            'https://duckduckgo.com/?q=activation+function+neural+network',
            // 23 :
            'https://duckduckgo.com/?q=activation+function+neural+network',
            // 24 :
            'https://duckduckgo.com/?q=hidden+layer+neural+network',
            // 25 :
            'https://duckduckgo.com/?q=output+layer+neural+network',
            // 26 :
            'https://duckduckgo.com/?q=loss+function+neural+networks+artificial+intelligence',
            // 27 :
            'https://duckduckgo.com/?q=back+propagation+neural+network',
            // 28 :
            'https://duckduckgo.com/?q=epochs+neural+network',
            // 29 :
            'https://duckduckgo.com/?q=neural+networks'
        ];

        var runningAnimations = [];

        vm.previousPage = function () {
            loggerService.debug('[ml4kdesc] previousPage');
            vm.wizardBusy = true;

            if (vm.wizardPage > FIRST_PAGE) {
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
            loggerService.debug('[ml4kdesc] nextPage');
            vm.wizardBusy = true;

            if (vm.wizardPage < LAST_PAGE) {
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
            if (vm.wizardPage === 13) {
                fcnnVisualisationService.hideAnnotation('2_0');
            }
            if (vm.wizardPage === 14) {
                fcnnVisualisationService.hideAnnotation('2_1');
            }
            if (vm.wizardPage === 15) {
                fcnnVisualisationService.hideAnnotation('2_2');
            }
            if (vm.wizardPage === 22) {
                fcnnVisualisationService.hideAnnotation('2_0');
            }
            if (vm.wizardPage === 23) {
                fcnnVisualisationService.hideAnnotation('2_1');
            }
            if (vm.wizardPage === 24) {
                fcnnVisualisationService.hideAnnotation('2_2');
            }

            displayPage();
        };

        function displayPage() {
            loggerService.debug('[ml4kdesc] displaying wizard page', vm.wizardPage);

            cancelRunningAnimations();

            switch (vm.wizardPage) {
                case 1:
                    wizardStepComplete();
                    break;
                case 2:
                    highlightNetworkLayersInSequence();
                    wizardStepComplete();
                    break;
                case 3:
                    $scope.currentExample = $scope.modelinfo.examples[0];
                    displayTrainingExampleInput(wizardStepComplete);
                    break;
                case 4:
                    populateInputLayerWithRandomNumbers(wizardStepComplete);
                    break;
                case 5:
                    displayBagOfWordsInputLayerAnnotations(wizardStepComplete);
                    break;
                case 6:
                    populateInputLayerWithWord2Vec(wizardStepComplete);
                    break;
                case 7:
                    populateInputLayerWithRandomNumbers(wizardStepComplete);
                    break;
                case 8:
                    populateHiddenLayerWithPlaceholders(wizardStepComplete);
                    break;
                case 9:
                    displayHiddenLayerWorking();
                    wizardStepComplete();
                    break;
                case 10:
                    displayWeightsInHiddenLayer();
                    wizardStepComplete();
                    break;
                case 11:
                    displayWeightsAndBiasInHiddenLayer();
                    wizardStepComplete();
                    break;
                case 12:
                    displayWeightsAndBiasAndValueInHiddenLayer();
                    wizardStepComplete();
                    break;
                case 13:
                    displayWeightsAndBiasAndValueInNextHiddenLayer();
                    wizardStepComplete();
                    break;
                case 14:
                    displayWeightsAndBiasAndValueInThirdHiddenLayer();
                    wizardStepComplete();
                    break;
                case 15:
                    displayAllHiddenLayerValues(wizardStepComplete);
                    break;
                case 16:
                    displayOutputValues(wizardStepComplete);
                    break;
                case 17:
                    displayOutputErrorRate(wizardStepComplete);
                    break;
                case 18:
                    displayBackPropagation(wizardStepComplete);
                    break;
                case 19:
                    hideOutputValues();
                    $scope.currentExample = $scope.modelinfo.examples[1];
                    displayTrainingExampleInput(wizardStepComplete);
                    break;
                case 20:
                    populateInputLayerWithRandomNumbers(wizardStepComplete);
                    break;
                case 21:
                    displayWeightsAndBiasAndValueInHiddenLayer();
                    wizardStepComplete();
                    break;
                case 22:
                    displayWeightsAndBiasAndValueInNextHiddenLayer();
                    wizardStepComplete();
                    break;
                case 23:
                    displayWeightsAndBiasAndValueInThirdHiddenLayer();
                    wizardStepComplete();
                    break;
                case 24:
                    displayAllHiddenLayerValues(wizardStepComplete);
                    break;
                case 25:
                    displayOutputValues(wizardStepComplete);
                    break;
                case 26:
                    displayOutputErrorRate(wizardStepComplete);
                    break;
                case 27:
                    displayBackPropagation(wizardStepComplete);
                    break;
                case 28:
                    animateEpoch(wizardStepComplete);
                    break;
                case 29:
                    restoreDefaultNetwork();
                    break;
            }
        }

        //-------------------------------------------------------------------------------
        // Update the model graphic
        //-------------------------------------------------------------------------------

        var VERY_SLOW = 600;
        var SLOW = 400;
        var FAST = 200;
        var VERY_FAST = 150;

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
            }, SLOW, 100));
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



        function displayTrainingExampleInput(onComplete) {
            loggerService.debug('[ml4kdesc] displaying training example in diagram');

            fcnnVisualisationService.updateInputText($scope.currentExample.text);
            fcnnVisualisationService.highlightInputText();

            if (onComplete) {
                onComplete();
            }
        }

        function populateInputLayerWithRandomNumbers(onComplete) {
            loggerService.debug('[ml4kdesc] populating input layer (random)');

            fcnnVisualisationService.clearInputLabels();

            var nodeIdx = 0;
            var values = {};
            runningAnimations.push($interval(function () {
                var example = $scope.currentExample.random[nodeIdx];

                var nodeid = '1_' + nodeIdx;
                values[nodeid] = { value : example.value };
                fcnnVisualisationService.updateLabels(values);

                nodeIdx += 1;

                if (onComplete && nodeIdx ===  CUSTOM_INPUT_LAYER_SIZE) {
                    onComplete();
                }
            }, FAST, CUSTOM_INPUT_LAYER_SIZE));
        }

        function populateInputLayerWithWord2Vec(onComplete) {
            loggerService.debug('[ml4kdesc] populating input layer (word2vec)');

            fcnnVisualisationService.clearInputLabels();

            var nodeIdx = 0;
            var values = {};
            runningAnimations.push($interval(function () {
                var example = $scope.currentExample.embeddings[nodeIdx];

                var nodeid = '1_' + nodeIdx;
                values[nodeid] = { value : example.value };
                fcnnVisualisationService.updateLabels(values);
                fcnnVisualisationService.showAnnotation(nodeid, example.annotation);

                nodeIdx += 1;

                if (onComplete && nodeIdx ===  CUSTOM_INPUT_LAYER_SIZE) {
                    onComplete();
                }
            }, FAST, CUSTOM_INPUT_LAYER_SIZE));
        }

        function displayBagOfWordsInputLayerAnnotations(onComplete) {
            loggerService.debug('[ml4kdesc] populating input layer (bag of words)');

            var nodeIdx = 0;
            var values = {};
            runningAnimations.push($interval(function () {
                var example = $scope.currentExample.bagofwords[nodeIdx];

                var nodeid = '1_' + nodeIdx;
                values[nodeid] = { value : example.value };
                fcnnVisualisationService.updateLabels(values);
                fcnnVisualisationService.showAnnotation(nodeid, 'number of times that the word "' + example.annotation + '" appears');

                nodeIdx += 1;

                if (onComplete && nodeIdx ===  BAG_OF_WORDS_INPUT_LAYER_SIZE) {
                    onComplete();
                }
            }, SLOW, BAG_OF_WORDS_INPUT_LAYER_SIZE));
        }


        function calculateHiddenLayerValue(layerId, nodeIdx) {
            var value = 0;

            var endLayerId = layerId;
            var endNodeId = layerId + '_' + nodeIdx;

            var startLayerId = endLayerId - 1;
            for (var startNodeIdx = 0; startNodeIdx < CUSTOM_INPUT_LAYER_SIZE; startNodeIdx++) {
                var startNodeId = startLayerId + '_' + startNodeIdx;

                value += ($scope.currentExample.random[startNodeIdx].value * WEIGHTS[startNodeId][endNodeId]);
            }

            value += BIAS[endNodeId];

            VALUES[endNodeId] = value;

            return value;
        }

        function populateHiddenLayerWithPlaceholders(onComplete) {
            loggerService.debug('[ml4kdesc] populating hidden layer with placeholders');

            var nodeIdx = 0;
            var values = {};
            runningAnimations.push($interval(function () {
                var nodeid = '2_' + nodeIdx;
                values[nodeid] = { value : '?' };
                fcnnVisualisationService.updateLabels(values);

                nodeIdx += 1;

                if (onComplete && nodeIdx ===  5) {
                    onComplete();
                }
            }, FAST, 5));
        }

        function displayHiddenLayerWorking() {
            fcnnVisualisationService.highlightHiddenLayerNode(2, 0);

            var working = "<table>";
            for (var i = 0; i < (CUSTOM_INPUT_LAYER_SIZE - 1); i++) {
                working += ("<tr><td>" + $scope.currentExample.random[i].value + "</td><td></td><td>+</td></tr>");
            }
            working += ("<tr><td>" + $scope.currentExample.random[CUSTOM_INPUT_LAYER_SIZE - 1].value + "</td><td></td><td></td></tr>");
            working += "</table>";

            fcnnVisualisationService.showAnnotation('2_0', working);

            // fcnnVisualisationService.showAnnotation('2_0', "<table>" +
            // "<tr><td>  3</td><td>x</td><td>100</td><td></td><td>+</td></tr>" +
            // "<tr><td> 10</td><td>x</td><td> 10</td><td></td><td>+</td></tr>" +
            // "<tr><td> 17</td><td>x</td><td>  1</td><td></td><td>+</td></tr>" +
            // "<tr><td>999</td><td>x</td><td> 12</td><td></td><td>+</td></tr>" +
            // "<tr><td> 10</td><td>x</td><td> 67</td><td></td><td>+</td></tr>" +
            // "<tr><td>  3</td><td>x</td><td>200</td><td></td><td>+</td></tr>" +
            // "<tr><td> 17</td><td>x</td><td> 97</td><td></td><td>+</td></tr>" +
            // "<tr><td> 90</td><td>x</td><td> 45</td><td></td><td>+</td></tr>" +
            // "<tr><td> 42</td><td>x</td><td> 26</td><td></td><td>+</td></tr>" +
            // "<tr><td colspan='5'> </td></tr>" +
            // "<tr><td colspan='5'> = 2467</td></tr>" +
            // "</table>");
        }



        function populateHiddenLayer() {
            loggerService.debug('[ml4kdesc] populating hidden layer');

            var nodeIdx = 0;
            var values = {};
            runningAnimations.push($interval(function () {
                var nodeid = '2_' + nodeIdx;
                values[nodeid] = { value : calculateHiddenLayerValue(2, nodeIdx) };
                fcnnVisualisationService.updateLabels(values);

                nodeIdx += 1;
            }, 400, 5));
        }

        function displayWeightsInHiddenLayer() {
            fcnnVisualisationService.highlightHiddenLayerNode(2, 0);

            var inputLayer = 1;
            var numInputNodes = CUSTOM_INPUT_LAYER_SIZE;

            var targetId = '2_0';

            var weightsToDisplay = [];
            for (var inputNodeId = 0; inputNodeId < numInputNodes; inputNodeId++) {
                weightsToDisplay.push('w = ' + WEIGHTS[inputLayer + '_' + inputNodeId][targetId]);
            }

            fcnnVisualisationService.displayWeights(2, 0, weightsToDisplay);

            var working = "<table>";
            for (var i = 0; i < (CUSTOM_INPUT_LAYER_SIZE - 1); i++) {
                working += ("<tr><td>" + $scope.currentExample.random[i].value + "</td><td>x</td><td>" + WEIGHTS[inputLayer + '_' + i][targetId] + "</td><td></td><td>+</td></tr>");
            }
            working += ("<tr><td>" + $scope.currentExample.random[CUSTOM_INPUT_LAYER_SIZE - 1].value + "</td><td>x</td><td>" + WEIGHTS[inputLayer + '_' + (CUSTOM_INPUT_LAYER_SIZE - 1)][targetId] + "</td><td></td><td></td></tr>");
            working += "</table>";

            fcnnVisualisationService.showAnnotation('2_0', working);
        }

        function displayWeightsAndBiasInHiddenLayer() {
            fcnnVisualisationService.highlightHiddenLayerNode(2, 0);

            var inputLayer = 1;
            var numInputNodes = CUSTOM_INPUT_LAYER_SIZE;

            var targetId = '2_0';

            var weightsToDisplay = [];
            for (var inputNodeId = 0; inputNodeId < numInputNodes; inputNodeId++) {
                weightsToDisplay.push('w = ' + WEIGHTS[inputLayer + '_' + inputNodeId][targetId]);
            }
            fcnnVisualisationService.displayWeights(2, 0, weightsToDisplay);

            var values = {};
            values[targetId] = { bias : BIAS[targetId] };
            fcnnVisualisationService.updateLabels(values);

            var working = "<table>";
            working += ("<tr><td>" + BIAS[targetId] + "</td><td></td><td></td><td></td><td>+</td></tr>");
            working += ("<tr><td colspan=5 style='font-size: 0.2em;'> &nbsp; </td></tr>");
            for (var i = 0; i < (CUSTOM_INPUT_LAYER_SIZE - 1); i++) {
                working += ("<tr><td>" + $scope.currentExample.random[i].value + "</td><td>x</td><td>" + WEIGHTS[inputLayer + '_' + i][targetId] + "</td><td></td><td>+</td></tr>");
            }
            working += ("<tr><td>" + $scope.currentExample.random[CUSTOM_INPUT_LAYER_SIZE - 1].value + "</td><td>x</td><td>" + WEIGHTS[inputLayer + '_' + (CUSTOM_INPUT_LAYER_SIZE - 1)][targetId] + "</td><td></td><td></td></tr>");
            working += "</table>";

            fcnnVisualisationService.showAnnotation('2_0', working);
        }

        function displayWeightsAndBiasAndValueInHiddenLayer() {
            fcnnVisualisationService.highlightHiddenLayerNode(2, 0);

            var inputLayer = 1;
            var numInputNodes = CUSTOM_INPUT_LAYER_SIZE;

            var targetId = '2_0';

            var weightsToDisplay = [];
            for (var inputNodeId = 0; inputNodeId < numInputNodes; inputNodeId++) {
                weightsToDisplay.push('w = ' + WEIGHTS[inputLayer + '_' + inputNodeId][targetId]);
            }
            fcnnVisualisationService.displayWeights(2, 0, weightsToDisplay);


            var values = {};
            values[targetId] = { bias : BIAS[targetId], value : calculateHiddenLayerValue(2, 0) };
            fcnnVisualisationService.updateLabels(values);

            var working = "<table>";
            working += ("<tr><td>" + BIAS[targetId] + "</td><td></td><td></td><td></td><td>+</td></tr>");
            working += ("<tr><td colspan=5 style='font-size: 0.2em;'> &nbsp; </td></tr>");
            for (var i = 0; i < (CUSTOM_INPUT_LAYER_SIZE - 1); i++) {
                working += ("<tr><td>" + $scope.currentExample.random[i].value + "</td><td>x</td><td>" + WEIGHTS[inputLayer + '_' + i][targetId] + "</td><td></td><td>+</td></tr>");
            }
            working += ("<tr><td>" + $scope.currentExample.random[CUSTOM_INPUT_LAYER_SIZE - 1].value + "</td><td>x</td><td>" + WEIGHTS[inputLayer + '_' + (CUSTOM_INPUT_LAYER_SIZE - 1)][targetId] + "</td><td></td><td></td></tr>");
            working += ("<tr><td colspan=5 style='font-size: 0.25em;'> &nbsp; </td></tr>");
            working += ("<tr><td colspan=5> = " + values[targetId].value + "</td></tr>");
            working += "</table>";

            fcnnVisualisationService.showAnnotation('2_0', working);
        }

        function displayWeightsAndBiasAndValueInNextHiddenLayer() {
            fcnnVisualisationService.highlightHiddenLayerNode(2, 1);

            var inputLayer = 1;
            var numInputNodes = CUSTOM_INPUT_LAYER_SIZE;

            var targetId = '2_1';

            var weightsToDisplay = [];
            for (var inputNodeId = 0; inputNodeId < numInputNodes; inputNodeId++) {
                weightsToDisplay.push('w = ' + WEIGHTS[inputLayer + '_' + inputNodeId][targetId]);
            }
            fcnnVisualisationService.displayWeights(2, 1, weightsToDisplay);


            var values = {};
            values[targetId] = { bias : BIAS[targetId], value : calculateHiddenLayerValue(2, 1) };
            fcnnVisualisationService.updateLabels(values);

            var working = "<table>";
            working += ("<tr><td>" + BIAS[targetId] + "</td><td></td><td></td><td></td><td>+</td></tr>");
            working += ("<tr><td colspan=5 style='font-size: 0.2em;'> &nbsp; </td></tr>");
            for (var i = 0; i < (CUSTOM_INPUT_LAYER_SIZE - 1); i++) {
                working += ("<tr><td>" + $scope.currentExample.random[i].value + "</td><td>x</td><td>" + WEIGHTS[inputLayer + '_' + i][targetId] + "</td><td></td><td>+</td></tr>");
            }
            working += ("<tr><td>" + $scope.currentExample.random[CUSTOM_INPUT_LAYER_SIZE - 1].value + "</td><td>x</td><td>" + WEIGHTS[inputLayer + '_' + (CUSTOM_INPUT_LAYER_SIZE - 1)][targetId] + "</td><td></td><td></td></tr>");
            working += ("<tr><td colspan=5 style='font-size: 0.25em;'> &nbsp; </td></tr>");
            working += ("<tr><td colspan=5> = " + values[targetId].value + "</td></tr>");
            working += "</table>";

            fcnnVisualisationService.showAnnotation('2_1', working);
        }

        function displayWeightsAndBiasAndValueInThirdHiddenLayer() {
            fcnnVisualisationService.highlightHiddenLayerNode(2, 2);

            var inputLayer = 1;
            var numInputNodes = CUSTOM_INPUT_LAYER_SIZE;

            var targetId = '2_2';

            var weightsToDisplay = [];
            for (var inputNodeId = 0; inputNodeId < numInputNodes; inputNodeId++) {
                weightsToDisplay.push('w = ' + WEIGHTS[inputLayer + '_' + inputNodeId][targetId]);
            }
            fcnnVisualisationService.displayWeights(2, 2, weightsToDisplay);


            var values = {};
            values[targetId] = { bias : BIAS[targetId], value : calculateHiddenLayerValue(2, 2) };
            fcnnVisualisationService.updateLabels(values);

            var working = "<table>";
            working += ("<tr><td>" + BIAS[targetId] + "</td><td></td><td></td><td></td><td>+</td></tr>");
            working += ("<tr><td colspan=5 style='font-size: 0.2em;'> &nbsp; </td></tr>");
            for (var i = 0; i < (CUSTOM_INPUT_LAYER_SIZE - 1); i++) {
                working += ("<tr><td>" + $scope.currentExample.random[i].value + "</td><td>x</td><td>" + WEIGHTS[inputLayer + '_' + i][targetId] + "</td><td></td><td>+</td></tr>");
            }
            working += ("<tr><td>" + $scope.currentExample.random[CUSTOM_INPUT_LAYER_SIZE - 1].value + "</td><td>x</td><td>" + WEIGHTS[inputLayer + '_' + (CUSTOM_INPUT_LAYER_SIZE - 1)][targetId] + "</td><td></td><td></td></tr>");
            working += ("<tr><td colspan=5 style='font-size: 0.25em;'> &nbsp; </td></tr>");
            working += ("<tr><td colspan=5> = " + values[targetId].value + "</td></tr>");
            working += "</table>";

            fcnnVisualisationService.showAnnotation('2_2', working);
        }

        function displayAllHiddenLayerValues(onComplete) {
            var values = {};

            var remainingNodes = [
                [ 2, 3 ],
                [ 2, 4 ],
                [ 3, 0 ],
                [ 3, 1 ],
                [ 3, 2 ],
                [ 3, 3 ],
                [ 3, 4 ],
                [ 3, 5 ],
                [ 3, 6 ],
                [ 3, 7 ]
            ];

            for (var i = 0; i < remainingNodes.length; i++) {
                var remainingNode = remainingNodes[i];
                var remainingNodeId = remainingNode[0] + '_' + remainingNode[1];
                values[remainingNodeId] = { bias : BIAS[remainingNodeId] };
            }
            fcnnVisualisationService.updateLabels(values);

            var nodeIdx = -1;
            runningAnimations.push($interval(function () {
                if (nodeIdx >= 0) {
                    var remainingNode = remainingNodes[nodeIdx];
                    var nodeid = remainingNode[0] + '_' + remainingNode[1];
                    values[nodeid].value = calculateHiddenLayerValue(remainingNode[0], remainingNode[1]);
                    fcnnVisualisationService.updateLabels(values);
                }

                nodeIdx += 1;

                if (onComplete && nodeIdx === remainingNodes.length) {
                    onComplete();
                }
            }, VERY_SLOW, remainingNodes.length + 1));
        }

        function hideOutputValues() {
            fcnnVisualisationService.updateOutputHtml();
        }

        function displayOutputValues(onComplete) {
            var values = {};
            for (var i = 0; i < $scope.project.labels.length; i++) {
                var label = $scope.project.labels[i];
                var nodeid = '4_' + i;
                values[nodeid] = { value : $scope.currentExample.output[label] };
            }
            fcnnVisualisationService.updateLabels(values);

            $timeout(function () {
                var output = "<table>" +
                    "<tr><th>label</th><th>output</th></tr>";
                for (var i = 0; i < $scope.project.labels.length; i++) {
                    var label = $scope.project.labels[i];
                    output += ("<tr><td>" + label + "</td><td>"  + $scope.currentExample.output[label] + "</td></tr>");
                }
                output += "</table>";

                fcnnVisualisationService.updateOutputHtml(output);

                onComplete();
            }, VERY_SLOW);
        }

        function displayOutputErrorRate(onComplete) {
            var output = "<table>" +
                "<tr><th>label</th><th>output</th><th>training</th></tr>";
            for (var i = 0; i < $scope.project.labels.length; i++) {
                var label = $scope.project.labels[i];
                var trainingvalue = (label === $scope.currentExample.label) ? 1 : 0;
                output += ("<tr><td>" + label + "</td><td>"  + $scope.currentExample.output[label] + "</td><td>" + trainingvalue + "</td></tr>");
            }
            output += "</table>";

            fcnnVisualisationService.updateOutputHtml(output);


            $timeout(function () {
                var output = "<table>" +
                    "<tr><th>label</th><th>output</th><th>training</th><th>error</th></tr>";
                for (var i = 0; i < $scope.project.labels.length; i++) {
                    var label = $scope.project.labels[i];
                    var trainingvalue = (label === $scope.currentExample.label) ? 1 : 0;
                    var errorrate = trainingvalue - $scope.currentExample.output[label];
                    if (errorrate > 0) {
                        errorrate = "+" + errorrate;
                    }
                    output += ("<tr><td>" + label + "</td><td>"  + $scope.currentExample.output[label] + "</td><td>" + trainingvalue + "</td><td>" + errorrate + "</td></tr>");
                }
                output += "</table>";

                fcnnVisualisationService.updateOutputHtml(output);

                onComplete();
            }, 800);
        }


        function displayBackPropagation(onComplete) {
            fcnnVisualisationService.removeValues();

            var output = "<table>" +
                "<tr><th>label</th><th>output</th><th>training</th><th>error</th></tr>";
            for (var i = 0; i < $scope.project.labels.length; i++) {
                var label = $scope.project.labels[i];
                var trainingvalue = (label === $scope.currentExample.label) ? 1 : 0;
                var errorrate = trainingvalue - $scope.currentExample.output[label];
                if (errorrate > 0) {
                    errorrate = "+" + errorrate;
                }
                output += ("<tr><td>" + label + "</td><td>"  + $scope.currentExample.output[label] + "</td><td>" + trainingvalue + "</td><td><strong>" + errorrate + "</strong></td></tr>");
            }
            output += "</table>";

            fcnnVisualisationService.updateOutputHtml(output);


            var architecture = [ 1, CUSTOM_INPUT_LAYER_SIZE, 5, 8, $scope.project.labels.length ];

            var steps = [];
            for (var layerId = architecture.length - 1; layerId > 1; layerId--) {
                for (var nodeId = 0; nodeId < architecture[layerId]; nodeId++) {
                    if (layerId != (architecture.length - 1)) {
                        steps.push({ layer : layerId, type : 'bias', node : nodeId, action : 'adjust' });
                        steps.push({ layer : layerId, type : 'bias', node : nodeId, action : 'current' });
                    }
                }
                for (var nodeId = 0; nodeId < architecture[layerId]; nodeId++) {
                    steps.push({ layer : layerId, type : 'weights', node : nodeId, action : 'current' });
                    steps.push({ layer : layerId, type : 'weights', node : nodeId, action : 'adjust' });
                    steps.push({ layer : layerId, type : 'weights', node : nodeId, action : 'hide' });
                }
            }

            var stepId = 0;
            runningAnimations.push($interval(function () {
                var step = steps[stepId];

                var targetId = step.layer + '_' + step.node;

                if (step.type === 'weights') {
                    var inputLayer = step.layer - 1;
                    var numInputNodes = architecture[inputLayer];

                    var weightsToDisplay = [];

                    if (step.action === 'adjust') {
                        for (var inputNodeId = 0; inputNodeId < numInputNodes; inputNodeId++) {
                            WEIGHTS[inputLayer + '_' + inputNodeId][targetId] = adjust(WEIGHTS[inputLayer + '_' + inputNodeId][targetId]);
                        }
                    }
                    if (step.action === 'current' || step.action === 'adjust') {
                        for (var inputNodeId = 0; inputNodeId < numInputNodes; inputNodeId++) {
                            weightsToDisplay.push('w = ' + WEIGHTS[inputLayer + '_' + inputNodeId][targetId]);
                        }
                    }
                    if (step.action === 'hide') {
                        for (var inputNodeId = 0; inputNodeId < numInputNodes; inputNodeId++) {
                            weightsToDisplay.push('');
                        }
                    }

                    fcnnVisualisationService.displayWeights(step.layer, step.node, weightsToDisplay, step.action === 'adjust');
                }
                if (step.type === 'bias') {
                    if (step.action === 'adjust') {
                        BIAS[targetId] = adjust(BIAS[targetId]);
                    }

                    var values = {};
                    values[targetId] = { bias : BIAS[targetId] };
                    fcnnVisualisationService.updateLabels(values, step.action === 'adjust');
                }


                stepId += 1;
                if (onComplete && stepId === steps.length) {
                    onComplete();
                }
            }, SLOW, steps.length));
        }

        function adjust(val) {
            return val + (Math.random() > 0.5 ? 1 : -1);
        }


        function animateEpoch(onComplete) {
            loggerService.debug('[ml4kdesc] animating network layers with real examples');

            var exampleIdx = 1;

            var hiddenNodes = [
                [ 2, 0 ],
                [ 2, 1 ],
                [ 2, 2 ],
                [ 2, 3 ],
                [ 2, 4 ],
                [ 3, 0 ],
                [ 3, 1 ],
                [ 3, 2 ],
                [ 3, 3 ],
                [ 3, 4 ],
                [ 3, 5 ],
                [ 3, 6 ],
                [ 3, 7 ]
            ];

            var steps = [];
            steps.push({ action : 'next-example', node : [ 0, 0 ] });
            steps.push({ action : 'highlight-example', node : [ 0, 0 ] });
            for (var i = 0; i < CUSTOM_INPUT_LAYER_SIZE; i++) {
                steps.push({ action : 'input-layer', node : [ 1, i ] });
            }
            steps.push({ action : 'remove-focus', node : [ 0, 0 ] });
            for (var j = 0; j < hiddenNodes.length; j++) {
                steps.push({ action : 'hidden-nodes', node : hiddenNodes[j] });
            }
            steps.push({ action : 'remove-focus', node : [ 0, 0 ] });
            for (var k = 0; k < $scope.project.labels.length; k++) {
                steps.push({ action : 'output-layer', node : [ 4, k ] });
            }
            steps.push({ action : 'output-info', node : [ 4, 0 ] });
            steps.push({ action : 'error-rate', node : [ 4, 0 ] });
            steps.push({ action : 'hide-example', node : [ 0, 0 ] });
            steps.push({ action : 'display-weights', node : [ 4, 0 ] });
            steps.push({ action : 'highlight-weights', node : [ 4, 0 ] });
            steps.push({ action : 'adjust-weights', node : [ 4, 0 ] });
            steps.push({ action : 'display-weights', node : [ 4, 0 ] });
            steps.push({ action : 'hide-weights', node : [ 4, 0 ] });

            steps.push({ action : 'highlight-bias', node : [ 3, 0 ] });
            steps.push({ action : 'adjust-bias', node : [ 3, 0 ] });
            steps.push({ action : 'highlight-bias', node : [ 3, 1 ] });
            steps.push({ action : 'adjust-bias', node : [ 3, 1 ] });
            steps.push({ action : 'highlight-bias', node : [ 3, 2 ] });
            steps.push({ action : 'adjust-bias', node : [ 3, 2 ] });
            steps.push({ action : 'highlight-bias', node : [ 3, 3 ] });
            steps.push({ action : 'adjust-bias', node : [ 3, 3 ] });
            steps.push({ action : 'highlight-bias', node : [ 3, 4 ] });
            steps.push({ action : 'adjust-bias', node : [ 3, 4 ] });
            steps.push({ action : 'highlight-bias', node : [ 3, 5 ] });
            steps.push({ action : 'adjust-bias', node : [ 3, 5 ] });
            steps.push({ action : 'highlight-bias', node : [ 3, 6 ] });
            steps.push({ action : 'adjust-bias', node : [ 3, 6 ] });
            steps.push({ action : 'highlight-bias', node : [ 3, 7 ] });
            steps.push({ action : 'adjust-bias', node : [ 3, 7 ] });

            steps.push({ action : 'remove-bias-highlights', node : [ 3, 0 ] });

            steps.push({ action : 'display-weights', node : [ 3, 0 ] });
            steps.push({ action : 'highlight-weights', node : [ 3, 0 ] });
            steps.push({ action : 'adjust-weights', node : [ 3, 0 ] });
            steps.push({ action : 'display-weights', node : [ 3, 0 ] });
            steps.push({ action : 'hide-weights', node : [ 3, 0 ] });

            steps.push({ action : 'highlight-bias', node : [ 2, 0 ] });
            steps.push({ action : 'adjust-bias', node : [ 2, 0 ] });
            steps.push({ action : 'highlight-bias', node : [ 2, 1 ] });
            steps.push({ action : 'adjust-bias', node : [ 2, 1 ] });
            steps.push({ action : 'highlight-bias', node : [ 2, 2 ] });
            steps.push({ action : 'adjust-bias', node : [ 2, 2 ] });
            steps.push({ action : 'highlight-bias', node : [ 2, 3 ] });
            steps.push({ action : 'adjust-bias', node : [ 2, 3 ] });
            steps.push({ action : 'highlight-bias', node : [ 2, 4 ] });
            steps.push({ action : 'adjust-bias', node : [ 2, 4 ] });

            steps.push({ action : 'remove-bias-highlights', node : [ 2, 0 ] });

            steps.push({ action : 'display-weights', node : [ 2, 0 ] });
            steps.push({ action : 'highlight-weights', node : [ 2, 0 ] });
            steps.push({ action : 'adjust-weights', node : [ 2, 0 ] });
            steps.push({ action : 'display-weights', node : [ 2, 0 ] });
            steps.push({ action : 'hide-weights', node : [ 2, 0 ] });

            steps.push({ action : 'complete', node : [ 4, 0 ] });


            var stepId = 0;

            // var vals = {};
            // for (var x = 0; x < hiddenNodes.length; x++) {
            //     var nxtnode = hiddenNodes[x];
            //     var nxtnodeid = nxtnode[0] + '_' + nxtnode[1];
            //     vals[nxtnodeid] = { bias : BIAS[nxtnodeid] };
            // }
            // fcnnVisualisationService.updateLabels(vals);

            var architecture = [ 1, CUSTOM_INPUT_LAYER_SIZE, 5, 8, $scope.project.labels.length ];

            runningAnimations.push($interval(function () {
                var step = steps[stepId];
                var action = step.action;

                var node = step.node;
                var layerId = node[0];
                var nodeIdx = node[1];

                var nodeid = layerId + '_' + nodeIdx;

                var values = {};

                loggerService.debug('[ml4kdesc] animation', action, node);

                if (action === 'next-example') {
                    fcnnVisualisationService.remove_focus();
                    fcnnVisualisationService.updateOutputHtml();

                    $scope.currentExample = $scope.modelinfo.examples[exampleIdx];
                    fcnnVisualisationService.updateInputText($scope.currentExample.text);

                    exampleIdx = (exampleIdx + 1) % $scope.modelinfo.examples.length;
                }
                else if (action === 'highlight-example') {
                    fcnnVisualisationService.highlightInputText();
                }
                else if (action === 'input-layer') {
                    var example = $scope.currentExample.random[nodeIdx];

                    values[nodeid] = { value : example.value };
                    fcnnVisualisationService.updateLabels(values);
                }
                else if (action === 'hidden-nodes') {
                    values[nodeid] = { value : calculateHiddenLayerValue(layerId, nodeIdx) };
                    fcnnVisualisationService.updateLabels(values);
                }
                else if (action === 'output-layer') {
                    for (var i = 0; i < $scope.project.labels.length; i++) {
                        var label = $scope.project.labels[i];
                        values[nodeid] = { value : $scope.currentExample.output[label] };
                    }
                    fcnnVisualisationService.updateLabels(values);
                }
                else if (action === 'output-info') {
                    var output = "<table>" +
                        "<tr><th>label</th><th>output</th></tr>";
                    for (var i = 0; i < $scope.project.labels.length; i++) {
                        var label = $scope.project.labels[i];
                        output += ("<tr><td>" + label + "</td><td>"  + $scope.currentExample.output[label] + "</td></tr>");
                    }
                    output += "</table>";

                    fcnnVisualisationService.updateOutputHtml(output);
                }
                else if (action === 'error-rate') {
                    fcnnVisualisationService.remove_focus();

                    var output = "<table>" +
                        "<tr><th>label</th><th>output</th><th>training</th></tr>";
                    for (var i = 0; i < $scope.project.labels.length; i++) {
                        var label = $scope.project.labels[i];
                        var trainingvalue = (label === $scope.currentExample.label) ? 1 : 0;
                        output += ("<tr><td>" + label + "</td><td>"  + $scope.currentExample.output[label] + "</td><td>" + trainingvalue + "</td></tr>");
                    }
                    output += "</table>";

                    fcnnVisualisationService.updateOutputHtml(output);
                }
                else if (action === 'hide-example') {
                    fcnnVisualisationService.removeValues();


                    var output = "<table>" +
                        "<tr><th>label</th><th>output</th><th>training</th><th>error</th></tr>";
                    for (var i = 0; i < $scope.project.labels.length; i++) {
                        var label = $scope.project.labels[i];
                        var trainingvalue = (label === $scope.currentExample.label) ? 1 : 0;
                        var errorrate = trainingvalue - $scope.currentExample.output[label];
                        if (errorrate > 0) {
                            errorrate = "+" + errorrate;
                        }
                        output += ("<tr><td>" + label + "</td><td>"  + $scope.currentExample.output[label] + "</td><td>" + trainingvalue + "</td><td><strong>" + errorrate + "</strong></td></tr>");
                    }
                    output += "</table>";

                    fcnnVisualisationService.updateOutputHtml(output);
                }
                else if (action === 'display-weights') {
                    var previousLayer = layerId - 1;
                    var previousLayerNumNodes = architecture[previousLayer];

                    var numNodes = architecture[layerId];
                    for (var i = 0; i < numNodes; i++) {
                        var targetId = layerId + '_' + i;
                        var weights = [];
                        for (var j = 0; j < previousLayerNumNodes; j++) {
                            weights.push(WEIGHTS[previousLayer + '_' + j][targetId]);
                        }
                        fcnnVisualisationService.displayWeights(layerId, i, weights);
                    }
                }
                else if (action === 'hide-weights') {
                    fcnnVisualisationService.removeValues();

                    var previousLayer = layerId - 1;
                    var previousLayerNumNodes = architecture[previousLayer];

                    var numNodes = architecture[layerId];
                    for (var i = 0; i < numNodes; i++) {
                        var targetId = layerId + '_' + i;
                        var weights = [];
                        for (var j = 0; j < previousLayerNumNodes; j++) {
                            weights.push('');
                        }
                        fcnnVisualisationService.displayWeights(layerId, i, weights);
                    }
                }
                else if (action === 'highlight-weights') {
                    var previousLayer = layerId - 1;
                    var previousLayerNumNodes = architecture[previousLayer];

                    var numNodes = architecture[layerId];
                    for (var i = 0; i < numNodes; i++) {
                        var targetId = layerId + '_' + i;
                        var weights = [];
                        for (var j = 0; j < previousLayerNumNodes; j++) {
                            weights.push(WEIGHTS[previousLayer + '_' + j][targetId]);
                        }
                        fcnnVisualisationService.displayWeights(layerId, i, weights, true);
                    }
                }
                else if (action === 'adjust-weights') {
                    var previousLayer = layerId - 1;
                    var previousLayerNumNodes = architecture[previousLayer];

                    var numNodes = architecture[layerId];
                    for (var i = 0; i < numNodes; i++) {
                        var targetId = layerId + '_' + i;
                        var weights = [];
                        for (var j = 0; j < previousLayerNumNodes; j++) {
                            WEIGHTS[previousLayer + '_' + j][targetId] = adjust(WEIGHTS[previousLayer + '_' + j][targetId]);
                            weights.push(WEIGHTS[previousLayer + '_' + j][targetId]);
                        }
                        fcnnVisualisationService.displayWeights(layerId, i, weights, true);
                    }
                }
                else if (action === 'highlight-bias') {
                    var values = {};
                    values[nodeid] = { bias : BIAS[nodeid] };
                    fcnnVisualisationService.updateLabels(values, true);
                }
                else if (action === 'adjust-bias') {
                    BIAS[nodeid] = adjust(BIAS[nodeid]);

                    var values = {};
                    values[nodeid] = { bias : BIAS[nodeid] };
                    fcnnVisualisationService.updateLabels(values, true);
                }
                else if (action === 'remove-bias-highlights') {
                    var values = {};
                    var numNodes = architecture[layerId];
                    for (var i = 0; i < numNodes; i++) {
                        var targetId = layerId + '_' + i;
                        values[targetId] = { bias : BIAS[targetId] };
                    }
                    fcnnVisualisationService.updateLabels(values);
                }
                else if (action === 'remove-focus') {
                    fcnnVisualisationService.remove_focus();
                }


                stepId = (stepId + 1) % steps.length;
            }, VERY_FAST, 1000));

            onComplete();
        }


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
