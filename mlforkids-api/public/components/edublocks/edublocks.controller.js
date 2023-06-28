    (function () {

        angular
            .module('app')
            .controller('EdublocksController', EdublocksController);

        EdublocksController.$inject = [
            'authService', 'projectsService', 'scratchkeysService', 'loggerService',
            '$translate', '$mdDialog', '$stateParams', '$scope', '$window'
        ];

        function EdublocksController(authService, projectsService, scratchkeysService, loggerService, $translate, $mdDialog, $stateParams, $scope, $window) {

            var vm = this;
            vm.authService = authService;

            $scope.testdata = {
                text      : 'The text that you want to test',
                storetext : 'The text that you want to store',
                imagefile : 'my-test-image.jpg',
                imageurl  : 'https://www.site-on-the-internet.com/image.jpg',
                fields    : [],
                label     : 'label'
            };

            var edublocksTitle = 'EduBlocks';
            var edublocksTip = 'Click on Clone to start editing your own copy of the code';
            var edublocksLaunch = 'Go';

            $scope.projectId = $stateParams.projectId;
            $scope.userId = $stateParams.userId;

            authService.getProfileDeferred()
                .then(function (profile) {
                    vm.profile = profile;

                    loggerService.debug('[ml4kedublocks] getting project');
                    return projectsService.getProject($scope.projectId, $scope.userId, profile.tenant);
                })
                .then(function (project) {
                    $scope.project = project;
                    if (project.labels && project.labels.length > 0) {
                        $scope.testdata.label = project.labels[0];
                    }

                    if (project.type === 'numbers') {
                        loggerService.debug('[ml4kedublocks] getting project fields');
                        return projectsService.getFields($scope.projectId, $scope.userId, vm.profile.tenant);
                    }
                    else {
                        return;
                    }
                })
                .then(function (fields) {
                    $scope.fields = fields;

                    loggerService.debug('[ml4kedublocks] getting Scratch key');
                    return scratchkeysService.getScratchKeys($scope.project.id, $scope.userId, vm.profile.tenant);
                })
                .then(function (resp) {
                    if (resp) {
                        $scope.scratchkey = resp[0];
                    }
                })
                .catch(function (err) {
                    $scope.failure = {
                        message : err.data.error,
                        status : err.status
                    };
                });

            $translate([
                'EDUBLOCKS.TITLE',
                'EDUBLOCKS.TIP',
                'EDUBLOCKS.GO'
            ]).then(function (translations) {
                edublocksTitle = translations['EDUBLOCKS.TITLE'];
                edublocksTip = translations['EDUBLOCKS.TIP'];
                edublocksLaunch = translations['EDUBLOCKS.GO'];
            });

            $scope.openEdublocksLink = function (edublocksurl, ev) {
                $mdDialog.show($mdDialog.alert()
                    .title(edublocksTitle)
                    .htmlContent(edublocksTip)
                    .targetEvent(ev)
                    .ok(edublocksLaunch))
                    .then(
                        function () {
                            $window.open(edublocksurl, '_blank');
                        },
                        function() {
                            // cancelled, do nothing
                        }
                    );
            };
        }
    }());
