    (function () {

        angular
            .module('app')
            .controller('PythonController', PythonController);

        PythonController.$inject = [
            'authService', 'projectsService', 'scratchkeysService',
            '$stateParams', '$scope'
        ];

        function PythonController(authService, projectsService, scratchkeysService, $stateParams, $scope) {

            var vm = this;
            vm.authService = authService;

            var alertId = 1;
            vm.errors = [];
            vm.warnings = [];
            vm.dismissAlert = function (type, errIdx) {
                vm[type].splice(errIdx, 1);
            };
            function displayAlert(type, errObj) {
                if (!errObj) {
                    errObj = {};
                }
                vm[type].push({ alertid : alertId++, message : errObj.message || errObj.error || 'Unknown error', status : errObj.status });
            }

            $scope.projectId = $stateParams.projectId;
            $scope.userId = $stateParams.userId;

            $scope.testsource = 'local';
            $scope.testdata = {
                text      : 'The text that you want to test',
                imagefile : 'my-test-image.jpg',
                imageurl  : 'https://www.site-on-the-internet.com/image.jpg'
            };

            $scope.setSource = function (source) {
                $scope.testsource = source;
            };

            authService.getProfileDeferred()
                .then(function (profile) {
                    vm.profile = profile;

                    return projectsService.getProject($scope.projectId, $scope.userId, profile.tenant);
                })
                .then(function (project) {
                    $scope.project = project;

                    if (project.type !== 'numbers') {
                        return scratchkeysService.getScratchKeys(project.id, $scope.userId, vm.profile.tenant);
                    }
                })
                .then(function (resp) {
                    if (resp) {
                        $scope.scratchkey = resp[0];
                    }
                })
                .catch(function (err) {
                    displayAlert('errors', err.data);
                });
        }
    }());
