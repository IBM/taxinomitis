(function () {

    angular
        .module('app')
        .controller('TestController', TestController);

    TestController.$inject = [
        'authService',
        'projectsService', 'trainingService',
        '$stateParams',
        '$scope'
    ];

    function TestController(authService, projectsService, trainingService, $stateParams, $scope) {

        var vm = this;
        vm.authService = authService;

        $scope.projectId = $stateParams.projectId;
        $scope.testformData = {};

        authService.getProfileDeferred().then(function (profile) {
            vm.profile = profile;

            projectsService.getProject($scope.projectId, profile.user_id, profile.tenant)
                .then(function (project) {
                    $scope.project = project;

                    trainingService.getModels($scope.projectId, profile.user_id, profile.tenant)
                        .then(function (models) {
                            $scope.models = models;
                        });
                });
        });


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
                        $scope.testoutput_explanation = "with " + resp[0].confidence + "% confidence";
                    });
            }
            else {
                $scope.testoutput = randomClass(project);
                $scope.testoutput_explanation = "Selected at random";
            }
        };

    }

}());
