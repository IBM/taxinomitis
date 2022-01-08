    (function () {

        angular
            .module('app')
            .controller('PythonLocalController', PythonLocalController);

        PythonLocalController.$inject = [
            'authService', 'projectsService', 'scratchkeysService',
            '$stateParams', '$scope'
        ];

        function PythonLocalController(authService, projectsService, scratchkeysService, $stateParams, $scope) {

            var vm = this;
            vm.authService = authService;

            $scope.projectId = $stateParams.projectId;
            $scope.userId = $stateParams.userId;

            $scope.functionType = 'classify';

            $scope.testdata = {
                text      : 'The text that you want to test',
                storetext : 'The text that you want to store',
                imagefile : 'my-test-image.jpg',
                imageurl  : 'https://www.site-on-the-internet.com/image.jpg',
                fields    : [],
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
                    $scope.project = project;
                    if (project.labels && project.labels.length > 0) {
                        $scope.testdata.label = project.labels[0];
                    }

                    if (project.type === 'numbers') {
                        return projectsService.getFields($scope.projectId, $scope.userId, vm.profile.tenant);
                    }
                    else {
                        return;
                    }
                })
                .then(function (fields) {
                    $scope.fields = fields;

                    return scratchkeysService.getScratchKeys($scope.project.id, $scope.userId, vm.profile.tenant);
                })
                .then(function (resp) {
                    if (resp) {
                        $scope.scratchkey = resp[0];

                        if (!$scope.scratchkey.model && $scope.project.type === 'text') {
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
