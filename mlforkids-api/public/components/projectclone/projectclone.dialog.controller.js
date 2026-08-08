(function () {

    angular
        .module('app')
        .controller('ProjectCloneDialogController', ProjectCloneDialogController);

    ProjectCloneDialogController.$inject = [
        '$mdDialog',
        'projectCloneService',
        'loggerService',
        'project', 'profile'
    ];

    // the dialog shown when the cloud-storage icon on the projects page is
    //  clicked. it explains what cloud storage means, and offers to clone the
    //  project into browser storage.
    //
    // If the user clones their cloud project, the dialog will remain open 
    //  while the clone runs. The projects page reloads once it closes,
    //  so a report shown anywhere else would be destroyed by the reload
    function ProjectCloneDialogController($mdDialog, projectCloneService, loggerService, project, profile) {

        var vm = this;

        vm.project = project;

        // info -> cloning -> done | error
        vm.state = 'info';

        vm.copied = 0;
        vm.total = 0;
        vm.skipped = 0;
        vm.testdata = false;
        vm.errormessage = undefined;

        // the new local project, once there is one. handed back to the
        //  projects page so it can navigate to it - which is also what
        //  triggers the persistent-storage request that stops the browser
        //  evicting the clone
        var cloneproject;


        vm.clone = function () {
            if (vm.state === 'cloning') {
                return;
            }

            loggerService.debug('[ml4kclonedlg] starting clone', project.id);

            vm.state = 'cloning';
            vm.copied = 0;
            vm.total = 0;
            vm.skipped = 0;

            projectCloneService.cloneProject(project, profile, function (completed, total) {
                    vm.copied = completed;
                    vm.total = total;
                })
                .then(function (result) {
                    loggerService.debug('[ml4kclonedlg] clone complete', result);

                    cloneproject = result.project;

                    vm.state = 'done';
                    vm.copied = result.copied;
                    vm.skipped = result.skipped;
                    vm.testdata = result.testdata;

                    if (vm.skipped === 0 && !vm.testdata) {
                        // nothing to report, so don't make them dismiss it
                        vm.close();
                    }
                })
                .catch(function (err) {
                    loggerService.error('[ml4kclonedlg] clone failed', err);

                    vm.state = 'error';
                    vm.errormessage = (err && err.message) ?
                                        err.message :
                                        'Something went wrong copying this project';
                });
        };


        vm.close = function () {
            $mdDialog.hide(cloneproject);
        };
    }
}());
