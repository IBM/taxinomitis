    (function () {

        angular
            .module('app')
            .controller('PythonTextController', PythonTextController);

        PythonTextController.$inject = [
            'authService', 'projectsService', 'scratchkeysService',
            '$stateParams', '$scope'
        ];

        function PythonTextController(authService, projectsService, scratchkeysService, $stateParams, $scope) {

            var vm = this;
            vm.authService = authService;

            $scope.projectId = $stateParams.projectId;
            $scope.userId = $stateParams.userId;

            $scope.functionType = 'classify';

            $scope.testdata = {
                text      : 'The text that you want to test',
                storetext : 'The text that you want to store',
                label     : 'label'
            };

            $scope.setFunctionType = function (type) {
                $scope.functionType = type;
            };

            authService.getProfileDeferred()
                .then(function (profile) {
                    vm.profile = profile;

                    return projectsService.getProject($scope.projectId, $scope.userId, profile.tenant);
                })
                .then(function (project) {
                    if (project && project.type !== 'text') {
                        throw new Error('This page is intended for text projects only');
                    }

                    $scope.project = project;
                    if (project.labels && project.labels.length > 0) {
                        $scope.testdata.label = project.labels[0];
                    }

                    return scratchkeysService.getScratchKeys($scope.project, $scope.userId, vm.profile.tenant);
                })
                .then(function (resp) {
                    if (resp && !$scope.scratchkey) {
                        $scope.scratchkey = resp[0];

                        if (!$scope.scratchkey.model) {
                            $scope.functionType = 'store';
                        }
                    }
                })
                .catch(function (err) {
                    $scope.failure = {
                        message : err.data.error,
                        status : err.status
                    };
                });
        }
    }());
