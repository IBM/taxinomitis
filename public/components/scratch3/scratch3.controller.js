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

            var alertId = 1;
            vm.errors = [];
            vm.warnings = [];
            vm.dismissAlert = function (type, errIdx) {
                vm[type].splice(errIdx, 1);
            };
            function displayAlert(type, errObj) {
                if (!errObj) {
                    errObj = {};
                }
                vm[type].push({ alertid : alertId++, message : errObj.message || errObj.error || 'Unknown error', status : errObj.status });
            }

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
                    displayAlert('errors', err.data);
                });
        }
    }());
