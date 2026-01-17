(function () {

    angular
        .module('app')
        .controller('RegressionDescribeController', RegressionDescribeController);

    RegressionDescribeController.$inject = [
        'authService', 'loggerService', 'browserStorageService', 'projectsService', 'fcnnVisualisationService', 'utilService',
        '$stateParams', '$scope', '$timeout', '$document'
    ];

    function RegressionDescribeController(authService, loggerService, browserStorageService, projectsService, fcnnVisualisationService, utilService, $stateParams, $scope, $timeout, $document) {
        var vm = this;
        vm.authService = authService;

        $scope.loading = true;
        $scope.projectId = $stateParams.projectId;
        $scope.userId = $stateParams.userId;
        $scope.modelId = $stateParams.modelId;

        $scope.trainingHistory = undefined;
        $scope.chartData = undefined;

        var alertId = 1;
        vm.errors = [];
        vm.warnings = [];

        vm.dismissAlert = function (type, errIdx) {
            vm[type].splice(errIdx, 1);
        };

        function displayAlert(type, status, errObj) {
            loggerService.error(errObj);

            if (!errObj) {
                errObj = {};
            }

            var newId = alertId++;
            var newAlert = {
                code: errObj.code,
                alertid: newId,
                message: errObj.message || errObj.error || 'Unknown error',
                status: status
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


        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;
                return projectsService.getProject($scope.projectId, $scope.userId, vm.profile.tenant);
            })
            .then(function (project) {
                $scope.project = project;
                return browserStorageService.retrieveAsset($scope.projectId + '-history');
            })
            .then(function (history) {
                $scope.trainingHistory = history;
                $scope.chartData = {
                    epochs: history.epochs,
                    training: history.trainingLoss,
                    validation: history.validationLoss
                };

                return utilService.loadScript('/static/bower_components/d3/d3.min.js');
            })
            .then(function () {
                $timeout(function () {
                    const HIDDEN_LAYER_UNITS = 15;

                    const inputs = $scope.project.columns.filter((c) => { return c.output === false; });
                    const outputs = $scope.project.columns.filter((c) => { return c.output; });

                    fcnnVisualisationService.init('mlforkidsmodelvizimg');
                    fcnnVisualisationService.create(
                        [
                            inputs.length,
                            HIDDEN_LAYER_UNITS,
                            HIDDEN_LAYER_UNITS,
                            outputs.length,
                        ],
                        [ 5, 5, 5, 5 ]
                    );

                    fcnnVisualisationService.updateNodeLabels(0,
                        inputs.map((c) => { return c.label; })
                    );
                    fcnnVisualisationService.updateNodeLabels(1, Array(HIDDEN_LAYER_UNITS).fill('sigmoid'));
                    fcnnVisualisationService.updateNodeLabels(2, Array(HIDDEN_LAYER_UNITS).fill('sigmoid'));
                    fcnnVisualisationService.updateNodeLabels(3,
                        outputs.map((c) => { return c.label; })
                    );
                }, 0);


                $scope.loading = false;
                loggerService.debug('[ml4kregress] training history loaded', history);
            })
            .catch(function (err) {
                var errId = displayAlert('errors', err.status, err.data || err);
                scrollToNewItem('errors' + errId);
                $scope.loading = false;
            });
    }
})();

