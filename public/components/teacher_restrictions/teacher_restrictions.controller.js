(function () {

    angular
        .module('app')
        .controller('TeacherRestrictionsController', TeacherRestrictionsController);

    TeacherRestrictionsController.$inject = [
        'authService',
        'usersService',
        '$document', '$timeout'
    ];

    function TeacherRestrictionsController(authService, usersService, $document, $timeout) {

        var vm = this;
        vm.authService = authService;

        var placeholderId = 1;

        var alertId = 1;
        vm.errors = [];
        vm.warnings = [];
        vm.dismissAlert = function (type, errIdx) {
            vm[type].splice(errIdx, 1);
        };
        function displayAlert(type, status, errObj) {
            if (!errObj) {
                errObj = {};
            }
            var newId = alertId++;
            vm[type].push({
                alertid : newId,
                message : errObj.message || errObj.error || 'Unknown error',
                status : status
            });
            return newId;
        }


        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                if (profile.role === 'supervisor') {

                    usersService.getClassPolicy(profile)
                        .then(function (policy) {
                            vm.policy = policy;
                        })
                        .catch(function (err) {
                            displayAlert('errors', err.status, err.data);
                        });
                }
            })
            .catch(function (err) {
                displayAlert('errors', err.status, err.data);
            });


        function scrollToNewItem(itemId) {
            $timeout(function () {
                var newItem = document.getElementById(itemId);
                $document.duScrollToElementAnimated(angular.element(newItem));
            }, 0);
        }
    }
}());
