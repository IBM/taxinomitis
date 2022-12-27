(function () {

    angular
        .module('app')
        .controller('TeacherProjectsController', TeacherProjectsController);

    TeacherProjectsController.$inject = [
        'authService',
        'projectsService', 'trainingService',
        '$mdDialog', '$scope', 'loggerService'
    ];

    function TeacherProjectsController(authService, projectsService, trainingService, $mdDialog, $scope, loggerService) {

        var vm = this;
        vm.authService = authService;

        $scope.submittingDeleteRequest = false;

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


        vm.orderBy = 'name';



        function refreshProjectsList(profile) {
            loggerService.debug('[ml4ksupervise] refreshing projects list');

            projectsService.getClassProjects(profile)
                .then(function (projects) {
                    loggerService.debug('[ml4ksupervise] got projects list');

                    vm.projects = projects;

                    for (var i = 0; i < vm.projects.length; i++) {
                        var project = vm.projects[i];

                        if (project.labels.length > 0) {
                            var summary = '';
                            switch (project.labels.length) {
                                case 1:
                                    summary = project.labels[0];
                                    break;
                                case 2:
                                    summary = project.labels[0] + ' or ' + project.labels[1];
                                    break;
                                case 3:
                                    summary = project.labels[0] + ', ' +
                                              project.labels[1] + ' or ' +
                                              project.labels[2];
                                    break;
                                default:
                                    summary = project.labels[0] + ', ' +
                                              project.labels[1] + ' or ' +
                                              (project.labels.length - 2) + ' other classes';
                                    break;
                            }
                            project.labelsSummary = summary;
                        }
                    }
                })
                .catch(function (err) {
                    loggerService.error('[ml4ksupervise] failed to get projects list', err);

                    displayAlert('errors', err.status, err.data);
                });
        }



        function refreshClassifiersList(profile) {
            loggerService.debug('[ml4ksupervise] refreshing classifiers list');

            trainingService.getUnmanagedClassifiers(profile.tenant)
                .then(function (classifiers) {
                    loggerService.debug('[ml4ksupervise] got classifiers list');

                    vm.classifiers = classifiers;
                })
                .catch(function (err) {
                    loggerService.debug('[ml4ksupervise] failed to get classifiers list');

                    if (err && err.status && err.status === 403) {
                        // probably a managed tenant - so they're not allowed
                        //  to review unmanaged classifiers (this is sorted
                        //  for them)
                    }
                    else {
                        loggerService.error(err);
                    }
                });
        }





        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                if (profile.role === 'supervisor') {
                    refreshProjectsList(profile);
                    refreshClassifiersList(profile);
                }
            })
            .catch(function (err) {
                displayAlert('errors', err.status, err.data);
            });


        vm.deleteModel = function (ev, project) {
            loggerService.debug('[ml4ksupervise] deleting model');

            var confirm = $mdDialog.confirm()
                .title('Are you sure?')
                .textContent('Do you want to delete ' +
                             (project.owner ? project.owner.username + '\'s ' : '') +
                             'machine learning model from project ' + project.name + '?')
                .ariaLabel('Confirm')
                .targetEvent(ev)
                .ok('Yes')
                .cancel('No');

            $mdDialog.show(confirm).then(
                function() {
                    loggerService.debug('[ml4ksupervise] submitting model deletion request');

                    project.hasModel = false;
                    trainingService.deleteModel(project.id, project.userid, project.classid, project.classifierId)
                        .then(function () {
                            loggerService.debug('[ml4ksupervise] model deletion successful');
                        })
                        .catch(function (err) {
                            loggerService.error('[ml4ksupervise] failed to delete model', err);

                            displayAlert('errors', err.status, err.data);
                        });
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };

        vm.deleteClassifier = function (ev, classifier) {
            loggerService.debug('[ml4ksupervise] deleting classifier');

            $scope.submittingDeleteRequest = true;

            var confirm = $mdDialog.confirm()
                .title('Are you sure?')
                .textContent('Do you want to delete ' + classifier.name + '?')
                .ariaLabel('Confirm')
                .targetEvent(ev)
                .ok('Yes')
                .cancel('No');

            $mdDialog.show(confirm).then(
                function() {
                    loggerService.debug('[ml4ksupervise] submitting classifier deletion request');

                    trainingService.deleteBluemixClassifier(vm.profile.tenant, classifier.id, classifier.credentials.id, classifier.type)
                        .then(function () {
                            loggerService.debug('[ml4ksupervise] classifier deletion successful');

                            $scope.submittingDeleteRequest = false;
                            vm.classifiers[classifier.type] = vm.classifiers[classifier.type].filter(function (c) {
                                return c.id !== classifier.id;
                            });
                        })
                        .catch(function (err) {
                            loggerService.error('[ml4ksupervise] failed to delete classifier', err);

                            $scope.submittingDeleteRequest = false;
                            displayAlert('errors', err.status, err.data);
                        });
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };
    }
}());
