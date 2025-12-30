    (function () {

        angular
            .module('app')
            .controller('Scratch3Controller', Scratch3Controller);

        Scratch3Controller.$inject = [
            'authService',
            'modelService', 'projectsService', 'scratchkeysService',
            'loggerService',
            '$stateParams',
            '$scope'
        ];

        function Scratch3Controller(authService, modelService, projectsService, scratchkeysService, loggerService, $stateParams, $scope) {

            var vm = this;
            vm.authService = authService;

            $scope.projectId = $stateParams.projectId;
            $scope.userId = $stateParams.userId;

            $scope.projecturls = {
                train : '/#!/mlproject/' + $stateParams.userId + '/' + $stateParams.projectId + '/training',
                learnandtest : '/#!/mlproject/' + $stateParams.userId + '/' + $stateParams.projectId + '/models'
            };

            loggerService.debug('[ml4kscratch3] preparing Scratch 3 page', $scope.projecturls);

            const escapeProjectName = function (input) {
                return input.replaceAll(/[\(\)!&<>]/g, ' ')
                            .replaceAll(/[']/g, '%27');
            };

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

                    if (project.type === 'text' || project.storage !== 'local') {
                        // cloud projects always require a scratch key
                        //  local projects normally don't - text projects are an exception
                        loggerService.debug('[ml4kscratch3] getting scratch key');
                        return scratchkeysService.getScratchKeys(project, $scope.userId, vm.profile.tenant);
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

                        if ($scope.project.storage === 'local') {
                            scratchkey.extensionurl += encodeURIComponent('?projectid=' + $scope.project.id);
                        }
                    }
                    else {
                        var additionalQuery = '';
                        if ($scope.project.type === 'regression' && $scope.project.columns) {
                            $scope.project.labels = [ 'input', 'output' ];
                            $scope.project.hasOutput = $scope.project.columns.some(function (c) { return c.output; });
                            additionalQuery = 'columns=' + JSON.stringify($scope.project.columns.map(function (c) {
                                return {
                                    label: c.label,
                                    output: c.output
                                };
                            }));
                        }
                        else if ($scope.project.type === 'numbers') {
                            additionalQuery = 'userid=' + $scope.userId + '&' +
                                'fields=' + JSON.stringify($scope.project.fields);
                        }

                        scratchkey = {
                            id: $scope.project.id,
                            name: $scope.project.name,
                            type: $scope.project.type,
                            extensionurl: window.location.origin +
                                          '/api/scratch/localproject/local/' +
                                            $scope.project.type +
                                            '/extension3.js' +
                                            encodeURIComponent(
                                                '?' +
                                                    'projectid=' + $scope.project.id + '&' +
                                                    'projectname=' + escapeProjectName($scope.project.name) + '&' +
                                                    'labelslist=' + $scope.project.labels.join(',') + '&' +
                                                    additionalQuery
                                            )
                        };
                    }


                    if (modelService.isModelSavedInBrowser($scope.project.type, $scope.project.id)) {
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
