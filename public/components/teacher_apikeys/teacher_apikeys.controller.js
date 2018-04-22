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

        function getCredentials(profile, type) {
            usersService.getCredentials(profile, type)
                .then(function (creds) {
                    vm.credentials[type] = creds;
                    vm.credentials.loading[type] = false;
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

                    usersService.addCredentials(credentialsToAdd, vm.profile.tenant)
                        .then(function (newcreds) {
                            vm.credentials[type].push(newcreds);
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


        function scrollToNewItem(itemId) {
            $timeout(function () {
                var newItem = document.getElementById(itemId);
                $document.duScrollToElementAnimated(angular.element(newItem));
            }, 0);
        }
    }
}());
