(function () {

        angular
            .module('app')
            .controller('SignupController', SignupController);

        SignupController.$inject = [
            'authService',
            'usersService',
            'scrollService',
            'loggerService'
        ];

        function SignupController(authService, usersService, scrollService, loggerService) {
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
                scrollService.scrollToNewItem(type + newId);
            }

            vm.creating = false;
            vm.complete = false;

            vm.confirm = function (newClassDetails) {
                vm.creating = true;

                loggerService.debug('[ml4ksignup] Creating new class', newClassDetails);

                usersService.createTeacher(newClassDetails.username, newClassDetails.email, newClassDetails.intendeduse)
                    .then(function (resp) {
                        loggerService.debug('[ml4ksignup] Created class', resp);

                        var newId = alertId++;
                        vm.infos.push({
                            alertid : newId,
                            password : resp.password
                        });
                        scrollService.scrollToNewItem('infos' + newId);

                        vm.complete = true;
                    })
                    .catch(function (err) {
                        vm.creating = false;

                        loggerService.error('[ml4ksignup] Failed to create class', err);

                        displayAlert('errors', 500, err.data);
                    });
            };
        }

    }());
