(function () {

    angular
        .module('app')
        .controller('ModelsController', ModelsController);

    ModelsController.$inject = ['authService'];

    function ModelsController(authService) {

        var vm = this;
        vm.authService = authService;

        authService.getProfileDeferred().then(function (profile) {


        });
    }

}());
