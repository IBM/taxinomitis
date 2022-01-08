(function () {

    angular
        .module('app')
        .controller('ProjectController', ProjectController);

    ProjectController.$inject = [
        'authService', 'projectsService', 'loggerService',
        '$stateParams', '$scope'
    ];

    function ProjectController(authService, projectsService, loggerService, $stateParams, $scope) {
        var vm = this;
        vm.authService = authService;

        $scope.projectId = $stateParams.projectId;
        $scope.userId = $stateParams.userId;

        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                loggerService.debug('[ml4kproj] getting project info');
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
