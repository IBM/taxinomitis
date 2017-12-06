(function () {

    angular
        .module('app')
        .controller('TeacherController', TeacherController);

    TeacherController.$inject = [
        'authService',
        'usersService',
        '$stateParams', '$mdDialog', '$document', '$timeout'
    ];

    function TeacherController(authService, usersService, $stateParams, $mdDialog, $document, $timeout) {

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
            var newId = alertId++;
            vm[type].push({
                alertid : newId,
                message : errObj.message || errObj.error || 'Unknown error',
                status : status
            });
            return newId;
        }


        function refreshStudentsList(profile) {
            usersService.getStudentList(profile)
                .then(function (students) {
                    vm.students = students;
                })
                .catch(function (err) {
                    displayAlert('errors', err.status, err.data);
                });
        }


        function displayPassword(ev, student) {
            $mdDialog.show(
                $mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title(student.username)
                    .htmlContent('Password: <span class="passworddisplaydialog">' + student.password + '</span>')
                    .ariaLabel('Confirm student password')
                    .ok('OK')
                    .targetEvent(ev)
                );
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
                    refreshStudentsList(profile);

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

        vm.deleteUser = function (ev, student) {
            var confirm = $mdDialog.confirm()
                .title('Are you sure?')
                .textContent('Do you want to delete ' + student.username + ' and all of their work? (This cannot be undone)')
                .ariaLabel('Confirm')
                .targetEvent(ev)
                .ok('Yes')
                .cancel('No');

            $mdDialog.show(confirm).then(
                function() {
                    student.isPlaceholder = true;

                    usersService.deleteStudent(student, vm.profile.tenant)
                        .then(function () {
                            vm.students = vm.students.filter(function (itm) {
                                return itm.username !== student.username;
                            });
                        })
                        .catch(function (err) {
                            student.isPlaceholder = false;
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
                templateUrl : 'static/components-' + $stateParams.VERSION + '/teacher/newcreds' + type + '.tmpl.html',
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

        vm.createUser = function (ev) {
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
                templateUrl : 'static/components-' + $stateParams.VERSION + '/teacher/newstudent.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function(username) {
                    var newUserObj = {
                        id : placeholderId++,
                        username : username,
                        isPlaceholder : true
                    };
                    vm.students.push(newUserObj);

                    usersService.createStudent(username, vm.profile.tenant)
                        .then(function (newUser) {
                            newUserObj.id = newUser.id;
                            newUserObj.isPlaceholder = false;

                            displayPassword(ev, newUser);
                        })
                        .catch(function (err) {
                            var errId = displayAlert('errors', err.status, err.data);
                            scrollToNewItem('errors' + errId);

                            vm.students = vm.students.filter(function (student) {
                                return student.id !== newUserObj.id;
                            });
                        });
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };

        vm.resetUserPassword = function (ev, student) {
            student.isPlaceholder = true;

            usersService.resetStudentPassword(student, vm.profile.tenant)
                .then(function (updatedUser) {
                    student.isPlaceholder = false;
                    displayPassword(ev, updatedUser);
                })
                .catch(function (err) {
                    student.isPlaceholder = false;
                    displayAlert('errors', err.status, err.data);
                });
        };

        vm.resetUsersPassword = function (ev, student) {
            student.isPlaceholder = true;

            usersService.resetStudentPassword(student, vm.profile.tenant)
                .then(function (updatedUser) {
                    student.isPlaceholder = false;
                    displayPassword(ev, updatedUser);
                })
                .catch(function (err) {
                    student.isPlaceholder = false;
                    displayAlert('errors', err.status, err.data);
                });
        };

        vm.resetStudentsPassword = function (ev) {
            vm.students.forEach(function (student) {
                student.isPlaceholder = true;
            });

            usersService.resetStudentsPassword(vm.students, vm.profile.tenant)
                .then(function (updatedUsers) {
                    vm.students.forEach(function (student) {
                        student.isPlaceholder = false;
                    });
                    displayPassword(ev, {
                        username : 'All students',
                        password : updatedUsers[0].password
                    });
                })
                .catch(function (err) {
                    vm.students.forEach(function (student) {
                        student.isPlaceholder = false;
                    });
                    displayAlert('errors', err.status, err.data);
                });
        };


        function scrollToNewItem(itemId) {
            $timeout(function () {
                var newItem = document.getElementById(itemId);
                $document.duScrollToElementAnimated(angular.element(newItem));
            }, 0);
        }
    }
}());
