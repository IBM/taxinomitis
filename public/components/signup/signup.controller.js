(function () {

        angular
            .module('app')
            .controller('SignupController', SignupController);

        SignupController.$inject = [
            'authService',
            'usersService',
            '$document', '$timeout', '$log'
        ];

        function SignupController(authService, usersService, $document, $timeout, $log) {
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

                $log.debug('[ml4ksignup] Creating new class');
                $log.debug(newClassDetails);

                usersService.createTeacher(newClassDetails.username, newClassDetails.email, newClassDetails.intendeduse)
                    .then(function (resp) {
                        $log.debug('[ml4ksignup] Created class');
                        $log.debug(resp);

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

                        $log.error('[ml4ksignup] Failed to create class');
                        $log.error(err);

                        displayAlert('errors', 500, err.data);
                    });
            };
        }

    }());
