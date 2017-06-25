(function () {

    angular
        .module('app')
        .controller('ScratchController', ScratchController);

    ScratchController.$inject = [
        'authService',
        'projectsService', 'scratchkeysService',
        '$stateParams',
        '$scope', '$window', '$timeout'
    ];

    function ScratchController(authService, projectsService, scratchkeysService, $stateParams, $scope, $window, $timeout) {

        var vm = this;
        vm.authService = authService;

        var alertId = 1;
        vm.errors = [];
        vm.warnings = [];
        vm.dismissAlert = function (type, errIdx) {
            vm[type].splice(errIdx, 1);
        };
        function displayAlert(type, errObj) {
            vm[type].push({ alertid : alertId++, message : errObj.message || errObj.error || 'Unknown error' });
        }


        $scope.projectId = $stateParams.projectId;

        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                return projectsService.getProject($scope.projectId, profile.user_id, profile.tenant);
            })
            .then(function (project) {
                $scope.project = project;

                $timeout(function () {
                    scratchblocks.renderMatching('.scratchblocks');
                }, 50);
            })
            .catch(function (err) {
                displayAlert('errors', err.data);
            });


        vm.getScratchKey = function (ev, project) {
            scratchkeysService.getScratchKeys(project.id, vm.profile.user_id, vm.profile.tenant)
                .then(function (resp) {
                    var scratchkey = resp[0];

                    scratchkey.extensionurl = window.location.origin +
                                              '/api/scratch/' +
                                              scratchkey.id +
                                              '/extension.js'

                    scratchkey.url = '/scratchx?url=' +
                                     scratchkey.extensionurl +
                                     '#scratch';

                    if (scratchkey.model) {
                        $window.open(scratchkey.url, '_blank');
                    }

                    $scope.scratchkey = scratchkey;
                })
                .catch(function (err) {
                    displayAlert('errors', err.data);
                });

        };
    }

}());
