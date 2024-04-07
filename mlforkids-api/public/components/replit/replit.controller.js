    (function () {

        angular
            .module('app')
            .controller('ReplitController', ReplitController);

        ReplitController.$inject = [
            'authService', 'projectsService', 'scratchkeysService', 'loggerService',
            '$stateParams', '$scope'
        ];

        function ReplitController(authService, projectsService, scratchkeysService, loggerService, $stateParams, $scope) {

            var vm = this;
            vm.authService = authService;

            $scope.testdata = {
                text      : 'The text that you want to test',
                storetext : 'The text that you want to store',
                label     : 'label'
            };

            $scope.projectId = $stateParams.projectId;
            $scope.userId = $stateParams.userId;

            authService.getProfileDeferred()
                .then(function (profile) {
                    vm.profile = profile;

                    loggerService.debug('[ml4kpython] getting project');
                    return projectsService.getProject($scope.projectId, $scope.userId, profile.tenant);
                })
                .then(function (project) {
                    $scope.project = project;

                    if (project && project.type !== 'text') {
                        throw new Error('This page is intended for text projects only');
                    }

                    if (project.labels && project.labels.length > 0) {
                        $scope.testdata.label = project.labels[0];
                    }

                    loggerService.debug('[ml4kpython] getting Scratch key');
                    return scratchkeysService.getScratchKeys($scope.project, $scope.userId, vm.profile.tenant);
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
