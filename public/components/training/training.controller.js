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

        vm.showTips = false;

        $scope.tips = [];

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

                return projectsService.getProject($scope.projectId, profile.user_id, profile.tenant);
            })
            .then(function (project) {
                $scope.project = project;

                refreshLabelsSummary();

                for (var labelIdx in project.labels) {
                    var label = project.labels[labelIdx];
                    $scope.training[label] = [];
                }

                return trainingService.getTraining($scope.projectId, vm.profile.user_id, vm.profile.tenant);
            })
            .then(function (training) {
                for (var trainingitemIdx in training) {
                    var trainingitem = training[trainingitemIdx];

                    var label = trainingitem.label;

                    if (label in $scope.training === false) {
                        $scope.training[label] = [];

                        // TODO need to update the project with this missing label
                    }

                    $scope.training[label].push(trainingitem);
                }

                refreshTips();

//                $scope.showHelp = true;
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

        function refreshTips () {
            if ($scope.project.labels.length === 0) {
                $scope.tips = HELP_TEXT_NOLABELS;
            }
            else if ($scope.project.labels.length === 1) {
                $scope.tips = HELP_TEXT_ONELABEL;
            }
            else {
                var allEmpty = true;
                for (var labelIdx in $scope.project.labels) {
                    var label = $scope.project.labels[labelIdx];
                    if ($scope.training[label].length > 0) {
                        allEmpty = false;
                        break;
                    }
                }
                if (allEmpty) {
                    $scope.tips = HELP_TEXT_NOEXAMPLES;
                }
                else {
                    $scope.tips = [];
                }
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

                            refreshTips();
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
                            refreshHelpText();
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



        var HELP_TEXT_NOLABELS = [
            'First - decide what you want to teach the computer to recognise.',
            'Create a bucket for each of the things you want the computer to be able to recognise.',
            'Create a new bucket with the "Add a new label" button in the top-right.',
            'For example, to train the machine to recognise boys and girls names, create two buckets. Click on the "Add a new label" button once and give it the label "boys". And then click on "Add a new label" button again and create the label "girls". That would give you two training buckets for your examples.'
        ];
        var HELP_TEXT_ONELABEL = [
            'You need to train the computer with examples of more than one sort of thing. ',
            'If you want to train it to recognise different things, then create more labels for the other types.',
            'If you only want it to be able to recognise one thing, then you will need to create a bucket with examples of things that aren\'t.... oh god this is making no sense and needs writing by someone who speekee English'
        ];
        var HELP_TEXT_NOEXAMPLES = [
            'All the buckets are empty. Explain why you need to start collecting examples'
        ];
    }

}());
