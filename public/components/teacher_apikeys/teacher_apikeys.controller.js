(function () {

    angular
        .module('app')
        .controller('TeacherApiKeysController', TeacherApiKeysController);

    TeacherApiKeysController.$inject = [
        'authService',
        'usersService',
        '$stateParams', '$mdDialog', '$document', '$timeout'
    ];

    function TeacherApiKeysController(authService, usersService, $stateParams, $mdDialog, $document, $timeout) {

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
            var creds = vm.credentials[type];

            var mlmodels = 0;
            for (var i = 0; i < creds.length; i++) {
                var cred = creds[i];
                if (cred.credstype === 'conv_lite') {
                    mlmodels += 5;
                }
                else if (cred.credstype === 'conv_standard') {
                    mlmodels += 20;
                }
                else if (cred.credstype === 'visrec_lite') {
                    mlmodels += 2;
                }
                else if (cred.credstype === 'visrec_standard') {
                    mlmodels = vm.CONSTANTS.UNLIMITED;
                    break;
                }
                else {
                    mlmodels = vm.CONSTANTS.UNKNOWN;
                    break;
                }
            }
            vm.credentials.totals[type] = mlmodels;
        }

        function getCredentials(profile, type) {
            usersService.getCredentials(profile, type)
                .then(function (creds) {
                    vm.credentials[type] = creds;
                    vm.credentials.loading[type] = false;

                    computeLimit(type);
                })
                .catch(function (err) {
                    vm.credentials.failed[type] = true;
                    vm.credentials.loading[type] = false;
                    displayAlert('errors', err.status, err.data);
                });
        }


        function getAllCredentials(profile) {
            vm.credentials = {
                loading : {
                    visrec : true,
                    conv : true
                },
                failed : {
                    visrec : false,
                    conv : false
                },
                totals : {
                    visrec : vm.CONSTANTS.UNKNOWN,
                    conv : vm.CONSTANTS.UNKNOWN
                }
            };
            getCredentials(profile, 'visrec');
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


        vm.deleteCredentials = function (ev, creds, type) {
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
                            vm.credentials[type] = vm.credentials[type].filter(function (itm) {
                                return itm.id !== creds.id;
                            });
                            computeLimit(type);
                        })
                        .catch(function (err) {
                            displayAlert('errors', err.status, err.data);
                        });

                },
                function() {
                    // cancelled. do nothing
                });
        };


        vm.addCredentials = function (ev, type) {
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
                templateUrl : 'static/components-' + $stateParams.VERSION + '/teacher_apikeys/newcreds' + type + '.tmpl.html',
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

                    usersService.addCredentials(credentialsToAdd, vm.profile.tenant)
                        .then(function (newcreds) {
                            vm.credentials[type] = vm.credentials[type].filter(function (c) {
                                return c.uniq !== placeholder;
                            });

                            vm.credentials[type].push(newcreds);
                            computeLimit(type);
                        })
                        .catch(function (err) {
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
                templateUrl : 'static/components-' + $stateParams.VERSION + '/teacher_apikeys/modifycreds' + type + '.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function(modifyRequest) {
                    usersService.modifyCredentials(creds, type, modifyRequest.credstype, vm.profile.tenant)
                        .then(function () {
                            creds.credstype = modifyRequest.credstype;
                            computeLimit(type);
                        })
                        .catch(function (err) {
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
            $mdDialog.show(alert)
        };


        function scrollToNewItem(itemId) {
            $timeout(function () {
                var newItem = document.getElementById(itemId);
                $document.duScrollToElementAnimated(angular.element(newItem));
            }, 0);
        }
    }
}());
