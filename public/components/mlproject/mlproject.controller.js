(function () {

    angular
        .module('app')
        .controller('ProjectController', ProjectController);

    ProjectController.$inject = [
        'authService', 'projectsService',
        '$mdDialog',
        '$stateParams', '$scope'
    ];

    function ProjectController(authService, projectsService, $mdDialog, $stateParams, $scope) {
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

        vm.appInventor = function (ev) {
            $mdDialog.show($mdDialog.alert()
                            .title('App Inventor support')
                            .htmlContent('Would you be interested in machine learning projects using App Inventor? <br/><br/>' +
                                         'It is just an idea at this point, but if you think it is something I should be working on, please <a href="https://github.com/IBM/taxinomitis/issues/46">let me know</a>')
                            .targetEvent(ev)
                            .ok('Close'));
        };
    }
}());
