(function () {

    angular
        .module('app')
        .controller('TeacherApiKeysController', TeacherApiKeysController);

    TeacherApiKeysController.$inject = [
        'authService',
        'usersService',
        '$mdDialog', '$document', '$timeout', 'loggerService'
    ];

    function TeacherApiKeysController(authService, usersService, $mdDialog, $document, $timeout, loggerService) {

        var vm = this;
        vm.authService = authService;

        vm.CONSTANTS = {
            UNKNOWN : -1,
            UNLIMITED : -2
        };

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


        function computeLimit(type) {
            loggerService.debug('[ml4kapi] computing limit for ' + type);
            var creds = vm.credentials[type];

            var mlmodels = 0;
            for (var i = 0; i < creds.length; i++) {
                var cred = creds[i];
                if (cred.credstype === 'conv_lite' || cred.credstype === 'conv_plustrial') {
                    mlmodels += 5;
                }
                else if (cred.credstype === 'conv_standard') {
                    mlmodels += 20;
                }
                else if (cred.credstype === 'conv_plus') {
                    mlmodels += 50;
                }
                else {
                    mlmodels = vm.CONSTANTS.UNKNOWN;
                    break;
                }
            }
            vm.credentials.totals[type] = mlmodels;
        }

        function getCredentials(profile, type) {
            loggerService.debug('[ml4kapi] retrieving IBM credentials (' + type + ')');
            usersService.getCredentials(profile, type)
                .then(function (creds) {
                    loggerService.debug('[ml4kapi] got IBM credentials (' + type + ')');

                    vm.credentials[type] = creds;
                    vm.credentials.loading[type] = false;

                    computeLimit(type);
                })
                .catch(function (err) {
                    loggerService.error('[ml4kapi] failed to get credentials (' + type + ')', err);

                    vm.credentials.failed[type] = true;
                    vm.credentials.loading[type] = false;
                    displayAlert('errors', err.status, err.data);
                });
        }


        function getAllCredentials(profile) {
            vm.credentials = {
                loading : {
                    conv : true
                },
                failed : {
                    conv : false
                },
                totals : {
                    conv : vm.CONSTANTS.UNKNOWN
                }
            };
            getCredentials(profile, 'conv');
        }



        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                if (profile.role === 'supervisor') {

                    usersService.getClassPolicy(profile)
                        .then(function (policy) {
                            vm.policy = policy;

                            if (vm.policy.isManaged === false) {
                                getAllCredentials(profile);
                            }
                        })
                        .catch(function (err) {
                            displayAlert('errors', err.status, err.data);
                        });
                }
            })
            .catch(function (err) {
                displayAlert('errors', err.status, err.data);
            });


        vm.verifyCredentials = function (ev, creds) {
            loggerService.debug('[ml4kapi] verifying IBM credentials');
            creds.verifying = true;

            usersService.verifyCredentials(vm.profile, creds)
                .then(function () {
                    loggerService.debug('[ml4kapi] verified');
                    creds.verified = true;
                    creds.verifying = false;
                })
                .catch(function (err) {
                    loggerService.error('[ml4kapi] check failed', err);

                    creds.verified = false;
                    creds.verifying = false;

                    var errMessage = '';
                    if (err && err.data && err.data.error) {
                        errMessage = err.data.error;
                    }

                    var details = $mdDialog.alert()
                            .title('IBM Watson rejected your API key')
                            .htmlContent('<div class="confirmdialogsmall">' +
                                creds.apikey + ' was rejected by IBM. ' +
                                (errMessage ? '<div>The response was : ' + errMessage + '</div>' : '') +
                                '</div>')
                            .ok('OK');
                    $mdDialog.show(details);
                });
        };

        vm.deleteCredentials = function (ev, creds, type) {
            loggerService.debug('[ml4kapi] deleting IBM credentials');

            var confirm = $mdDialog.confirm()
                .title('Are you sure?')
                .textContent('Do you want to remove these credentials from machinelearningforkids.co.uk?')
                .ariaLabel('Confirm')
                .targetEvent(ev)
                .ok('Yes')
                .cancel('No');

            $mdDialog.show(confirm).then(
                function() {
                    usersService.deleteCredentials(vm.profile, creds)
                        .then(function () {
                            loggerService.debug('[ml4kapi] deleted');

                            vm.credentials[type] = vm.credentials[type].filter(function (itm) {
                                return itm.id !== creds.id;
                            });
                            computeLimit(type);
                        })
                        .catch(function (err) {
                            loggerService.error('[ml4kapi] failed to delete', err);

                            displayAlert('errors', err.status, err.data);
                        });

                },
                function() {
                    // cancelled. do nothing
                });
        };


        vm.addCredentials = function (ev, type) {
            loggerService.debug('[ml4kapi] adding new IBM credentials');

            $mdDialog.show({
                controller : function ($scope, $mdDialog) {
                    $scope.type = 'apikey';
                    $scope.credstype = '';

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
                templateUrl : 'static/components/teacher_apikeys/newcreds' + type + '.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function(credentialsToAdd) {
                    credentialsToAdd.servicetype = type;
                    credentialsToAdd.isPlaceholder = true;

                    var placeholder = Date.now();
                    credentialsToAdd.uniq = placeholder;

                    vm.credentials[type].push(credentialsToAdd);

                    loggerService.debug('[ml4kapi] storing IBM credentials');

                    usersService.addCredentials(credentialsToAdd, vm.profile.tenant)
                        .then(function (newcreds) {
                            loggerService.debug('[ml4kapi] stored');

                            vm.credentials[type] = vm.credentials[type].filter(function (c) {
                                return c.uniq !== placeholder;
                            });

                            vm.credentials[type].push(newcreds);
                            computeLimit(type);
                        })
                        .catch(function (err) {
                            loggerService.error('[ml4kapi] failed to store', err);

                            var errId = displayAlert('errors', err.status, err.data);
                            scrollToNewItem('errors' + errId);

                            vm.credentials[type] = vm.credentials[type].filter(function (c) {
                                return c.uniq !== placeholder;
                            });
                        });
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };

        vm.modifyCredentials = function (ev, creds, type) {
            loggerService.debug('[ml4kapi] modifying IBM credentials');

            $mdDialog.show({
                controller : function ($scope, $mdDialog) {
                    $scope.credstype = creds.credstype;
                    $scope.currentcredstype = creds.credstype;

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
                templateUrl : 'static/components/teacher_apikeys/modifycreds' + type + '.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function(modifyRequest) {
                    loggerService.debug('[ml4kapi] updating IBM credentials');

                    usersService.modifyCredentials(creds, type, modifyRequest.credstype, vm.profile.tenant)
                        .then(function () {
                            loggerService.debug('[ml4kapi] updated');

                            creds.credstype = modifyRequest.credstype;
                            computeLimit(type);
                        })
                        .catch(function (err) {
                            loggerService.error('[ml4kapi] failed to update', err);

                            var errId = displayAlert('errors', err.status, err.data);
                            scrollToNewItem('errors' + errId);
                        });
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };


        vm.explainLimit = function () {
            var alert = $mdDialog.alert()
                            .title('Limit on the number of machine learning models')
                            .textContent('When a student in your class clicks on the "Train machine learning model" ' +
                                         'button, the model that they create will count towards this limit. If this limit ' +
                                         'is exceeded, they will see an error saying that the class has already created ' +
                                         'their maximum allowed number of models. See the "Help" page for suggestions for ' +
                                         'how to avoid this')
                            .ok('OK');
            $mdDialog.show(alert);
        };


        function scrollToNewItem(itemId) {
            $timeout(function () {
                var newItem = document.getElementById(itemId);
                $document.duScrollToElementAnimated(angular.element(newItem));
            }, 0);
        }
    }
}());
