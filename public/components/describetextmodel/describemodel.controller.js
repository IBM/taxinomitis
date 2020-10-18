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

                    // number of nodes in each layer
                    var architecture = [ 1, 9, 7, 9, 2 ];
                    // pixels between the nodes in each layer
                    var betweenNodesInLayer = [ 0, 20, 20, 20, 100 ];

                    $timeout(function () {
                        fcnnVisualisationService.init('mlforkidsmodelvizimg');
                        fcnnVisualisationService.prepareNN(architecture, betweenNodesInLayer);
                        fcnnVisualisationService.redraw();
                        fcnnVisualisationService.redistribute();
                        fcnnVisualisationService.addLabels();

                        var newvals = { "1_0" : { "value" : 3 }, "1_1" : { "value" : 4 }, "1_2" : { "value" : 8 }, "1_3" : { "value" : 1 }, "1_4" : { "value" : 0.0 }, "1_5" : { "value" : 12 }, "1_6" : { "value" : 78 } };
                        fcnnVisualisationService.updateLabels(newvals);
                        newvals = { "4_0" : { "value" : 0.6 }, "4_1" : { "value" : 0.4 } };
                        fcnnVisualisationService.updateLabels(newvals);
                        newvals = { "2_0" : { "weight" : 1.3, "bias" : 10 }, "2_1" : { "weight" : 10.4, "bias" : 200 } };
                        fcnnVisualisationService.updateLabels(newvals);
                        newvals = { "2_0" : { "value" : 8888 }, "2_3" : { "value" : 7777 } };
                        fcnnVisualisationService.updateLabels(newvals);
                        fcnnVisualisationService.updateInputText("Bacon ipsum dolor amet pork chop venison fatback corned beef shoulder boudin swine kevin capicola. Pastrami ground round ribeye, ball tip tri-tip biltong tongue. Tail turkey t-bone venison frankfurter. ");
                    }, 0);
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

        function initializeVisualisation(svgdata) {
            loggerService.debug('[ml4kdesc] initializing visualization');
            $timeout(function () {
                // prepare somewhere to put the decision tree graphic
                var svgcontainer = document.createElement("div");
                svgcontainer.id = 'mlforkidsmodelvizimg';
                svgcontainer.innerHTML = svgdata;

                // find where we need to add the visualization in the component
                var svghost = document.getElementById('mlforkidsmodelvizimghost');
                svghost.appendChild(svgcontainer);

                // modify the visualization to add some custom styles needed for highlighting
                var svgroot = svgcontainer.getElementsByTagName('svg')[0];
                svgroot.removeAttribute('width');
                svgroot.removeAttribute('height');
                var styleElement = document.createElement("style");
                styleElement.textContent = ".nothighlighted { opacity: 0.25; } .highlighted { opacity: 1; } .highlighted.node path { stroke-width: 3; }";
                svgroot.insertBefore(styleElement, svgroot.firstChild);
            }, 0);
        }



        //-------------------------------------------------------------------------------
        // Moving the decision tree graphic around
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

    }
}());
