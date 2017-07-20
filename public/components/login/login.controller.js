(function () {

    angular
        .module('app')
        .controller('LoginController', LoginController);

    LoginController.$inject = [
        '$location',
        '$stateParams',
        'authService',
        '$mdDialog'
    ];

    function LoginController($location, $stateParams, authService, $mdDialog) {
        var vm = this;
        vm.authService = authService;

        vm.selectedTab = 'login';

        var alertId = 1;
        vm.errors = [];
        vm.infos = [];
        vm.dismissAlert = function (type, errIdx) {
            vm[type].splice(errIdx, 1);
        };
        function displayAlert(type, message) {
            vm[type].push({
                alertid : alertId++,
                message : message
            });
        }


        vm.reset = function (ev) {
            $mdDialog.show({
                controller : function ($scope, $mdDialog) {
                    $scope.hide = function () {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function () {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function (resp) {
                        $mdDialog.hide(resp);
                    };
                },
                templateUrl : 'static/components-' + $stateParams.VERSION + '/login/resetpassword.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (email) {
                    authService.reset(email, function (err, resp) {
                        if (err) {
                            return displayAlert('errors', err.description);
                        }
                        return displayAlert('infos', resp);
                    });
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };
    }

}());
