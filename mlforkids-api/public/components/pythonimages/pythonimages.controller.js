    (function () {

        angular
            .module('app')
            .controller('PythonImagesController', PythonImagesController);

        PythonImagesController.$inject = [
            'authService', 'projectsService', 'scratchkeysService',
            '$stateParams', '$scope'
        ];

        function PythonImagesController(authService, projectsService, scratchkeysService, $stateParams, $scope) {

            var vm = this;
            vm.authService = authService;

            $scope.projectId = $stateParams.projectId;
            $scope.userId = $stateParams.userId;

            $scope.testdata = {
                imagefile : 'my-test-image.jpg',
                label     : 'label'
            };

            authService.getProfileDeferred()
                .then(function (profile) {
                    vm.profile = profile;

                    return projectsService.getProject($scope.projectId, $scope.userId, profile.tenant);
                })
                .then(function (project) {
                    $scope.project = project;

                    if (project && project.type !== 'imgtfjs') {
                        throw new Error('This page is intended for image projects only');
                    }

                    if (project.labels && project.labels.length > 0) {
                        $scope.testdata.label = project.labels[0];
                    }

                    return scratchkeysService.getScratchKeys($scope.project, $scope.userId, vm.profile.tenant);
                })
                .then(function (resp) {
                    if (resp && !$scope.scratchkey) {
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
