(function () {

    angular
        .module('app')
        .controller('ProjectController', ProjectController);

    ProjectController.$inject = [
        'authService',
        'projectsService',
        'trainingService',
        'scratchkeysService',
        '$stateParams',
        '$scope',
        '$mdDialog'
    ];

    function ProjectController(authService, projectsService, trainingService, scratchkeysService, $stateParams, $scope, $mdDialog) {
        var vm = this;
        vm.authService = authService;

        $scope.projectId = $stateParams.projectId;
        $scope.training = {};
        $scope.testformData = {};

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

                    trainingService.getModels($scope.projectId, profile.user_id, profile.tenant)
                        .then(function (models) {
                            $scope.models = models;
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


        vm.createModel = function (ev, project) {
            trainingService.newModel(project.id, vm.profile.user_id, vm.profile.tenant)
                .then(function (newmodel) {
                    $scope.models.push(newmodel);
                });
        };

        vm.deleteModel = function (ev, project, model) {
            var classifierid = model.classifierid;
            trainingService.deleteModel(project.id, vm.profile.user_id, vm.profile.tenant, classifierid)
                .then(function () {
                    $scope.models = $scope.models.filter(function (md) {
                        return md.classifierid !== classifierid;
                    });
                });
        };

        function getModel() {
            var usableModels = $scope.models.filter(function (model) {
                return model.status === 'Available';
            });
            if (usableModels.length === 0) {
                return;
            }
            return usableModels[usableModels.length - 1];
        }
        function randomClass(project) {
            return project.labels[Math.floor(Math.random() * project.labels.length)];
        }

        vm.testModel = function (ev, form, project) {
            var question = $scope.testformData.testquestion;

            var model = getModel();
            if (model) {
                $scope.testoutput = "please wait...";
                $scope.testoutput_explanation = "";

                trainingService.testModel(project.id, project.type, vm.profile.user_id, vm.profile.tenant, model.classifierid, question)
                    .then(function (resp) {
                        $scope.testoutput = resp[0].class_name;
                        $scope.testoutput_explanation = "with " + (Math.round(resp[0].confidence * 100)) + "% confidence";
                    });
            }
            else {
                $scope.testoutput = randomClass(project);
                $scope.testoutput_explanation = "Selected at random";
            }
        };

        vm.getScratchKey = function (ev, project) {
            scratchkeysService.getScratchKeys(project.id, vm.profile.user_id, vm.profile.tenant)
                .then(function (resp) {
                    var scratchkey = resp[0];

                    scratchkey.url = window.location.origin +
                                     '/api/scratch/' +
                                     scratchkey.id +
                                     '/extension.js';

                    $scope.scratchkey = scratchkey;
                });
        };
    }

}());
