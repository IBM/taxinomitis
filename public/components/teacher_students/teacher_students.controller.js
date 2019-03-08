(function () {

    angular
        .module('app')
        .controller('TeacherStudentsController', TeacherStudentsController);

    TeacherStudentsController.$inject = [
        'authService',
        'usersService',
        '$stateParams', '$mdDialog', '$document', '$timeout'
    ];

    function TeacherStudentsController(authService, usersService, $stateParams, $mdDialog, $document, $timeout) {

        var vm = this;
        vm.authService = authService;

        vm.allStudentPasswordsReset = false;

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


        function refreshStudentsList(profile) {
            usersService.getStudentList(profile)
                .then(function (students) {
                    vm.students = students;
                })
                .catch(function (err) {
                    displayAlert('errors', err.status, err.data);
                });
        }


        function displayPassword(ev, student, showWarning) {
            $mdDialog.show(
                $mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title(student.username)
                    .htmlContent(
                        '<div>Password: <span class="passworddisplaydialog">' + student.password + '</span></div>' +
                        (showWarning ? '<div><strong>Note:</strong> This may take a few minutes to take effect. Please be patient.' : ''))
                    .ariaLabel('Confirm student password')
                    .ok('OK')
                    .targetEvent(ev)
                );
        }




        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                if (profile.role === 'supervisor') {
                    refreshStudentsList(profile);

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



        vm.createMultipleUsers = function (ev) {
            $mdDialog.show({
                controller : function ($scope, $mdDialog) {
                    $scope.remaining = vm.policy.maxUsers - vm.students.length;
                    $scope.userslimit = vm.policy.maxUsers;

                    $scope.hide = function () {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function () {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function (resp) {
                        $mdDialog.hide(resp);
                    };
                    $scope.refreshPassword = function () {
                        $scope.password = '...';
                        usersService.getGeneratedPassword(vm.profile.tenant)
                            .then(function (resp) {
                                $scope.password = resp.password;
                            })
                            .catch(function (err) {
                                console.log(err);
                            });
                    };

                    $scope.refreshPassword();
                },
                templateUrl : 'static/components-' + $stateParams.VERSION + '/teacher_students/newstudents.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function(prefix, num, pwd) {

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
                templateUrl : 'static/components-' + $stateParams.VERSION + '/teacher_students/newstudent.tmpl.html',
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

        vm.resetUsersPassword = function (ev) {
            var confirm = $mdDialog.confirm()
                .title('Are you sure?')
                .textContent('Do you want to reset the passwords for all your students (so they all have the same password)?')
                .ariaLabel('Confirm')
                .targetEvent(ev)
                .ok('Yes')
                .cancel('No');

            $mdDialog.show(confirm).then(
                function() {
                    vm.allStudentPasswordsReset = true;

                    vm.students.forEach(function (student) {
                        student.isPlaceholder = true;
                    });

                    usersService.resetStudentsPassword(vm.students, vm.profile.tenant)
                        .then(function (resp) {
                            vm.students.forEach(function (student) {
                                student.isPlaceholder = false;
                            });
                            displayPassword(ev, {
                                username : 'All students',
                                password : resp.password
                            }, vm.students.length > 40);
                        })
                        .catch(function (err) {
                            vm.students.forEach(function (student) {
                                student.isPlaceholder = false;
                            });
                            vm.allStudentPasswordsReset = false;
                            displayAlert('errors', err.status, err.data);
                        });
                },
                function() {
                    // cancelled. do nothing
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
