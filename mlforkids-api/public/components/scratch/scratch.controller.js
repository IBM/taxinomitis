    (function () {

        angular
            .module('app')
            .controller('ScratchController', ScratchController);

        ScratchController.$inject = [
            'authService',
            'projectsService', 'scratchkeysService', 'utilService',
            '$stateParams',
            '$scope', '$timeout'
        ];

        function ScratchController(authService, projectsService, scratchkeysService, utilService, $stateParams, $scope, $timeout) {

            var vm = this;
            vm.authService = authService;

            var alertId = 1;
            vm.errors = [];
            vm.warnings = [];
            vm.dismissAlert = function (type, errIdx) {
                vm[type].splice(errIdx, 1);
            };
            function displayAlert(type, errObj) {
                if (!errObj) {
                    errObj = {};
                }
                vm[type].push({ alertid : alertId++, message : errObj.message || errObj.error || 'Unknown error', status : errObj.status });
            }


            $scope.projectId = $stateParams.projectId;
            $scope.userId = $stateParams.userId;

            $scope.projecturls = {
                train : '/#!/mlproject/' + $stateParams.userId + '/' + $stateParams.projectId + '/training',
                learnandtest : '/#!/mlproject/' + $stateParams.userId + '/' + $stateParams.projectId + '/models'
            };

            $scope.scratchblocks = {
                label : '',
                confidence : '',
                sample : ''
            };


            authService.getProfileDeferred()
                .then(function (profile) {
                    vm.profile = profile;

                    return utilService.loadScript('/static/scratchblocks-v3.1-min.js');
                })
                .then(function () {
                    return projectsService.getProject($scope.projectId, $scope.userId, vm.profile.tenant);
                })
                .then(function (project) {
                    $scope.project = project;

                    $scope.projecturls.train = '/#!/mlproject/' + $scope.project.userid + '/' + $scope.project.id + '/training';
                    $scope.projecturls.learnandtest = '/#!/mlproject/' + $scope.project.userid + '/' + $scope.project.id + '/models';

                    if (project.type === 'numbers') {
                        return projectsService.getFields($scope.projectId, $scope.userId, vm.profile.tenant);
                    }
                    else {
                        return;
                    }
                })
                .then(function (fields) {
                    $scope.scratchblocks.label = 'recognise ' + $scope.project.type + ' ';
                    if ($scope.project.type === 'text') {
                        $scope.scratchblocks.label += '[text]';
                    }
                    else if ($scope.project.type === 'images') {
                        $scope.scratchblocks.label += '[costume image]';
                    }
                    else if ($scope.project.type === 'numbers') {
                        var idx = 1;
                        for (var fldIndex in fields) {
                            var field = fields[fldIndex].name;
                            $scope.scratchblocks.label += field + ' (' + (idx++) + ') ';
                        }
                    }
                    $scope.scratchblocks.confidence = $scope.scratchblocks.label + ' \\(confidence) :: custom reporter';
                    $scope.scratchblocks.label += ' \\(label) :: custom reporter';

                    if ($scope.project.type === 'text') {
                        $scope.scratchblocks.sample =
                            'ask [enter some text here] and wait \n' +
                            'if &lt;{recognise text (answer) \\(label) :: custom reporter } = (' + $scope.project.labels[0] + ' :: custom reporter)&gt; then \n' +
                            'say [I think that was ' + $scope.project.labels[0] + ']';
                    }
                    else if ($scope.project.type === 'images') {
                        $scope.scratchblocks.sample =
                            'if &lt;{recognise images (costume image :: looks) :: custom reporter } = (' + $scope.project.labels[0] + ' :: custom reporter)&gt; then \n' +
                            'say [I think that is a picture of ' + $scope.project.labels[0] + ']';
                    }
                    else if ($scope.project.type === 'numbers') {
                        $scope.scratchblocks.sample =
                            'if &lt;{' + $scope.scratchblocks.label + '} = (' + $scope.project.labels[0] + ' :: custom reporter)&gt; then \n' +
                            'say [I think that was ' + $scope.project.labels[0] + ']';
                    }

                    $timeout(function () {
                        scratchblocks.renderMatching('.scratchblocks');
                    }, 50);

                    return scratchkeysService.getScratchKeys($scope.project.id, $scope.userId, vm.profile.tenant);
                })
                .then(function (resp) {
                    var scratchkey = resp[0];

                    scratchkey.extensionurl = window.location.origin +
                                            '/api/scratch/' +
                                            scratchkey.id +
                                            '/extension.js'

                    scratchkey.url = '/scratchx?url=' +
                                    scratchkey.extensionurl +
                                    '#scratch';

                    $scope.scratchkey = scratchkey;
                })
                .catch(function (err) {
                    displayAlert('errors', err.data);
                });
        }

    }());
