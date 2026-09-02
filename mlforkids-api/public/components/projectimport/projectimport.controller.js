(function () {

    angular
        .module('app')
        .controller('ProjectImportController', ProjectImportController)
        .directive('mlProjectArchiveChooser', mlProjectArchiveChooser);

    ProjectImportController.$inject = [
        'authService',
        'projectCloneService',
        'loggerService',
        '$state'
    ];

    function ProjectImportController(authService, projectCloneService, loggerService, $state) {

        var vm = this;
        vm.authService = authService;

        // choosing -> importing -> reporting | error
        //
        //  an import with nothing to report goes straight to projects page. 
        //  'reporting' exists for the one thing that would otherwise be
        //  lost on the way there: examples that could not be imported 
        vm.state = 'choosing';

        vm.imported = 0;
        vm.total = 0;
        vm.skipped = 0;
        vm.filename = undefined;

        var importedproject;

        var alertId = 1;
        vm.errors = [];
        vm.warnings = [];
        vm.dismissAlert = function (type, errIdx) {
            vm[type].splice(errIdx, 1);
        };

        function displayAlert(type, status, errObj) {
            if (!errObj) {
                errObj = {};
            }
            vm[type].push({
                alertid : alertId++,
                message : errObj.message || errObj.error || 'Unknown error',
                status : status
            });
        }

        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;
            })
            .catch(function (err) {
                displayAlert('errors', err.status, err.data);
            });


        vm.goToProject = function () {
            $state.go('projects', { id : importedproject.id });
        };


        vm.importArchive = function (file) {
            if (vm.state === 'importing' || !file) {
                return;
            }

            loggerService.debug('[ml4kimport] importing', file.name);

            vm.state = 'importing';
            vm.filename = file.name;
            vm.imported = 0;
            vm.total = 0;
            vm.skipped = 0;
            vm.errors = [];

            projectCloneService.importProject(file, vm.profile, function (completed, total) {
                    vm.imported = completed;
                    vm.total = total;
                })
                .then(function (result) {
                    loggerService.debug('[ml4kimport] import complete', result);

                    importedproject = result.project;

                    vm.imported = result.imported;
                    vm.skipped = result.skipped;

                    if (result.skipped > 0) {
                        vm.state = 'reporting';
                    }
                    else {
                        vm.goToProject();
                    }
                })
                .catch(function (err) {
                    loggerService.error('[ml4kimport] import failed', err);

                    vm.state = 'error';
                    displayAlert('errors', err.status, {
                        message : (err && err.message) ?
                                    err.message :
                                    'Something went wrong opening this project file'
                    });
                });
        };


        vm.startAgain = function () {
            vm.state = 'choosing';
            vm.filename = undefined;
            vm.errors = [];
        };
    }


    mlProjectArchiveChooser.$inject = [];

    function mlProjectArchiveChooser() {
        return {
            restrict : 'A',
            scope : {
                onArchiveChosen : '&'
            },
            link : function (scope, element) {
                var node = element[0];

                function stop(ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }

                function chosen(file) {
                    if (!file) {
                        return;
                    }
                    scope.$apply(function () {
                        scope.onArchiveChosen({ file : file });
                    });
                }

                node.addEventListener('dragover', function (ev) {
                    stop(ev);
                    node.classList.add('mlimportdragover');
                });
                node.addEventListener('dragleave', function (ev) {
                    stop(ev);
                    node.classList.remove('mlimportdragover');
                });
                node.addEventListener('drop', function (ev) {
                    stop(ev);
                    node.classList.remove('mlimportdragover');

                    if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length > 0) {
                        chosen(ev.dataTransfer.files[0]);
                    }
                });

                var fileinput = node.querySelector('input[type="file"]');
                if (fileinput) {
                    fileinput.addEventListener('change', function () {
                        var file = this.files && this.files[0];
                        this.value = '';
                        chosen(file);
                    });
                }
            }
        };
    }
}());
