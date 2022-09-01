(function () {

    angular
        .module('app')
        .controller('NewProjectController', NewProjectController);

    NewProjectController.$inject = [
        'authService', 'projectsService',
        'loggerService',
        '$state', '$rootScope', '$scope', '$translate'
    ];


    function NewProjectController(authService, projectsService, loggerService, $state, $rootScope, $scope, $translate) {

        var vm = this;
        vm.authService = authService;

        $scope.creating = false;

        var errorExceededLimit = 'You have reached the limit for the number of projects you can have. You need to delete one of your current projects before you can create another.';
        var errorTryItNow = 'Sorry! You can only create one project at a time if you use "Try it now". You need to delete your current project before you can create another.';
        $translate([ 'NEWPROJECT.ERRORS.EXCEEDLIMIT', 'NEWPROJECT.ERRORS.TRYITNOW' ])
            .then(function (translations) {
                errorExceededLimit = translations['NEWPROJECT.ERRORS.EXCEEDLIMIT'];
                errorTryItNow = translations['NEWPROJECT.ERRORS.TRYITNOW'];
            })
            .catch(function (err) {
                loggerService.error('[ml4kproj] Failed to get translated error messages', err);
            });

        // use the language that the site is running in
        //  as the default language for text projects
        //  (if supported) otherwise use the universal
        //  language support
        switch ($translate.use()) {
            case 'en':
            case 'ar':
            case 'cs':
            case 'zh-cn':
            case 'zh-tw':
            case 'de':
            case 'fr':
            case 'it':
            case 'ja':
            case 'ko':
            case 'pt-br':
            case 'es':
                $scope.language = $translate.use();
                break;
            case 'nl-be':
                $scope.language = 'nl';
                break;
            default:
                $scope.language = 'xx';
        }

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

        $scope.isInvalid = function (type) {
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
            $scope.creating = true;

            if (projectSpec.type !== 'numbers') {
                delete projectSpec.fields;
            }

            loggerService.debug('[ml4kproj] Creating new project', projectSpec);

            projectsService.createProject(projectSpec, vm.profile.user_id, vm.profile.tenant)
                .then(function (created) {
                    loggerService.debug('[ml4kproj] Created project', created);
                    $state.go('projects', { id : created.id });
                })
                .catch(function (err) {
                    loggerService.error('[ml4kproj] Failed to create project', err);

                    // treat a user creating too many projects as a special case, and display a
                    //  translated message with additional guidance
                    if (err.status === 409 && err.data.error === 'User already has maximum number of projects') {
                        if (vm.profile.tenant === 'session-users') {
                            err.data.message = errorTryItNow;
                        }
                        else {
                            err.data.message = errorExceededLimit;
                        }
                    }

                    displayAlert('errors', err.status, err.data);
                    $scope.creating = false;
                });
        };
    }
}());
