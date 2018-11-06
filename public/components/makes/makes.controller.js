    (function () {

        angular
            .module('app')
            .controller('MakesController', MakesController);

        MakesController.$inject = [
            'authService', '$stateParams', '$scope'
        ];

        function MakesController(authService, $stateParams, $scope) {

            var vm = this;
            vm.authService = authService;

            $scope.projectId = $stateParams.projectId;
            $scope.userId = $stateParams.userId;

            authService.getProfileDeferred()
                .then(function (profile) {
                    vm.profile = profile;
                })
                .catch(function (err) {
                    $scope.failure = {
                        message : err.data.error,
                        status : err.status
                    };
                });
        }
    }());
