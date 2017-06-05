(function () {

    angular
        .module('app')
        .controller('ScratchController', ScratchController);

    ScratchController.$inject = [
        'authService',
        'projectsService', 'scratchkeysService',
        '$stateParams',
        '$scope', '$window'
    ];

    function ScratchController(authService, projectsService, scratchkeysService, $stateParams, $scope, $window) {

        var vm = this;
        vm.authService = authService;

        $scope.projectId = $stateParams.projectId;

        authService.getProfileDeferred().then(function (profile) {
            vm.profile = profile;

            projectsService.getProject($scope.projectId, profile.user_id, profile.tenant)
                .then(function (project) {
                    $scope.project = project;
                });
        });


        vm.getScratchKey = function (ev, project) {
            scratchkeysService.getScratchKeys(project.id, vm.profile.user_id, vm.profile.tenant)
                .then(function (resp) {
                    var scratchkey = resp[0];

                    scratchkey.url = '/scratchx?url=' +
                                     window.location.origin +
                                     '/api/scratch/' +
                                     scratchkey.id +
                                     '/extension.js' +
                                     '#scratch';

                    $window.open(scratchkey.url, '_blank');

                    $scope.scratchkey = scratchkey;
                });
        };
    }

}());
