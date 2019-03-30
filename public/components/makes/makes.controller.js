(function () {

    angular
        .module('app')
        .controller('MakesController', MakesController);

    MakesController.$inject = [
        'authService', '$stateParams', '$scope', 'projectsService'
    ];

    function MakesController(authService, $stateParams, $scope, projectsService) {

        var vm = this;
        vm.authService = authService;

        $scope.projectId = $stateParams.projectId;
        $scope.userId = $stateParams.userId;

        $scope.loading = true;

        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                return projectsService.getProject($scope.projectId, $scope.userId, profile.tenant);
            })
            .then(function (project) {
                $scope.project = project;
                $scope.loading = false;
            })
            .catch(function (err) {
                $scope.loading = false;
                $scope.failure = {
                    message : err.data.error,
                    status : err.status
                };
            });
    }
}());
