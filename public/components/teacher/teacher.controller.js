(function () {

    angular
        .module('app')
        .controller('TeacherController', TeacherController);

    TeacherController.$inject = [
        'authService',
        'usersService',
        '$mdDialog',
        '$timeout'
    ];

    function TeacherController(authService, usersService, $mdDialog, $timeout) {

        var vm = this;
        vm.authService = authService;

        var alertId = 1;
        vm.errors = [];
        vm.warnings = [];
        vm.dismissAlert = function (type, errIdx) {
            vm[type].splice(errIdx, 1);
        };
        function displayAlert(type, status, errObj) {
            vm[type].push({
                alertid : alertId++,
                message : errObj.message || errObj.error || 'Unknown error',
                status : status
            });
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
                    .textContent('Password : ' + student.password)
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
                    usersService.deleteStudent(student, vm.profile.tenant)
                        .then(function () {
                            vm.students = vm.students.filter(function (itm) {
                                return itm.username !== student.username;
                            });
                            // refreshStudentsList(vm.profile);
                        })
                        .catch(function (err) {
                            displayAlert('errors', err.status, err.data);
                        });

                },
                function() {
                    // cancelled. do nothing
                });
        };

        vm.createUser = function (ev) {
            var confirm = $mdDialog.prompt()
                .title('Create new student')
                  .textContent('Please choose a unique username for the new student')
                  .placeholder('Username')
                  .ariaLabel('Username')
                  .targetEvent(ev)
                  .ok('Create')
                  .cancel('Cancel');

            $mdDialog.show(confirm).then(
                function(username) {
                    usersService.createStudent(username, vm.profile.tenant)
                        .then(function (newUser) {
                            displayPassword(ev, newUser);

                            // TODO horrid hack alert
                            $timeout(function () {
                                vm.students.push(newUser);
                                // refreshStudentsList(vm.profile);
                            }, 50);
                        })
                        .catch(function (err) {
                            displayAlert('errors', err.status, err.data);
                        });
                },
                function() {
                    // cancelled. do nothing
                });
        };

        vm.resetUserPassword = function (ev, student) {
            usersService.resetStudentPassword(student, vm.profile.tenant)
                .then(function (updatedUser) {
                    displayPassword(ev, updatedUser);
                })
                .catch(function (err) {
                    displayAlert('errors', err.status, err.data);
                });
        };

    }
}());
