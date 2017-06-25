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

        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                return projectsService.getProject($scope.projectId, profile.user_id, profile.tenant);
            })
            .then(function (project) {
                $scope.project = project;
            });
    }
}());
