(function () {

        angular
            .module('app')
            .controller('SignupController', SignupController);

        SignupController.$inject = [
            'authService',
            'usersService',
            'scrollService',
            'loggerService',
            '$scope'
        ];

        function SignupController(authService, usersService, scrollService, loggerService, $scope) {
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

                if (!document.getElementById('turnstile-container')) {
                    displayAlert('errors', 500, {
                        message : 'Update required. Please refresh the page. If this persists, please clear your cache.'
                    });
                    return;
                }

                loggerService.debug('[ml4ksignup] Creating new class', newClassDetails);
                turnstile.render("#turnstile-container", {
                    sitekey: TURNSTILE_SITE_KEY,
                    'error-callback': function (err) {
                        loggerService.error('[ml4ksignup] Failed to get turnstile token', err);

                        $scope.turnstileerror = err;
                        vm.creating = false;
                    },
                    callback: function (token) {
                        if (!vm.complete) {
                            usersService.createTeacher(
                                newClassDetails.username,
                                newClassDetails.email,
                                newClassDetails.intendeduse,
                                token
                            )
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

                                    if (err && err.data && err.data.error && err.data.error.includes('turnstile')) {
                                        $scope.turnstileerror = err.data.error;
                                    }
                                    else {
                                        displayAlert('errors', 500, err.data);
                                    }
                                });
                        }
                    }
                });
            };
        }

    }());
