(function () {

    angular
        .module('app')
        .controller('TeacherProjectsController', TeacherProjectsController);

    TeacherProjectsController.$inject = [
        'authService',
        'usersService',
        'projectsService', 'trainingService',
        '$stateParams', '$mdDialog', '$document', '$timeout'
    ];

    function TeacherProjectsController(authService, usersService, projectsService, trainingService, $stateParams, $mdDialog, $document, $timeout) {

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
            projectsService.getClassProjects(profile)
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

                if (profile.role === 'supervisor') {
                    refreshProjectsList(profile);
                }
            })
            .catch(function (err) {
                displayAlert('errors', err.status, err.data);
            });


        vm.deleteModel = function (ev, project) {
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
                    project.hasModel = false;
                    trainingService.deleteModel(project.id, project.userid, project.classid, project.classifierId)
                        .then(function () {
                            console.log('deletion successful');
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


        function scrollToNewItem(itemId) {
            $timeout(function () {
                var newItem = document.getElementById(itemId);
                $document.duScrollToElementAnimated(angular.element(newItem));
            }, 0);
        }
    }
}());
