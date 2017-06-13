(function () {

    angular
        .module('app')
        .controller('LoginController', LoginController);

    LoginController.$inject = [
        '$location',
        'authService'
    ];

    function LoginController($location, authService) {
        var vm = this;
        vm.authService = authService;

        vm.selectedTab = 'login';
    }

}());
