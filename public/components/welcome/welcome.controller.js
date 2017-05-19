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

        vm.authService.getProfileDeferred().then(function (profile) {
            vm.profile = profile;
        });
    }
}());
