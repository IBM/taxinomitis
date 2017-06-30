(function () {

    angular
        .module('app')
        .controller('ScratchController', ScratchController);

    ScratchController.$inject = [
        'authService',
        'projectsService', 'scratchkeysService',
        '$stateParams',
        '$scope', '$window', '$timeout'
    ];

    function ScratchController(authService, projectsService, scratchkeysService, $stateParams, $scope, $window, $timeout) {

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

        $scope.scratchblocks = {
            label : '',
            confidence : '',
            sample : ''
        };


        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                return projectsService.getProject($scope.projectId, profile.user_id, profile.tenant);
            })
            .then(function (project) {
                $scope.project = project;

                $scope.scratchblocks.label = 'recognise ' + project.type + ' ';
                if (project.type === 'text') {
                    $scope.scratchblocks.label += '[text]';
                }
                else if (project.type === 'numbers') {
                    var idx = 1;
                    for (var fldIndex in project.fields) {
                        var field = project.fields[fldIndex];
                        $scope.scratchblocks.label += field + ' (' + (idx++) + ') ';
                    }
                }
                $scope.scratchblocks.confidence = $scope.scratchblocks.label + ' \\(confidence) :: custom reporter';
                $scope.scratchblocks.label += ' \\(label) :: custom reporter';

                if (project.type === 'text') {
                    $scope.scratchblocks.sample =
                        'ask [enter some text here] and wait \n' +
                        'if &lt;{recognise text (answer) \\(label) :: custom reporter } = (' + project.labels[0] + ' :: custom reporter)&gt; then \n' +
                        'say [I think that was ' + project.labels[0] + ']';
                }
                else if (project.type === 'numbers') {
                    $scope.scratchblocks.sample =
                        'if &lt;{' + $scope.scratchblocks.label + '} = (' + project.labels[0] + ' :: custom reporter)&gt; then \n' +
                        'say [I think that was ' + project.labels[0] + ']';
                }

                $timeout(function () {
                    scratchblocks.renderMatching('.scratchblocks');
                }, 50);
            })
            .catch(function (err) {
                displayAlert('errors', err.data);
            });


        vm.getScratchKey = function (ev, project) {
            // we need to open the window immediately after the user clicks the
            //  button, otherwise the browser will consider this a pop-up and
            //  block it
            var scratchWindow = $window.open('/scratchx/loading.html', '_blank');

            scratchkeysService.getScratchKeys(project.id, vm.profile.user_id, vm.profile.tenant)
                .then(function (resp) {
                    var scratchkey = resp[0];

                    scratchkey.extensionurl = window.location.origin +
                                              '/api/scratch/' +
                                              scratchkey.id +
                                              '/extension.js'

                    scratchkey.url = '/scratchx?url=' +
                                     scratchkey.extensionurl +
                                     '#scratch';

                    if (scratchkey.model) {
                        scratchWindow.location.href = scratchkey.url;
                    }

                    $scope.scratchkey = scratchkey;
                })
                .catch(function (err) {
                    displayAlert('errors', err.data);
                });

        };
    }

}());
