    (function () {

        angular
            .module('app')
            .controller('PythonController', PythonController);

        PythonController.$inject = [
            'authService', 'projectsService', 'scratchkeysService', 'loggerService',
            '$translate', '$mdDialog', '$stateParams', '$scope', '$window'
        ];

        function PythonController(authService, projectsService, scratchkeysService, loggerService, $translate, $mdDialog, $stateParams, $scope, $window) {

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

            var replitTitle = 'replit';
            var replitTip = 'Click on Fork to start editing your own copy of the code';
            var replitLaunch = 'Go';

            $scope.projectId = $stateParams.projectId;
            $scope.userId = $stateParams.userId;

            authService.getProfileDeferred()
                .then(function (profile) {
                    vm.profile = profile;

                    loggerService.debug('[ml4kpython] getting project');
                    return projectsService.getProject($scope.projectId, $scope.userId, profile.tenant);
                })
                .then(function (project) {
                    $scope.project = project;
                    if (project.labels && project.labels.length > 0) {
                        $scope.testdata.label = project.labels[0];
                    }

                    if (project.type === 'numbers') {
                        loggerService.debug('[ml4kpython] getting project fields');
                        return projectsService.getFields($scope.projectId, $scope.userId, vm.profile.tenant);
                    }
                    else {
                        return;
                    }
                })
                .then(function (fields) {
                    $scope.fields = fields;

                    loggerService.debug('[ml4kpython] getting Scratch key');
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
                'PYTHON.REPLIT.TITLE',
                'PYTHON.REPLIT.TIP',
                'PYTHON.REPLIT.GO'
            ]).then(function (translations) {
                replitTitle = translations['PYTHON.REPLIT.TITLE'];
                replitTip = translations['PYTHON.REPLIT.TIP'];
                replitLaunch = translations['PYTHON.REPLIT.GO'];
            });

            $scope.openReplLink = function (replurl, ev) {
                $mdDialog.show($mdDialog.alert()
                    .title(replitTitle)
                    .htmlContent(replitTip)
                    .targetEvent(ev)
                    .ok(replitLaunch))
                    .then(
                        function () {
                            $window.open(replurl, '_blank');
                        },
                        function() {
                            // cancelled, do nothing
                        }
                    );
            };
        }
    }());
