(function () {

    angular
        .module('app')
        .controller('ProjectsController', ProjectsController);

    ProjectsController.$inject = [
        'authService',
        'projectsService',
        '$mdDialog'
    ];

    function ProjectsController(authService, projectsService, $mdDialog) {

        var vm = this;
        vm.authService = authService;

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


        function refreshProjectsList(profile) {
            projectsService.getProjects(profile)
                .then(function (projects) {
                    vm.projects = projects;

                    for (var i = 0; i < vm.projects.length; i++) {
                        var project = vm.projects[i];

                        var labels = project.type === 'sounds' ?
                            project.labels.filter(function (label) {
                                return label !== '_background_noise_';
                            }) :
                            project.labels;

                        if (labels.length > 0) {
                            var summary = '';
                            switch (labels.length) {
                                case 1:
                                    summary = labels[0];
                                    break;
                                case 2:
                                    summary = labels[0] + ' or ' + labels[1];
                                    break;
                                case 3:
                                    summary = labels[0] + ', ' +
                                              labels[1] + ' or ' +
                                              labels[2];
                                    break;
                                default:
                                    summary = labels[0] + ', ' +
                                              labels[1] + ' or ' +
                                              (labels.length - 2) + ' other classes';
                                    break;
                            }
                            project.labelsSummary = summary;
                        }
                    }
                })
                .catch(function (err) {
                    displayAlert('errors', err.status, err.data);
                });
        }


        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                refreshProjectsList(profile);
            })
            .catch(function (err) {
                displayAlert('errors', err.status, err.data);
            });


        vm.deleteProject = function (ev, project) {
            var confirm = $mdDialog.confirm()
                .title('Are you sure?')
                .textContent('Do you want to delete ' + project.name + '? (This cannot be undone)')
                .ariaLabel('Confirm')
                .targetEvent(ev)
                .ok('Yes')
                .cancel('No');

            $mdDialog.show(confirm).then(
                function() {
                    project.isPlaceholder = true;
                    projectsService.deleteProject(project, vm.profile.user_id, vm.profile.tenant)
                        .then(function () {
                            var idx = findProjectIndex(project.id);
                            if (idx !== -1) {
                                vm.projects.splice(idx, 1);
                            }
                            else {
                                refreshProjectsList(vm.profile);
                            }
                        })
                        .catch(function (err) {
                            displayAlert('errors', err.status, err.data);
                        });
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };


        vm.displayCrowdSourcedInfo = function (ev) {
            ev.stopPropagation();
            ev.preventDefault();

            $mdDialog.show(
                $mdDialog.alert()
                  .clickOutsideToClose(true)
                  .title('Crowd-sourced project')
                  .textContent('This is a whole-class project. All the students in your class are able to access it and contribute training data to it.')
                  .ariaLabel('Crowd-sourced project')
                  .ok('Got it!')
                  .targetEvent(ev)
              );
        };

        function findProjectIndex(id) {
            var len = vm.projects.length;
            for (var i = 0; i < len; i++) {
                if (vm.projects[i].id === id) {
                    return i;
                }
            }
            return -1;
        }

    }
}());
