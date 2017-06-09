(function () {

    angular
        .module('app')
        .controller('TrainingController', TrainingController);

    TrainingController.$inject = [
        'authService',
        'projectsService', 'trainingService',
        '$stateParams',
        '$scope',
        '$mdDialog'
    ];

    function TrainingController(authService, projectsService, trainingService, $stateParams, $scope, $mdDialog) {

        var vm = this;
        vm.authService = authService;


        var alertId = 1;
        vm.errors = [];
        vm.warnings = [];
        vm.dismissAlert = function (type, errIdx) {
            vm[type].splice(errIdx, 1);
        };
        function displayAlert(type, errObj) {
            vm[type].push({ alertid : alertId++, message : errObj.message || errObj.error || 'Unknown error' });
        }


        $scope.projectId = $stateParams.projectId;
        $scope.training = {};

        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                projectsService.getProject($scope.projectId, profile.user_id, profile.tenant)
                    .then(function (project) {
                        $scope.project = project;

                        refreshLabelsSummary();

                        for (var label of project.labels) {
                            $scope.training[label] = [];
                        }

                        trainingService.getTraining($scope.projectId, profile.user_id, profile.tenant)
                            .then(function (training) {
                                for (var trainingitem of training) {
                                    var label = trainingitem.label;

                                    if (label in $scope.training === false) {
                                        $scope.training[label] = [];

                                        // TODO need to update the project with this missing label
                                    }

                                    $scope.training[label].push(trainingitem);
                                }
                            })
                            .catch(function (err) {
                                displayAlert('errors', err.data);
                            });
                    })
                    .catch(function (err) {
                        displayAlert('errors', err.data);
                    });
            })
            .catch(function (err) {
                displayAlert('errors', err.data);
            });


        function refreshLabelsSummary () {
            if ($scope.project.labels.length > 0) {
                var summary = '';
                switch ($scope.project.labels.length) {
                    case 1:
                        summary = $scope.project.labels[0];
                        break;
                    case 2:
                        summary = $scope.project.labels[0] + ' or ' + $scope.project.labels[1];
                        break;
                    case 3:
                        summary = $scope.project.labels[0] + ', ' +
                                    $scope.project.labels[1] + ' or ' +
                                    $scope.project.labels[2];
                        break;
                    default:
                        summary = $scope.project.labels[0] + ', ' +
                                    $scope.project.labels[1] + ' or ' +
                                    ($scope.project.labels.length - 2) + ' other classes';
                        break;
                }
                $scope.project.labelsSummary = summary;
            }
        }


        vm.addTrainingData = function (ev, label) {
            $mdDialog.show({
                controller : DialogController,
                templateUrl : 'components/training/trainingdata.tmpl.html',
                parent : angular.element(document.body),
                targetEvent : ev,
                clickOutsideToClose : true,
                locals : {
                    label : label
                }
            })
            .then(
                function(example) {
                    trainingService.newTrainingData($scope.projectId, vm.profile.user_id, vm.profile.tenant, example, label)
                        .then(function (newitem) {
                            $scope.training[label].push(newitem);
                        })
                        .catch(function (err) {
                            displayAlert('errors', err.data);
                        });
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };


        vm.addLabel = function (ev, project) {
            var confirm = $mdDialog.prompt()
                .title('Add new label')
                  .textContent('Enter new label to recognise')
                  .placeholder('label')
                  .ariaLabel('label')
                  .targetEvent(ev)
                  .ok('Add')
                  .cancel('Cancel');

            $mdDialog.show(confirm).then(
                function(newlabel) {
                    projectsService.addLabelToProject($scope.projectId, vm.profile.user_id, vm.profile.tenant, newlabel)
                        .then(function (labels) {
                            $scope.project.labels = labels;
                            $scope.training[newlabel] = [];

                            refreshLabelsSummary();
                        })
                        .catch(function (err) {
                            displayAlert('errors', err.data);
                        });

                },
                function() {
                    // cancelled. do nothing
                });
        };


        vm.deleteText = function (label, item, idx) {
            $scope.training[label].splice(idx, 1);
            trainingService.deleteTrainingData($scope.projectId, vm.profile.user_id, vm.profile.tenant, item.id);
        };




        function DialogController($scope, locals) {
            $scope.label = locals.label;

            $scope.hide = function() {
                $mdDialog.hide();
            };
            $scope.cancel = function() {
                $mdDialog.cancel();
            };
            $scope.confirm = function(resp) {
                $mdDialog.hide(resp);
            };
        }
    }

}());
