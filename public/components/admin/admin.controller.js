(function () {

    angular
       .module('app')
       .controller('AdminController', AdminController);

    AdminController.$inject = [
        'authService', 'sitealertsService', '$scope'
    ];

    function AdminController(authService, sitealertsService, $scope) {

        function logError(err) {
            console.log(err);
        }

        var vm = this;
        vm.authService = authService;

        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                $scope.expiry = 1;
                $scope.url = 'https://cloud.ibm.com/status?query=EVENTID&selected=status';
            })
            .catch(logError);

        vm.confirm = function (newAlert) {
            newAlert.expiry = parseFloat(newAlert.expiry) * 3600000;
            sitealertsService.createAlert(newAlert)
                .then(function () {
                    alert('done');
                })
                .catch(logError);
        };

        vm.refresh = function () {
            sitealertsService.refreshServer().catch(logError);
        };
    }
}());
