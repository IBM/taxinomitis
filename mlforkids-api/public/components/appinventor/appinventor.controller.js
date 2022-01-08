(function () {

    angular
        .module('app')
        .controller('AppInventorController', AppInventorController);

    AppInventorController.$inject = [
        'authService', 'projectsService', 'scratchkeysService', 'loggerService',
        '$stateParams', '$scope'
    ];

    function AppInventorController(authService, projectsService, scratchkeysService, loggerService, $stateParams, $scope) {

        var vm = this;
        vm.authService = authService;

        $scope.projectId = $stateParams.projectId;
        $scope.userId = $stateParams.userId;

        $scope.projecturls = {
            appinventor : 'http://ai2.appinventor.mit.edu/',
            train : '/#!/mlproject/' + $stateParams.userId + '/' + $stateParams.projectId + '/training',
            learnandtest : '/#!/mlproject/' + $stateParams.userId + '/' + $stateParams.projectId + '/models'
        };

        loggerService.debug('[ml4kappinv] Generated App Inventor urls', $scope.projecturls);

        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                loggerService.debug('[ml4kappinv] Getting project info');
                return projectsService.getProject($scope.projectId, $scope.userId, profile.tenant);
            })
            .then(function (project) {
                loggerService.debug('[ml4kappinv] project', project);

                $scope.project = project;

                $scope.projecturls.train = '/#!/mlproject/' + $scope.project.userid + '/' + $scope.project.id + '/training';
                $scope.projecturls.learnandtest = '/#!/mlproject/' + $scope.project.userid + '/' + $scope.project.id + '/models';

                loggerService.debug('[ml4kappinv] Getting Scratch API keys');

                return scratchkeysService.getScratchKeys($stateParams.projectId, $stateParams.userId, vm.profile.tenant);
            })
            .then(function (resp) {
                loggerService.debug('[ml4kappinv] scratchkey', resp);

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
