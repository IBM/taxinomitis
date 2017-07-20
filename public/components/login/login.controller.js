(function () {

    angular
        .module('app')
        .controller('LoginController', LoginController);

    LoginController.$inject = [
        'authService'
    ];

    function LoginController(authService) {
        var vm = this;
        vm.authService = authService;

        vm.selectedTab = 'login';
    }

}());
