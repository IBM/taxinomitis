(function () {

    angular
        .module('app')
        .controller('ProjectController', ProjectController);

    ProjectController.$inject = [
        'authService', 'projectsService',
        '$stateParams', '$scope'
    ];

    function ProjectController(authService, projectsService, $stateParams, $scope) {
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
            })
            .catch(function (err) {
                $scope.failure = {
                    message : err.data.error,
                    status : err.status
                };
            });
    }
}());
