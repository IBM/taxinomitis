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

            $scope.projectId = $stateParams.projectId;
            $scope.userId = $stateParams.userId;

            $scope.testsource = 'local';
            $scope.testdata = {
                text      : 'The text that you want to test',
                imagefile : 'my-test-image.jpg',
                imageurl  : 'https://www.site-on-the-internet.com/image.jpg',
                fields : []
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
