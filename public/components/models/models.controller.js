(function () {

    angular
        .module('app')
        .controller('ModelsController', ModelsController);

    ModelsController.$inject = [
        'authService',
        'projectsService', 'trainingService',
        '$stateParams',
        '$scope'
    ];

    function ModelsController(authService, projectsService, trainingService, $stateParams, $scope) {

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

        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                projectsService.getProject($scope.projectId, profile.user_id, profile.tenant)
                    .then(function (project) {
                        $scope.project = project;

                        trainingService.getModels($scope.projectId, profile.user_id, profile.tenant)
                            .then(function (models) {
                                $scope.models = models;
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



        vm.createModel = function (ev, project) {
            trainingService.newModel(project.id, vm.profile.user_id, vm.profile.tenant)
                .then(function (newmodel) {
                    $scope.models.push(newmodel);
                })
                .catch(function (err) {
                    displayAlert('errors', err.data);
                });
        };

        vm.deleteModel = function (ev, project, model) {
            var classifierid = model.classifierid;
            trainingService.deleteModel(project.id, vm.profile.user_id, vm.profile.tenant, classifierid)
                .then(function () {
                    $scope.models = $scope.models.filter(function (md) {
                        return md.classifierid !== classifierid;
                    });
                })
                .catch(function (err) {
                    displayAlert('errors', err.data);
                });
        };

    }

}());
