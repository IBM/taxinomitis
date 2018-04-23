(function () {

    angular
        .module('app')
        .controller('SessionUsersController', SessionUsersController);

    SessionUsersController.$inject = [
        'authService',
        '$stateParams', '$document', '$scope', '$timeout', '$state'
    ];

    function SessionUsersController(authService, $stateParams, $document, $scope, $timeout, $state) {

        var vm = this;
        vm.authService = authService;

        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;
            })
            .catch(function (err) {
                displayAlert('errors', err.status, err.data);
            });

        function getErrorMessage (errObj) {
            if (errObj.error) {
                if (errObj.error === 'Class full') {
                    return 'There are too many people currently using this feature. Sorry, but I\'m limiting numbers for now. Please try later - or create yourself an account and log on now!';
                }
                else {
                    return errObj.error;
                }
            }
            if (errObj.message) {
                return errObj.message;
            }
            return 'Unknown error';
        }


        vm.startSession = function (ev) {
            $scope.failure = null;

            authService.createSessionUser()
                .then(function (newUser) {
                    $timeout(function () {
                        $state.go('projects');
                    });
                })
                .catch(function (err) {
                    var errObj = err.data;


                    $scope.failure = {
                        message : getErrorMessage(errObj),
                        status : err.status
                    };
                    $timeout(function () {
                        var newItem = document.getElementById('sessionuserfailure');
                        $document.duScrollToElementAnimated(angular.element(newItem));
                    }, 0);
                });
        };
    }
}());
