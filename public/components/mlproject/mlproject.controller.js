(function () {

    angular
        .module('app')
        .controller('ProjectController', ProjectController);

    ProjectController.$inject = [ 'authService', '$stateParams' ];

    function ProjectController(authService, $stateParams) {
        var vm = this;
        vm.authService = authService;

        $scope.projectId = $stateParams.projectId;

        authService.getProfileDeferred().then(function (profile) {
            vm.profile = profile;
        });
    }
}());
