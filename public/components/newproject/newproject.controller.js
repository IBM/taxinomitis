(function () {

    angular
        .module('app')
        .controller('NewProjectController', NewProjectController);

    NewProjectController.$inject = [
        'authService',
        'projectsService',
        '$state', '$rootScope'
    ];


    function NewProjectController(authService, projectsService, $state, $rootScope) {

        var vm = this;
        vm.authService = authService;

        vm.creating = false;

        vm.fields = [];
        vm.focused = $rootScope.isTeacher ? 'crowdsourced' : 'name';

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
            vm[type].push({
                alertid : alertId++,
                message : errObj.message || errObj.error || 'Unknown error',
                status : status
            });
        }

        var MIN_CHOICE_LENGTH = 1;
        var MAX_CHOICE_LENGTH = 9;
        var MIN_NUM_CHOICES = 2;
        var MAX_NUM_CHOICES = 5;


        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;
            })
            .catch(function (err) {
                displayAlert('errors', err.status, err.data);
            });

        var IS_VALID_CHOICE = /^[^0-9\-.,][^,]*$/;

        function containsInvalidChoice(choices) {
            return choices.some(function (choice) {
                return (IS_VALID_CHOICE.test(choice) === false) ||
                        choice.length > MAX_CHOICE_LENGTH ||
                        choice.length < MIN_CHOICE_LENGTH;
            });
        }

        vm.isInvalid = function (type) {
            if (type === 'numbers') {
                if (vm.fields.length < 1 || vm.fields.length > 10) {
                    return true;
                }
                for (var i = 0; i < vm.fields.length; i++) {
                    if (vm.fields[i].type === 'multichoice')
                    {
                        if (vm.fields[i].choices.length < MIN_NUM_CHOICES ||
                            vm.fields[i].choices.length > MAX_NUM_CHOICES)
                        {
                            return true;
                        }

                        if (containsInvalidChoice(vm.fields[i].choices)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        };

        vm.addFieldChoice = function (choice, field) {
            if (choice) {
                var newChoice = choice.trim();
                if (newChoice.length > 0 &&
                    newChoice.length <= MAX_CHOICE_LENGTH &&
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
