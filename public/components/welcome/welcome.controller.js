(function () {
    angular
        .module('app')
        .controller('WelcomeController', WelcomeController);

    WelcomeController.$inject = [
        'authService'
    ];

    function WelcomeController(authService) {
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


        vm.authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;
            })
            .catch(function (err) {
                displayAlert('errors', err.data);
            });
    }
}());
