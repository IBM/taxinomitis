(function () {

    angular
        .module('app')
        .controller('ImageDescribeController', ImageDescribeController);

    ImageDescribeController.$inject = [
        'authService', 'loggerService', 'browserStorageService', 'projectsService',
        '$stateParams', '$scope'
    ];

    function ImageDescribeController(authService, loggerService, browserStorageService, projectsService, $stateParams, $scope) {
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
                    training: history.trainingLoss
                };

                $scope.loading = false;
                loggerService.debug('[ml4kimages] training history loaded', history);
            })
            .catch(function (err) {
                var errId;
                if (err && err.status === 404 && $scope.project) {
                    errId = displayAlert('warnings', 400, {
                        message : 'Model information is not available. Try training a new model.'
                    });
                }
                else {
                    errId = displayAlert('errors', err.status, err.data || err);
                }
                $scope.loading = false;
            });
    }
})();
