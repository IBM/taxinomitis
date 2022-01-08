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

        utilService.loadScript('/static/bower_components/d3/d3.min.js')
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
                if (models && models.length > 0 && (models[0].status === 'Available') || (models[0].status === 'Training')) {
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

        function initializeVisualisation() {
            loggerService.debug('[ml4kdesc] initializing visualization');

            initializeModelValues();

            $timeout(function () {
                fcnnVisualisationService.init('mlforkidsmodelvizimg');
                redrawNeuralNetworkDiagram(ARCHITECTURES.INITIAL);
            }, 0);
        }


        //-------------------------------------------------------------------------------
        // Defining the models
        //-------------------------------------------------------------------------------

        var modelInfo = {
            architecture : [],
            spacing : []
        };

        var WEIGHTS = {};
        var BIAS = {};
        var VALUES = {};

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

        // randomly increase or decrease by 1
        function adjust(val) {
            return val + (Math.random() > 0.5 ? 1 : -1);
        }

        var ARCHITECTURES = {
            // represents a large complex model displayed when the wizard starts
            INITIAL : 'initial',
            // represents the model used for the full walkthrough
            CUSTOM : 'custom',
            // represents a model with a medium size input layer, used to illustrate custom features
            FEATURE_SELECTION : 'feature',
            // represents a model with a large input layer, used to illustrate bag-of-words
            BAG_OF_WORDS : 'bag-of-words',
        };

        function setModelInfo(modeltype) {
            if (modeltype === ARCHITECTURES.INITIAL) {
                modelInfo.architecture = [ 9,  7,  9,  5,  7,  1 ];
                modelInfo.spacing = [ 20, 20, 20, 20, 20, 20 ];
            }
            else if (modeltype === ARCHITECTURES.CUSTOM) {
                modelInfo.architecture = [ 1,  7, 5, 8, $scope.project.labels.length ];
                modelInfo.spacing = [ 0, 20, 20, 20, 100 ];
            }
            else if (modeltype === ARCHITECTURES.BAG_OF_WORDS) {
                modelInfo.architecture = [ 1, 10, 5, 8, $scope.project.labels.length ];
                modelInfo.spacing = [ 0, 20, 20, 20, 100 ];
            }
            else if (modeltype === ARCHITECTURES.FEATURE_SELECTION) {
                modelInfo.architecture = [ 1, 9, 6, 7, $scope.project.labels.length ];
                modelInfo.spacing = [ 0, 20, 20, 20, 100 ];
            }
        }
        // returns the number of nodes in layer 1
        function getInputLayerSize() {
            return modelInfo.architecture[1];
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
            'https://duckduckgo.com/?q=bag+of+words+machine+learning',
            // 6 :
            'https://duckduckgo.com/?q=feature+extraction+text+classification',
            // 7 :
            'https://duckduckgo.com/?q=word+embedding+neural+network',
            // 8 :
            'https://duckduckgo.com/?q=hidden+layer+neural+network',
            // 9 :
            'https://duckduckgo.com/?q=activation+function+neural+network',
            // 10 :
            'https://duckduckgo.com/?q=weight+bias+neural+network',
            // 11 :
            'https://duckduckgo.com/?q=weight+bias+neural+network',
            // 12 :
            'https://duckduckgo.com/?q=activation+function+neural+network',
            // 13 :
            'https://duckduckgo.com/?q=activation+function+neural+network',
            // 14 :
            'https://duckduckgo.com/?q=hidden+layer+neural+network',
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
                redrawNeuralNetworkDiagram(ARCHITECTURES.INITIAL);
            }
            if (vm.wizardPage === 3) {
                fcnnVisualisationService.clearInputLabels();
            }
            if (vm.wizardPage === 4) {
                redrawNeuralNetworkDiagram(ARCHITECTURES.CUSTOM);
                displayTrainingExampleInput();
            }
            if (vm.wizardPage === 5) {
                redrawNeuralNetworkDiagram(ARCHITECTURES.BAG_OF_WORDS);
                displayTrainingExampleInput();
            }
            if (vm.wizardPage === 8) {
                fcnnVisualisationService.hideAnnotation('2_0');
            }
            if (vm.wizardPage === 10) {
                clearBias(2, 0);
            }
            if (vm.wizardPage === 11) {
                populateHiddenLayerNodeWithPlaceholder(2, 0);
            }
            if (vm.wizardPage === 12) {
                clearBias(2, 1);
                populateHiddenLayerNodeWithPlaceholder(2, 1);
                fcnnVisualisationService.hideAnnotation('2_1');
            }
            if (vm.wizardPage === 13) {
                clearBias(2, 2);
                populateHiddenLayerNodeWithPlaceholder(2, 2);
                fcnnVisualisationService.hideAnnotation('2_2');
            }
            if (vm.wizardPage === 14 || vm.wizardPage === 15) {
                populateHiddenLayerNodeWithPlaceholder(2, 3);
                populateHiddenLayerNodeWithPlaceholder(2, 4);
                clearHiddenLayerNodeValues(3);
            }
            if (vm.wizardPage === 15) {
                hideOutputValues();
                clearOutputLayerNodeValues();
            }
            if (vm.wizardPage === 19) {
                fcnnVisualisationService.clearInputLabels();
            }
            if (vm.wizardPage === 20) {
                populateHiddenLayerNodeWithPlaceholder(2, 0);
                fcnnVisualisationService.hideAnnotation('2_0');
            }
            if (vm.wizardPage === 21) {
                populateHiddenLayerNodeWithPlaceholder(2, 1);
                fcnnVisualisationService.hideAnnotation('2_1');
            }
            if (vm.wizardPage === 22) {
                populateHiddenLayerNodeWithPlaceholder(2, 2);
                fcnnVisualisationService.hideAnnotation('2_2');
            }
            if (vm.wizardPage === 23 || vm.wizardPage === 24) {
                populateHiddenLayerNodeWithPlaceholder(2, 3);
                populateHiddenLayerNodeWithPlaceholder(2, 4);
                clearHiddenLayerNodeValues(3);
            }
            if (vm.wizardPage === 24) {
                hideOutputValues();
                clearOutputLayerNodeValues();
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
                redrawNeuralNetworkDiagram(ARCHITECTURES.CUSTOM);
            }
            if (vm.wizardPage === 5) {
                redrawNeuralNetworkDiagram(ARCHITECTURES.BAG_OF_WORDS);
                displayTrainingExampleInput();
            }
            if (vm.wizardPage === 6) {
                redrawNeuralNetworkDiagram(ARCHITECTURES.FEATURE_SELECTION);
                displayTrainingExampleInput();
            }
            if (vm.wizardPage === 7) {
                redrawNeuralNetworkDiagram(ARCHITECTURES.CUSTOM);
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
                    populateInputLayer($scope.currentExample.random, FAST, wizardStepComplete);
                    break;
                case 5:
                    populateInputLayer($scope.currentExample.bagofwords, SLOW, wizardStepComplete);
                    break;
                case 6:
                    populateInputLayer($scope.currentExample.customfeatures, SLOW, wizardStepComplete);
                    break;
                case 7:
                    populateInputLayer($scope.currentExample.random, FAST, wizardStepComplete);
                    break;
                case 8:
                    populateHiddenLayerWithPlaceholders(2, wizardStepComplete);
                    break;
                case 9:
                    displayHiddenLayerValueWithWorking(2, 0, { });
                    wizardStepComplete();
                    break;
                case 10:
                    displayHiddenLayerValueWithWorking(2, 0, { weight : true });
                    wizardStepComplete();
                    break;
                case 11:
                    displayHiddenLayerValueWithWorking(2, 0, { weight : true, bias : true });
                    wizardStepComplete();
                    break;
                case 12:
                    displayHiddenLayerValueWithWorking(2, 0, { weight : true, bias : true, finalvalue : true });
                    wizardStepComplete();
                    break;
                case 13:
                    displayHiddenLayerValueWithWorking(2, 1, { weight : true, bias : true, finalvalue : true });
                    wizardStepComplete();
                    break;
                case 14:
                    displayHiddenLayerValueWithWorking(2, 2, { weight : true, bias : true, finalvalue : true });
                    wizardStepComplete();
                    break;
                case 15:
                    displayAllHiddenLayerValues(VERY_SLOW, wizardStepComplete);
                    break;
                case 16:
                    displayOutputValues(wizardStepComplete);
                    break;
                case 17:
                    displayOutputErrorRate(wizardStepComplete);
                    break;
                case 18:
                    displayBackPropagation(SLOW, wizardStepComplete);
                    break;
                case 19:
                    hideOutputValues();
                    $scope.currentExample = $scope.modelinfo.examples[1];
                    displayTrainingExampleInput(wizardStepComplete);
                    break;
                case 20:
                    populateInputLayer($scope.currentExample.random, FAST, wizardStepComplete);
                    break;
                case 21:
                    displayHiddenLayerValueWithWorking(2, 0, { weight : true, bias : true, finalvalue : true });
                    wizardStepComplete();
                    break;
                case 22:
                    displayHiddenLayerValueWithWorking(2, 1, { weight : true, bias : true, finalvalue : true });
                    wizardStepComplete();
                    break;
                case 23:
                    displayHiddenLayerValueWithWorking(2, 2, { weight : true, bias : true, finalvalue : true });
                    wizardStepComplete();
                    break;
                case 24:
                    displayAllHiddenLayerValues(FAST, wizardStepComplete);
                    break;
                case 25:
                    displayOutputValues(wizardStepComplete);
                    break;
                case 26:
                    displayOutputErrorRate(wizardStepComplete);
                    break;
                case 27:
                    displayBackPropagation(FAST, wizardStepComplete);
                    break;
                case 28:
                    animateEpoch(wizardStepComplete);
                    break;
                case 29:
                    redrawNeuralNetworkDiagram(ARCHITECTURES.INITIAL);
                    break;
            }
        }

        //-------------------------------------------------------------------------------
        // Update the model graphic
        //-------------------------------------------------------------------------------

        var LOWEST_SPEED = 800;
        var VERY_SLOW = 600;
        var SLOW = 400;
        var FAST = 200;
        var FASTEST_SPEED = 150;

        function redrawNeuralNetworkDiagram(modeltype) {
            loggerService.debug('[ml4kdesc] redrawing the model network diagram', modeltype);

            setModelInfo(modeltype);
            fcnnVisualisationService.create(modelInfo.architecture, modelInfo.spacing);
        }

        function cancelRunningAnimations() {
            loggerService.debug('[ml4kdesc] stopping previous animations');

            for (var i = 0; i < runningAnimations.length; i++) {
                $interval.cancel(runningAnimations[i]);
            }
            runningAnimations = [];
            fcnnVisualisationService.remove_focus();
        }

        $scope.$on('$destroy', function () {
            loggerService.debug('[ml4kdesc] handling page change');
            cancelRunningAnimations();
        });

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

        function displayTrainingExampleInput(onComplete) {
            loggerService.debug('[ml4kdesc] displaying training example in diagram');

            fcnnVisualisationService.updateInputText($scope.currentExample.text);
            fcnnVisualisationService.highlightInputText();

            if (onComplete) {
                onComplete();
            }
        }

        function populateInputLayer(examples, speed, onComplete) {
            loggerService.debug('[ml4kdesc] populating input layer');

            fcnnVisualisationService.clearInputLabels();

            var nodeIdx = 0;
            var values = {};
            var iterations = getInputLayerSize();
            runningAnimations.push($interval(function () {
                var example = examples[nodeIdx];

                var nodeid = '1_' + nodeIdx;
                values[nodeid] = { value : example.value };
                fcnnVisualisationService.updateLabels(values);

                if (example.annotation) {
                    fcnnVisualisationService.showAnnotation(nodeid, example.annotation);
                }

                nodeIdx += 1;

                if (onComplete && nodeIdx === iterations) {
                    onComplete();
                }
            }, speed, iterations));
        }


        function calculateHiddenLayerValue(layerId, nodeIdx) {
            loggerService.debug('[ml4kdesc] calculating hidden layer value', layerId, nodeIdx);

            var value = 0;

            var endLayerId = layerId;
            var endNodeId = layerId + '_' + nodeIdx;

            var numNodes = getInputLayerSize();

            var startLayerId = endLayerId - 1;
            for (var startNodeIdx = 0; startNodeIdx < numNodes; startNodeIdx++) {
                var startNodeId = startLayerId + '_' + startNodeIdx;

                value += ($scope.currentExample.random[startNodeIdx].value * WEIGHTS[startNodeId][endNodeId]);
            }

            value += BIAS[endNodeId];

            VALUES[endNodeId] = value;

            return value;
        }

        function clearBias(layerId, nodeIdx) {
            var nodeid = layerId + '_' + nodeIdx;
            var values = {};
            values[nodeid] = { bias : undefined };
            fcnnVisualisationService.updateLabels(values);
        }

        function populateHiddenLayerNodeWithPlaceholder(layerId, nodeIdx) {
            var nodeid = layerId + '_' + nodeIdx;
            var values = {};
            values[nodeid] = { value : '?' };
            fcnnVisualisationService.updateLabels(values);
        }

        function clearHiddenLayerNodeValues(layerId) {
            for (var nodeId = 0; nodeId < modelInfo.architecture[layerId]; nodeId++) {
                populateHiddenLayerNodeWithPlaceholder(layerId, nodeId);
            }
        }


        function populateHiddenLayerWithPlaceholders(layerId, onComplete) {
            loggerService.debug('[ml4kdesc] populating hidden layer with placeholders', layerId);

            var nodeIdx = 0;
            var iterations = modelInfo.architecture[layerId];
            runningAnimations.push($interval(function () {
                populateHiddenLayerNodeWithPlaceholder(layerId, nodeIdx);

                nodeIdx += 1;

                if (onComplete && nodeIdx === iterations) {
                    onComplete();
                }
            }, FAST, iterations));
        }


        function displayHiddenLayerValueWithWorking(layerId, nodeId, includes) {
            loggerService.debug('[ml4kdesc] displaying hidden layer values', layerId, nodeId, includes);

            fcnnVisualisationService.highlightHiddenLayerNode(layerId, nodeId);

            var inputLayer = layerId - 1;
            var numInputNodes = modelInfo.architecture[inputLayer];
            var lastInputNodeIdx = numInputNodes - 1;

            var targetId = layerId + '_' + nodeId;

            if (includes.weight) {
                var weightsToDisplay = [];
                for (var inputNodeId = 0; inputNodeId < numInputNodes; inputNodeId++) {
                    weightsToDisplay.push('w = ' + WEIGHTS[inputLayer + '_' + inputNodeId][targetId]);
                }
                fcnnVisualisationService.displayWeights(layerId, nodeId, weightsToDisplay, {});
            }

            var values = {};
            if (includes.bias || includes.value) {
                values[targetId] = {};
                if (includes.bias) {
                    values[targetId].bias = BIAS[targetId];
                }
                if (includes.finalvalue) {
                    values[targetId].value = calculateHiddenLayerValue(layerId, nodeId);
                }
                fcnnVisualisationService.updateLabels(values);
            }

            var working = "<table>";
            if (includes.bias) {
                working += ("<tr><td>" + BIAS[targetId] + "</td><td></td><td></td><td></td><td>+</td></tr>");
                working += ("<tr><td colspan=5 style='font-size: 0.2em;'> &nbsp; </td></tr>");
            }
            for (var i = 0; i < numInputNodes; i++) {
                var tablerow = "<tr>";
                tablerow += "<td>" + $scope.currentExample.random[i].value + "</td>";
                if (includes.weight) {
                    tablerow += "<td>x</td>" +
                                "<td>" + WEIGHTS[inputLayer + '_' + i][targetId] + "</td>";
                }
                tablerow += "<td></td><td>" + (i === lastInputNodeIdx ? "" : "+") + "</td>";
                tablerow += "</tr>";

                working += tablerow;
            }
            if (includes.finalvalue) {
                working += ("<tr><td colspan=5 style='font-size: 0.25em;'> &nbsp; </td></tr>");
                working += ("<tr><td colspan=5> = " + values[targetId].value + "</td></tr>");
            }
            working += "</table>";

            fcnnVisualisationService.showAnnotation(targetId, working);
        }

        function displayAllHiddenLayerValues(speed, onComplete) {
            loggerService.debug('[ml4kdesc] display hidden layer values', speed);

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
            var iterations = remainingNodes.length;
            runningAnimations.push($interval(function () {
                if (nodeIdx >= 0) {
                    var remainingNode = remainingNodes[nodeIdx];
                    var nodeid = remainingNode[0] + '_' + remainingNode[1];
                    values[nodeid].value = calculateHiddenLayerValue(remainingNode[0], remainingNode[1]);
                    fcnnVisualisationService.updateLabels(values);
                }

                nodeIdx += 1;

                if (onComplete && nodeIdx === iterations) {
                    onComplete();
                }
            }, speed, iterations + 1));
        }

        function hideOutputValues() {
            fcnnVisualisationService.updateOutputHtml();
        }

        function displayOutputValues(onComplete) {
            loggerService.debug('[ml4kdesc] display output values');
            displayOutputLayerNodeValues();

            $timeout(function () {
                displayOutputInfoTable({});
                onComplete();
            }, VERY_SLOW);
        }

        function clearOutputLayerNodeValues() {
            var layerId = modelInfo.architecture.length - 1;
            var values = {};
            for (var nodeIdx = 0; nodeIdx < $scope.project.labels.length; nodeIdx++) {
                values[layerId + '_' + nodeIdx] = { value : '' };
            }
            fcnnVisualisationService.updateLabels(values);
        }

        function displayOutputLayerNodeValues() {
            loggerService.debug('[ml4kdesc] adding output layer node values');
            var layerId = modelInfo.architecture.length - 1;
            var values = {};
            for (var nodeIdx = 0; nodeIdx < $scope.project.labels.length; nodeIdx++) {
                var label = $scope.project.labels[nodeIdx];
                values[layerId + '_' + nodeIdx] = { value : $scope.currentExample.output[label] };
            }
            fcnnVisualisationService.updateLabels(values);
        }

        function displayOutputErrorRate(onComplete) {
            loggerService.debug('[ml4kdesc] displaying output error rate');

            displayOutputInfoTable({ training : true });

            $timeout(function () {
                displayOutputInfoTable({ training : true, error : true });
                onComplete();
            }, LOWEST_SPEED);
        }

        function displayOutputInfoTable(includes) {
            loggerService.debug('[ml4kdesc] generating output info table', includes);

            var output = "<table>";
            output += "<tr><th>label</th><th>output</th>";
            if (includes.training) {
                output += "<th>training</th>";

                if (includes.error) {
                    output += "<th>error</th>";
                }
            }
            output += "</tr>";

            for (var i = 0; i < $scope.project.labels.length; i++) {
                var label = $scope.project.labels[i];

                output += "<tr>";
                output += "<td>" + label + "</td><td>"  + $scope.currentExample.output[label] + "</td>";

                if (includes.training) {
                    var trainingvalue = (label === $scope.currentExample.label) ? 100 : 0;
                    output += "<td>" + trainingvalue + "</td>";

                    if (includes.error) {
                        var errorrate = $scope.currentExample.output[label] - trainingvalue;
                        if (errorrate > 0) {
                            errorrate = "+" + errorrate;
                        }

                        output += ("<td>" +
                                   (includes.errorhighlight ? "<strong>" : "") +
                                   errorrate +
                                   (includes.errorhighlight ? "</strong>" : "") +
                                   "</td>");
                    }
                }

                output += "</tr>";
            }
            output += "</table>";

            fcnnVisualisationService.updateOutputHtml(output);
        }


        function displayLinkWeights(layerId, includes) {
            loggerService.debug('[ml4kdesc] displaying link weights', layerId, includes);

            var previousLayer = layerId - 1;
            var previousLayerNumNodes = modelInfo.architecture[previousLayer];

            var numNodes = modelInfo.architecture[layerId];
            for (var i = 0; i < numNodes; i++) {
                var targetId = layerId + '_' + i;
                var weights = [];
                for (var j = 0; j < previousLayerNumNodes; j++) {
                    if (includes.hide) {
                        weights.push('');
                    }
                    else {
                        if (includes.adjustment) {
                            WEIGHTS[previousLayer + '_' + j][targetId] = adjust(WEIGHTS[previousLayer + '_' + j][targetId]);
                        }
                        weights.push(WEIGHTS[previousLayer + '_' + j][targetId]);
                    }
                }
                fcnnVisualisationService.displayWeights(layerId, i, weights, { label : includes.highlight });
            }
        }


        function displayBackPropagation(speed, onComplete) {
            loggerService.debug('[ml4kdesc] running backprop animation');

            fcnnVisualisationService.removeValues();

            displayOutputInfoTable({ training : true, error : true, errorhighlight : true });

            var steps = [];
            for (var layerId = modelInfo.architecture.length - 1; layerId > 1; layerId--) {
                for (var nodeId = 0; nodeId < modelInfo.architecture[layerId]; nodeId++) {
                    if (layerId != (modelInfo.architecture.length - 1)) {
                        steps.push({ layer : layerId, type : 'bias', node : nodeId, action : 'adjust' });
                        steps.push({ layer : layerId, type : 'bias', node : nodeId, action : 'current' });
                    }
                }
                for (var nodeId = 0; nodeId < modelInfo.architecture[layerId]; nodeId++) {
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
                    var numInputNodes = modelInfo.architecture[inputLayer];

                    var highlights = {
                        label : step.action === 'adjust',
                        path : step.action !== 'hide'
                    };

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

                    fcnnVisualisationService.displayWeights(step.layer, step.node, weightsToDisplay, highlights);
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
            }, speed, steps.length));
        }



        function animateEpoch(onComplete) {
            loggerService.debug('[ml4kdesc] animating network layers with real examples');

            var numInputNodes = getInputLayerSize();

            var exampleIdx = 1;

            var steps = [];
            steps.push({ action : 'next-example', node : [ 0, 0 ] });
            steps.push({ action : 'highlight-example', node : [ 0, 0 ] });
            for (var i = 0; i < numInputNodes; i++) {
                steps.push({ action : 'input-layer', node : [ 1, i ] });
            }
            steps.push({ action : 'remove-focus', node : [ 0, 0 ] });
            for (var hiddenLayer = 2; hiddenLayer < (modelInfo.architecture.length - 1); hiddenLayer++) {
                for (var hiddenLayerNodeIdx = 0; hiddenLayerNodeIdx < modelInfo.architecture[hiddenLayer]; hiddenLayerNodeIdx++) {
                    steps.push({ action : 'hidden-nodes', node : [ hiddenLayer, hiddenLayerNodeIdx ] });
                }
            }

            steps.push({ action : 'remove-focus', node : [ 0, 0 ] });
            for (var k = 0; k < $scope.project.labels.length; k++) {
                steps.push({ action : 'output-layer', node : [ 4, k ] });
            }
            steps.push({ action : 'output-info', node : [ 4, 0 ] });
            steps.push({ action : 'error-rate', node : [ 4, 0 ] });
            steps.push({ action : 'hide-example', node : [ 0, 0 ] });

            for (var stepLayer = 4; stepLayer >= 2; stepLayer--) {
                if (stepLayer < 4) {
                    for (var x = 0; x < modelInfo.architecture[stepLayer]; x++) {
                        steps.push({ action : 'highlight-bias', node : [ stepLayer, x ] });
                        steps.push({ action : 'adjust-bias', node : [ stepLayer, x ] });
                    }
                    steps.push({ action : 'remove-bias-highlights', node : [ stepLayer, 0 ] });
                }

                steps.push({ action : 'display-weights', node : [ stepLayer, 0 ] });
                steps.push({ action : 'highlight-weights', node : [ stepLayer, 0 ] });
                steps.push({ action : 'adjust-weights', node : [ stepLayer, 0 ] });
                steps.push({ action : 'display-weights', node : [ stepLayer, 0 ] });
                steps.push({ action : 'hide-weights', node : [ stepLayer, 0 ] });
            }


            var stepId = 0;

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
                    displayOutputLayerNodeValues();
                }
                else if (action === 'output-info') {
                    displayOutputInfoTable({});
                }
                else if (action === 'error-rate') {
                    fcnnVisualisationService.remove_focus();
                    displayOutputInfoTable({ training : true });
                }
                else if (action === 'hide-example') {
                    fcnnVisualisationService.removeValues();
                    displayOutputInfoTable({ training : true, error : true, errorhighlight : true });
                }
                else if (action === 'display-weights') {
                    displayLinkWeights(layerId, {});
                }
                else if (action === 'hide-weights') {
                    fcnnVisualisationService.removeValues();
                    displayLinkWeights(layerId, { hide : true });
                }
                else if (action === 'highlight-weights') {
                    displayLinkWeights(layerId, { highlight : true });
                }
                else if (action === 'adjust-weights') {
                    displayLinkWeights(layerId, { highlight : true, adjustment : true });
                }
                else if (action === 'highlight-bias') {
                    values[nodeid] = { bias : BIAS[nodeid] };
                    fcnnVisualisationService.updateLabels(values, true);
                }
                else if (action === 'adjust-bias') {
                    BIAS[nodeid] = adjust(BIAS[nodeid]);

                    values[nodeid] = { bias : BIAS[nodeid] };
                    fcnnVisualisationService.updateLabels(values, true);
                }
                else if (action === 'remove-bias-highlights') {
                    var numNodes = modelInfo.architecture[layerId];
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
            }, FASTEST_SPEED, 1500));

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
                console.log('left : ' + container.scrollLeft);
            }, REPEAT_INTERVAL);
        };
        vm.goright = function() {
            vm.stop();
            var container = document.getElementById("mlforkidsmodelvizimghost");
            operation = $interval(function () {
                container.scrollLeft -= SCROLL_PIXELS;
                console.log('left : ' + container.scrollLeft);
            }, REPEAT_INTERVAL);
        };
        vm.goup = function() {
            vm.stop();
            var container = document.getElementById("mlforkidsmodelvizimghost");
            operation = $interval(function () {
                container.scrollTop -= SCROLL_PIXELS;
                console.log('top : ' + container.scrollTop);
            }, REPEAT_INTERVAL);
        };
        vm.godown = function() {
            vm.stop();
            var container = document.getElementById("mlforkidsmodelvizimghost");
            operation = $interval(function () {
                container.scrollTop += SCROLL_PIXELS;
                console.log('top : ' + container.scrollTop);
            }, REPEAT_INTERVAL);
        };

        // function zoomToElement(elementId) {
        //     var image = document.getElementById("mlforkidsmodelvizimg");

        //     var currentWidth = image.style["width"] || "100%";
        //     var percentIdx = currentWidth.indexOf("%");
        //     if (percentIdx > 0) {
        //         currentWidth = currentWidth.substr(0, percentIdx);
        //     }
        //     var zoomScaleStep = 20;

        //     var currentZoomLevel = parseInt(currentWidth, 10);
        //     console.log('zoom level is ' + currentZoomLevel);

        //     currentZoomLevel = currentZoomLevel - (currentZoomLevel % zoomScaleStep);

        //     var targetZoomLevel = 200;

        //     if (currentZoomLevel > targetZoomLevel) {
        //         var steps = (currentZoomLevel - targetZoomLevel) / zoomScaleStep;
        //         $interval(function () {
        //             currentZoomLevel -= zoomScaleStep;
        //             console.log('setting zoom to ' + currentZoomLevel);
        //             image.style["width"] = currentZoomLevel + "%";
        //         }, FASTEST_SPEED, steps);
        //     }
        //     else if (currentZoomLevel < targetZoomLevel) {
        //         var steps = (targetZoomLevel - currentZoomLevel) / zoomScaleStep;
        //         $interval(function () {
        //             currentZoomLevel += zoomScaleStep;
        //             console.log('setting zoom to ' + currentZoomLevel);
        //             image.style["width"] = currentZoomLevel + "%";
        //         }, FASTEST_SPEED, steps);
        //     }


        //     var target = getElementById(elementId);
        //     var location = target.getBoundingClientRect();
        //     var xLocation = location.x - (location.x % 50);

        //     var container = document.getElementById("mlforkidsmodelvizimghost");
        //     container.scrollLeft = xLocation;
        // }
        // function resetZoom() {
        //     var image = document.getElementById("mlforkidsmodelvizimg");
        //     var currentWidth = image.style["width"] || "100%";
        //     var percentIdx = currentWidth.indexOf("%");
        //     if (percentIdx > 0) {
        //         currentWidth = currentWidth.substr(0, percentIdx);
        //     }
        //     var zoomScaleStep = 20;

        //     var currentZoomLevel = parseInt(currentWidth, 10);
        //     console.log('zoom level is ' + currentZoomLevel);

        //     currentZoomLevel = currentZoomLevel - (currentZoomLevel % zoomScaleStep);

        //     if (currentZoomLevel > 100) {
        //         var steps = (currentZoomLevel - 100) / zoomScaleStep;
        //         $interval(function () {
        //             currentZoomLevel -= zoomScaleStep;
        //             console.log('setting zoom to ' + currentZoomLevel);
        //             image.style["width"] = currentZoomLevel + "%";
        //         }, FASTEST_SPEED, steps);
        //     }
        // }



        //-------------------------------------------------------------------------------

        function getRandomInt(min, max) {
            min = Math.ceil(min);
            max = Math.floor(max);
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
    }
}());
