(function () {

    angular
        .module('app')
        .controller('StudentsController', StudentsController);

    StudentsController.$inject = [
        'authService',
        'usersService',
        '$mdDialog',
        '$timeout'
    ];

    function StudentsController(authService, usersService, $mdDialog, $timeout) {

        var vm = this;
        vm.authService = authService;

        function refreshStudentsList(profile) {
            usersService.getStudentList(profile)
                .then(function (students) {
                    vm.students = students;
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

        authService.getProfileDeferred().then(function (profile) {
            vm.profile = profile;

            if (profile.role === 'supervisor') {
                refreshStudentsList(profile);
            }
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
                            refreshStudentsList(vm.profile);
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
                                refreshStudentsList(vm.profile);
                            }, 500);
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
                });
        };

    }
}());
