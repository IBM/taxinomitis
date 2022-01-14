(function () {

    angular
        .module('app')
        .controller('TeacherController', TeacherController);

    TeacherController.$inject = [
        'authService', 'usersService',
        '$mdDialog'
    ];

    function TeacherController(authService, usersService, $mdDialog) {

        var vm = this;
        vm.authService = authService;

        vm.busy = false;

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


        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                if (profile.role === 'supervisor') {
                    usersService.getClassPolicy(profile)
                        .then(function (policy) {
                            vm.policy = policy;

                            vm.policy.missingCredentials = false;
                            for (var i = 0; i < policy.supportedProjectTypes.length; i++) {
                                var projectType = policy.supportedProjectTypes[i];
                                if (projectType === 'text' && policy.maxTextModels === 0)
                                {
                                    vm.policy.missingCredentials = true;
                                }
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




        vm.deleteClass = function (ev) {
            var confirm = $mdDialog.confirm()
                            .title('Are you sure?')
                            .htmlContent('<div class="confirmdialogsmall">This cannot be undone. ' +
                                'It will delete your account, as well as the accounts of all of your students. ' +
                                'I will not be able to retrieve any projects from your class if you do this.</div>')
                            .targetEvent(ev)
                            .ok('Yes. Delete everything.')
                            .cancel('No');
            $mdDialog.show(confirm)
                .then(
                    function () {
                        vm.busy = true;
                        usersService.deleteClass(vm.profile)
                            .then(function () {
                                authService.logout();
                            })
                            .catch(function (err) {
                                vm.busy = false;
                                displayAlert('errors', err.status, err);
                            });
                    },
                    function () { /* cancelled */ }
                );
        }
    }
}());
