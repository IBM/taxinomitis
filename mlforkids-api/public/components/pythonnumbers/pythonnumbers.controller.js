    (function () {

        angular
            .module('app')
            .controller('PythonNumbersController', PythonNumbersController);

        PythonNumbersController.$inject = [
            'authService', 'projectsService', 'storageService',
            '$http', '$stateParams', '$scope'
        ];

        function PythonNumbersController(authService, projectsService, storageService, $http, $stateParams, $scope) {

            var vm = this;
            vm.authService = authService;

            $scope.projectId = $stateParams.projectId;
            $scope.userId = $stateParams.userId;

            $scope.loading = true;
            $scope.modelSource = false;
            $scope.expiredModel = false;

            $scope.testdata = {
                fields    : [],
                label     : 'label'
            };

            let modelSource;

            authService.getProfileDeferred()
                .then(function (profile) {
                    vm.profile = profile;

                    return projectsService.getProject($scope.projectId, $scope.userId, profile.tenant);
                })
                .then(function (project) {
                    if (project && project.type !== 'numbers') {
                        throw new Error('This page is intended for numbers projects only');
                    }

                    $scope.project = project;
                    if (project.labels && project.labels.length > 0) {
                        $scope.testdata.label = project.labels[0];
                    }
                    modelSource = storageService.getItem('ml4k-models-numbers-' + project.id + '-status');
                    if (modelSource) {
                        return $http.get(modelSource);
                    }
                })
                .then(function (resp) {
                    if (resp && resp.data) {
                        $scope.modelSource = resp.data.urls.status;
                        return projectsService.getFields($scope.project, $scope.userId, vm.profile.tenant);
                    }
                })
                .then(function (fields) {
                    $scope.fields = fields;

                    $scope.loading = false;
                })
                .catch(function (err) {
                    if (err && modelSource &&
                        err.status === 404 &&
                        err.config.url === modelSource)
                    {
                        // error is a sign that the model is no longer
                        //  available on the model server
                        $scope.expiredModel = true;
                        $scope.loading = false;
                    }
                    else {
                        $scope.failure = {
                            message : err.message || err.error || 'Unknown error',
                            status : err.status
                        };
                        $scope.loading = false;
                    }
                });
        }
    }());
