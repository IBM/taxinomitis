    (function () {

        angular
            .module('app')
            .controller('ColabController', ColabController);

        ColabController.$inject = [
            'authService', 'projectsService', 'storageService', 'scratchkeysService', 'loggerService',
            '$http', '$stateParams', '$scope',
        ];

        function ColabController(authService, projectsService, storageService, scratchkeysService, loggerService, $http, $stateParams, $scope) {

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
            $scope.trainingdata = {
                fields    : [],
                label     : 'label'
            };

            let modelSource;

            function getModelInfo(project) {
                modelSource = storageService.getItem('ml4k-models-numbers-' + project.id + '-status');
                if (modelSource) {
                    return $http.get(modelSource)
                        .then(function (resp) {
                            if (resp && resp.data) {
                                $scope.modelSource = resp.data.urls.status;
                            }
                        })
                        .catch(function (err) {
                            loggerService.error('[ml4kpy] failed to get model info', err);
                            if (err &&
                                err.status === 404 &&
                                err.config.url === modelSource)
                            {
                                // error is a sign that the model is no longer
                                //  available on the model server
                                $scope.expiredModel = true;
                            }
                        });
                }
                else {
                    return Promise.resolve();
                }
            }

            function getKeyInfo(project) {
                if (project.storage !== 'local') {
                    return scratchkeysService.getScratchKeys(project, $scope.userId, vm.profile.tenant)
                        .then(function (resp) {
                            $scope.scratchkey = resp[0].id;
                        })
                        .catch(function (err) {
                            loggerService.error('[ml4kpy] failed to get scratch key', err);
                        });
                }
                else {
                    return Promise.resolve();
                }
            }



            authService.getProfileDeferred()
                .then((profile) => {
                    vm.profile = profile;

                    return projectsService.getProject($scope.projectId, $scope.userId, profile.tenant);
                })
                .then((project) => {
                    if (project && project.type !== 'numbers') {
                        throw new Error('This page is intended for numbers projects only');
                    }

                    $scope.project = project;
                    if (project.labels && project.labels.length > 0) {
                        $scope.testdata.label = project.labels[0];
                        $scope.trainingdata.label = project.labels[0];
                    }

                    return projectsService.getFields($scope.project, $scope.userId, vm.profile.tenant);
                })
                .then(function (fields) {
                    $scope.fields = fields;

                    return getModelInfo($scope.project);
                })
                .then(() => {
                    return getKeyInfo($scope.project);
                })
                .then(() => {
                    $scope.loading = false;
                })
                .catch((err) => {
                    $scope.failure = {
                        message : err.message || err.error || 'Unknown error',
                        status : err.status
                    };
                    $scope.loading = false;
                });
        }
    }());
