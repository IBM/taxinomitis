(function () {

    angular
        .module('app')
        .controller('ProjectsController', ProjectsController);

    ProjectsController.$inject = [
        'authService',
        'projectsService',
        '$mdDialog',
        '$scope', '$timeout', '$stateParams'
    ];

    function ProjectsController(authService, projectsService, $mdDialog, $scope, $timeout, $stateParams) {

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


        vm.createProject = function (ev) {
            $mdDialog.show({
                controller : function ($scope, $mdDialog) {
                    $scope.fieldscount = 1;
                    $scope.fields = [];

                    $scope.hide = function() {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function(resp) {
                        $mdDialog.hide(resp);
                    };

                    $scope.range = function(n) {
                        return new Array(n);
                    };
                },
                templateUrl : 'static/components-' + $stateParams.VERSION + '/projects/newproject.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function(project) {

                    var placeholder = {
                        id : placeholderId++,
                        name : project.name,
                        type : project.type,
                        fields : project.fields,
                        isPlaceholder : true
                    };
                    vm.projects.push(placeholder);

                    projectsService.createProject(project, vm.profile.user_id, vm.profile.tenant)
                        .then(function (newproject) {
                            placeholder.id = newproject.id;
                            placeholder.labels = newproject.labels;
                            placeholder.isPlaceholder = false;
                        })
                        .catch(function (err) {
                            displayAlert('errors', err.status, err.data);

                            var idxToRemove = findProjectIndex(placeholder.id);
                            if (idxToRemove !== -1) {
                                vm.projects.splice(idxToRemove, 1);
                            }
                        });
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };


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
