(function () {

    angular
        .module('app')
        .controller('ProjectCloneDialogController', ProjectCloneDialogController);

    ProjectCloneDialogController.$inject = [
        '$mdDialog',
        'projectCloneService', 'downloadService',
        'loggerService',
        'project', 'profile', 'storage'
    ];

    // the dialog shown when the storage icon on a project is clicked. it
    //  explains what that kind of storage means, and offers what can be done
    //  with a project held in it:
    //
    //   cloud projects - can be cloned into browser storage, and exported
    //   local projects - can be exported
    //
    // both operations can run for minutes on a project with a lot of images,
    //  so the dialog stays open while they run. the projects page reloads
    //  after a clone, so a report shown anywhere else would be destroyed by
    //  the reload
    function ProjectCloneDialogController(
        $mdDialog,
        projectCloneService, downloadService,
        loggerService,
        project, profile, storage)
    {
        var vm = this;

        vm.project = project;
        vm.storage = storage;

        var EXPORTABLE_TYPES = ['text', 'numbers', 'sounds', 'imgtfjs'];
        vm.canExport = EXPORTABLE_TYPES.indexOf(project.type) >= 0;


        // ---- cloning (cloud projects only) ----

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
            if (vm.state === 'cloning' || vm.exportstate === 'exporting') {
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


        // ---- exporting (both storages) ----

        // info -> exporting -> done | error
        vm.exportstate = 'info';

        vm.exportcopied = 0;
        vm.exporttotal = 0;
        vm.exportskipped = 0;
        vm.exportfilename = undefined;
        vm.exporterrormessage = undefined;


        vm.export = function () {
            if (vm.exportstate === 'exporting' || vm.state === 'cloning') {
                return;
            }

            loggerService.debug('[ml4kclonedlg] starting export', project.id);

            vm.exportstate = 'exporting';
            vm.exportcopied = 0;
            vm.exporttotal = 0;
            vm.exportskipped = 0;

            projectCloneService.exportProject(project, profile, function (completed, total) {
                    vm.exportcopied = completed;
                    vm.exporttotal = total;
                })
                .then(function (result) {
                    loggerService.debug('[ml4kclonedlg] export complete', result);

                    downloadService.downloadFile([ result.blob ], 'application/zip', result.filename);

                    vm.exportstate = 'done';
                    vm.exportskipped = result.skipped;
                    vm.exportfilename = result.filename;

                    // deliberately never closes itself, unlike cloning. a
                    //  clone visibly appears on the projects page behind the
                    //  dialog, but an export silently goes in downloads
                    // a dialog that vanished would leave a child with no sign 
                    //  that anything had happened
                })
                .catch(function (err) {
                    loggerService.error('[ml4kclonedlg] export failed', err);

                    vm.exportstate = 'error';
                    vm.exporterrormessage = (err && err.message) ?
                                                err.message :
                                                'Something went wrong saving this project';
                });
        };


        vm.close = function () {
            $mdDialog.hide(cloneproject);
        };
    }
}());
