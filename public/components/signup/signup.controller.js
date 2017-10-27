(function () {

        angular
            .module('app')
            .controller('SignupController', SignupController);

        SignupController.$inject = [
            'authService'
        ];

        function SignupController(authService) {
            var vm = this;
            vm.authService = authService;



        }

    }());
