(function () {

    angular
        .module('app')
        .controller('NewProjectController', NewProjectController);

    NewProjectController.$inject = [
        'authService',
        'projectsService',
        '$state'
    ];


    function NewProjectController(authService, projectsService, $state) {

        var vm = this;
        vm.authService = authService;

        vm.creating = false;

        vm.fields = [];
        vm.focused = '';

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


        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;
            })
            .catch(function (err) {
                displayAlert('errors', err.status, err.data);
            });


        vm.isInvalid = function (type) {
            if (type === 'numbers') {
                if (vm.fields.length < 1 || vm.fields.length > 10) {
                    return true;
                }
                for (var i = 0; i < vm.fields.length; i++) {
                    if (vm.fields[i].type === 'multichoice' &&
                        vm.fields[i].choices.length === 0)
                    {
                        return true;
                    }
                }
            }
            return false;
        };

        vm.addFieldChoice = function (choice, field) {
            if (choice) {
                var newChoice = choice.trim();
                if (newChoice.length > 0 &&
                    newChoice.length <= 8 &&
                    field.choices.indexOf(newChoice) === -1)
                {
                    field.choices.push(newChoice);
                    return true;
                }
            }
            return false;
        };

        vm.confirm = function (projectSpec) {
            vm.creating = true;

            if (projectSpec.type !== 'numbers') {
                delete projectSpec.fields;
            }

            projectsService.createProject(projectSpec, vm.profile.user_id, vm.profile.tenant)
                .then(function (newproject) {
                    $state.go('projects');
                })
                .catch(function (err) {
                    displayAlert('errors', err.status, err.data);

                    vm.creating = false;
                });
        };
    }
}());
