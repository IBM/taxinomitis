    (function () {

        angular
            .module('app')
            .controller('Scratch3Controller', Scratch3Controller);

        Scratch3Controller.$inject = [
            'authService',
            'modelService', 'projectsService', 'scratchkeysService',
            'browserStorageService',
            'loggerService',
            '$stateParams',
            '$scope'
        ];

        function Scratch3Controller(authService, modelService, projectsService, scratchkeysService, browserStorageService, loggerService, $stateParams, $scope) {

            var vm = this;
            vm.authService = authService;

            $scope.projectId = $stateParams.projectId;
            $scope.userId = $stateParams.userId;

            $scope.projecturls = {
                train : '/#!/mlproject/' + $stateParams.userId + '/' + $stateParams.projectId + '/training',
                learnandtest : '/#!/mlproject/' + $stateParams.userId + '/' + $stateParams.projectId + '/models'
            };

            loggerService.debug('[ml4kscratch3] preparing Scratch 3 page', $scope.projecturls);

            authService.getProfileDeferred()
                .then(function (profile) {
                    vm.profile = profile;

                    loggerService.debug('[ml4kscratch3] getting project info');
                    return projectsService.getProject($scope.projectId, $scope.userId, profile.tenant);
                })
                .then(function (project) {
                    loggerService.debug('[ml4kscratch3] project', project);

                    $scope.project = project;

                    $scope.projecturls.train = '/#!/mlproject/' + $scope.project.userid + '/' + $scope.project.id + '/training';
                    $scope.projecturls.learnandtest = '/#!/mlproject/' + $scope.project.userid + '/' + $scope.project.id + '/models';

                    if (!browserStorageService.idIsLocal(project.id)) {
                        loggerService.debug('[ml4kscratch3] getting scratch key');
                        return scratchkeysService.getScratchKeys(project.id, $scope.userId, vm.profile.tenant);
                    }
                })
                .then(function (resp) {
                    var scratchkey;
                    if (resp) {
                        loggerService.debug('[ml4kscratch3] scratch key', resp);

                        scratchkey = resp[0];

                        scratchkey.extensionurl = window.location.origin +
                                                  '/api/scratch/' +
                                                  scratchkey.id +
                                                  '/extension3.js';
                    }
                    else {
                        scratchkey = {
                            id: $scope.project.id,
                            name: $scope.project.name,
                            type: $scope.project.type,
                            extensionurl: window.location.origin +
                                          '/api/scratch/localproject/local/' +
                                            $scope.project.type + '/' +
                                            $scope.project.id + '/' +
                                            encodeURIComponent($scope.project.name) + '/' +
                                            encodeURIComponent($scope.project.labels.join(',')) + '/' +
                                            'extension3.js'
                        };
                    }



                    if ($scope.project.type === 'sounds' && modelService.isModelSavedInBrowser('sounds', $scope.project.id)) {
                        scratchkey.model = 'placeholder';
                    }
                    else if ($scope.project.type === 'imgtfjs' && modelService.isModelSavedInBrowser('images', $scope.project.id)) {
                        scratchkey.model = 'placeholder';
                    }

                    $scope.scratchkey = scratchkey;
                })
                .catch(function (err) {
                    loggerService.error('[ml4kscratch3] error', err);

                    $scope.failure = {
                        message : err.data.error,
                        status : err.status
                    };
                });
        }
    }());
