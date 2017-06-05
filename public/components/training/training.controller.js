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

        $scope.projectId = $stateParams.projectId;
        $scope.training = {};

        authService.getProfileDeferred().then(function (profile) {
            vm.profile = profile;

            projectsService.getProject($scope.projectId, profile.user_id, profile.tenant)
                .then(function (project) {
                    $scope.project = project;

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
                        });
                });
        });


        vm.addTrainingData = function (ev, label) {
            var confirm = $mdDialog.prompt()
                .title('Add new example')
                  .textContent('Enter an example of ' + label)
                  .placeholder('example')
                  .ariaLabel('example')
                  .targetEvent(ev)
                  .ok('Add')
                  .cancel('Cancel');

            $mdDialog.show(confirm).then(
                function(example) {
                    trainingService.newTrainingData($scope.projectId, vm.profile.user_id, vm.profile.tenant, example, label)
                        .then(function (newitem) {
                            $scope.training[label].push(newitem);
                        });
                },
                function() {
                    // cancelled. do nothing
                });
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
                        });
                },
                function() {
                    // cancelled. do nothing
                });
        };
    }

}());
