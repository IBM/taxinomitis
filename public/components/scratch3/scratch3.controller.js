    (function () {

        angular
            .module('app')
            .controller('Scratch3Controller', Scratch3Controller);

        Scratch3Controller.$inject = [
            'authService',
            'projectsService', 'scratchkeysService',
            '$stateParams',
            '$scope'
        ];

        function Scratch3Controller(authService, projectsService, scratchkeysService, $stateParams, $scope) {

            var vm = this;
            vm.authService = authService;

            $scope.projectId = $stateParams.projectId;
            $scope.userId = $stateParams.userId;

            $scope.projecturls = {
                train : '/#!/mlproject/' + $stateParams.userId + '/' + $stateParams.projectId + '/training',
                learnandtest : '/#!/mlproject/' + $stateParams.userId + '/' + $stateParams.projectId + '/models'
            };

            authService.getProfileDeferred()
                .then(function (profile) {
                    vm.profile = profile;

                    return projectsService.getProject($scope.projectId, $scope.userId, profile.tenant);
                })
                .then(function (project) {
                    $scope.project = project;

                    $scope.projecturls.train = '/#!/mlproject/' + $scope.project.userid + '/' + $scope.project.id + '/training';
                    $scope.projecturls.learnandtest = '/#!/mlproject/' + $scope.project.userid + '/' + $scope.project.id + '/models';

                    return scratchkeysService.getScratchKeys(project.id, $scope.userId, vm.profile.tenant);
                })
                .then(function (resp) {
                    var scratchkey = resp[0];

                    scratchkey.extensionurl = window.location.origin +
                                              '/api/scratch/' +
                                              scratchkey.id +
                                              '/extension3.js'

                    if ($scope.project.type === 'sounds') {
                        scratchkey.model = 'placeholder';
                    }

                    $scope.scratchkey = scratchkey;
                })
                .catch(function (err) {
                    $scope.failure = {
                        message : err.data.error,
                        status : err.status
                    };
                });
        }
    }());
