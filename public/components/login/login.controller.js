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

        // vm.authService.getProfileDeferred().then(function (profile) {
        //     $location.path(profile.role === 'supervisor' ? '/students' : '/projects');
        // });
    }

}());
