(function () {

    angular
        .module('app')
        .controller('AppInventorController', AppInventorController);

    AppInventorController.$inject = [
        'authService', 'projectsService', 'scratchkeysService',
        '$stateParams', '$scope'
    ];

    function AppInventorController(authService, projectsService, scratchkeysService, $stateParams, $scope) {

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

                return scratchkeysService.getScratchKeys($stateParams.projectId, $stateParams.userId, vm.profile.tenant);
            })
            .then(function (resp) {
                if (resp) {
                    $scope.scratchkey = resp[0];
                    $scope.appinventorurl = window.location.origin +
                                            '/api/appinventor/' +
                                            $scope.scratchkey.id +
                                            '/extension';
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
