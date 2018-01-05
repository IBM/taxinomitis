(function () {

        angular
            .module('app')
            .controller('SignupController', SignupController);

        SignupController.$inject = [
            'authService',
            'usersService',
            '$document', '$timeout'
        ];

        function SignupController(authService, usersService, $document, $timeout) {
            var vm = this;
            vm.authService = authService;

            vm.focused = '';

            var alertId = 1;
            vm.errors = [];
            vm.infos = [];
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
                scrollToNewItem(type + newId);
            }
            function scrollToNewItem(itemId) {
                $timeout(function () {
                    var newItem = document.getElementById(itemId);
                    $document.duScrollToElementAnimated(angular.element(newItem));
                }, 0);
            }

            vm.creating = false;
            vm.complete = false;

            vm.confirm = function (newClassDetails) {
                vm.creating = true;

                usersService.createTeacher(newClassDetails.username, newClassDetails.email, newClassDetails.intendeduse)
                    .then(function (resp) {
                        console.log(resp);

                        var newId = alertId++;
                        vm.infos.push({
                            alertid : newId,
                            password : resp.password
                        });
                        scrollToNewItem('infos' + newId);

                        vm.complete = true;
                    })
                    .catch(function (err) {
                        vm.creating = false;
                        displayAlert('errors', 500, err.data);
                    });
            };
        }

    }());
