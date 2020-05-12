(function () {

    angular
       .module('app')
       .controller('AdminController', AdminController);

    AdminController.$inject = [
        'authService', 'sitealertsService', '$scope', '$log'
    ];

    function AdminController(authService, sitealertsService, $scope, $log) {

        var vm = this;
        vm.authService = authService;

        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                $scope.expiry = 1;
                $scope.url = 'https://cloud.ibm.com/status?query=EVENTID&selected=status';
            })
            .catch($log.error);

        vm.confirm = function (newAlert) {
            newAlert.expiry = parseFloat(newAlert.expiry) * 3600000;
            sitealertsService.createAlert(newAlert)
                .then(function () {
                    alert('done');
                })
                .catch($log.error);
        };

        vm.refresh = function () {
            sitealertsService.refreshServer().catch($log.error);
        };
    }
}());
