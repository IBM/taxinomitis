    (function () {

        angular
            .module('app')
            .controller('Scratch3Controller', Scratch3Controller);

        Scratch3Controller.$inject = [
            'authService', 'projectsService', 'scratchkeysService',
            '$stateParams', '$scope'
        ];

        function Scratch3Controller(authService, projectsService, scratchkeysService, $stateParams, $scope) {

            var vm = this;
            vm.authService = authService;

            $scope.projectId = $stateParams.projectId;
            $scope.userId = $stateParams.userId;

            authService.getProfileDeferred()
                .then(function (profile) {
                    vm.profile = profile;

                    return projectsService.getProject($scope.projectId, $scope.userId, profile.tenant);
                })
                .then(function (project) {
                    $scope.project = project;

                    if (project.type !== 'images') {
                        return scratchkeysService.getScratchKeys(project.id, $scope.userId, vm.profile.tenant);
                    }
                })
                .then(function (resp) {
                    if (resp) {
                        var scratchkey = resp[0];

                        scratchkey.extensionurl = window.location.origin +
                                                '/api/scratch/' +
                                                scratchkey.id +
                                                '/extension3.js'

                        $scope.scratchkey = scratchkey;
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
