describe('ProjectCloneDialogController', function () {

    var $controller;
    var $q;
    var $rootScope;

    var $mdDialogMock, projectCloneServiceMock, downloadServiceMock, loggerServiceMock;

    var project, profile, storage;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
    }));

    beforeEach(function () {
        project = { id : 'cloud1', name : 'Sentiment', type : 'text' };
        profile = { user_id : 'user1', tenant : 'class1' };
        // the dialog serves both storages now - cloning is only offered for
        //  cloud projects, exporting for either
        storage = 'cloud';

        $mdDialogMock = jasmine.createSpyObj('$mdDialog', ['hide', 'cancel']);
        projectCloneServiceMock = jasmine.createSpyObj('projectCloneService',
                                                       ['cloneProject', 'exportProject']);
        downloadServiceMock = jasmine.createSpyObj('downloadService', ['downloadFile']);
        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error']);
    });

    function createController() {
        return $controller('ProjectCloneDialogController', {
            $mdDialog : $mdDialogMock,
            projectCloneService : projectCloneServiceMock,
            downloadService : downloadServiceMock,
            loggerService : loggerServiceMock,
            project : project,
            profile : profile,
            storage : storage
        });
    }


    it('starts by describing the project, without cloning anything', function () {
        var vm = createController();

        expect(vm.state).toBe('info');
        expect(vm.project).toBe(project);
        expect(projectCloneServiceMock.cloneProject).not.toHaveBeenCalled();
    });


    it('shows progress while the clone runs', function () {
        var progressFn;
        projectCloneServiceMock.cloneProject.and.callFake(function (proj, prof, onProgress) {
            progressFn = onProgress;
            return $q.defer().promise;
        });

        var vm = createController();
        vm.clone();

        expect(vm.state).toBe('cloning');

        progressFn(3, 10);
        expect(vm.copied).toBe(3);
        expect(vm.total).toBe(10);
    });


    it('reports how many examples were copied when it finishes', function () {
        projectCloneServiceMock.cloneProject.and.returnValue($q.resolve({
            project : { id : 7 }, copied : 10, skipped : 0
        }));

        var vm = createController();
        vm.clone();
        $rootScope.$digest();

        expect(vm.state).toBe('done');
        expect(vm.copied).toBe(10);
        expect(vm.skipped).toBe(0);
    });


    it('does not close itself when examples were skipped', function () {
        // a partial clone has something to tell the user, so it waits to be
        //  acknowledged rather than disappearing
        projectCloneServiceMock.cloneProject.and.returnValue($q.resolve({
            project : { id : 7 }, copied : 8, skipped : 2
        }));

        var vm = createController();
        vm.clone();
        $rootScope.$digest();

        expect(vm.state).toBe('done');
        expect(vm.skipped).toBe(2);
        expect($mdDialogMock.hide).not.toHaveBeenCalled();
    });


    it('reports that dataset test data was copied across', function () {
        projectCloneServiceMock.cloneProject.and.returnValue($q.resolve({
            project : { id : 7 }, copied : 10, skipped : 0, testdata : true
        }));

        var vm = createController();
        vm.clone();
        $rootScope.$digest();

        expect(vm.state).toBe('done');
        expect(vm.testdata).toBe(true);
    });


    it('stays open when test data was copied, so the user finds out it happened', function () {
        // otherwise the dialog closes itself on a clean clone and the user
        //  never learns their test data came across too
        projectCloneServiceMock.cloneProject.and.returnValue($q.resolve({
            project : { id : 7 }, copied : 10, skipped : 0, testdata : true
        }));

        var vm = createController();
        vm.clone();
        $rootScope.$digest();

        expect($mdDialogMock.hide).not.toHaveBeenCalled();
    });


    it('closes itself with the new project when everything copied cleanly', function () {
        projectCloneServiceMock.cloneProject.and.returnValue($q.resolve({
            project : { id : 7 }, copied : 10, skipped : 0
        }));

        var vm = createController();
        vm.clone();
        $rootScope.$digest();

        expect($mdDialogMock.hide).toHaveBeenCalledWith({ id : 7 });
    });


    it('hands the new project back when a partial clone is acknowledged', function () {
        projectCloneServiceMock.cloneProject.and.returnValue($q.resolve({
            project : { id : 7 }, copied : 8, skipped : 2
        }));

        var vm = createController();
        vm.clone();
        $rootScope.$digest();

        vm.close();

        expect($mdDialogMock.hide).toHaveBeenCalledWith({ id : 7 });
    });


    it('explains a failure instead of closing', function () {
        projectCloneServiceMock.cloneProject.and.returnValue(
            $q.reject(new Error('Your web browser cannot store projects')));

        var vm = createController();
        vm.clone();
        $rootScope.$digest();

        expect(vm.state).toBe('error');
        expect(vm.errormessage).toBe('Your web browser cannot store projects');
        expect($mdDialogMock.hide).not.toHaveBeenCalled();
    });


    it('closes without a project when a failed clone is dismissed', function () {
        // nothing was created, so there is nothing for the projects page to
        //  navigate to
        projectCloneServiceMock.cloneProject.and.returnValue($q.reject(new Error('nope')));

        var vm = createController();
        vm.clone();
        $rootScope.$digest();

        vm.close();

        expect($mdDialogMock.hide).toHaveBeenCalledWith(undefined);
    });


    it('cannot be started twice', function () {
        projectCloneServiceMock.cloneProject.and.returnValue($q.defer().promise);

        var vm = createController();
        vm.clone();
        vm.clone();

        expect(projectCloneServiceMock.cloneProject).toHaveBeenCalledTimes(1);
    });


    describe('exporting', function () {

        var archive;

        beforeEach(function () {
            archive = {
                blob : new Blob([ 'pretend this is a zip' ]),
                filename : 'Sentiment.zip',
                exported : 12,
                skipped : 0,
                testdata : false
            };
        });


        it('starts without exporting anything', function () {
            var vm = createController();

            expect(vm.exportstate).toBe('info');
            expect(projectCloneServiceMock.exportProject).not.toHaveBeenCalled();
        });


        it('gives the archive to the browser to save', function () {
            projectCloneServiceMock.exportProject.and.returnValue($q.resolve(archive));

            var vm = createController();
            vm.export();
            $rootScope.$digest();

            expect(downloadServiceMock.downloadFile)
                .toHaveBeenCalledWith([ archive.blob ], 'application/zip', 'Sentiment.zip');
        });


        it('shows progress while the export runs', function () {
            var deferred = $q.defer();
            projectCloneServiceMock.exportProject.and.returnValue(deferred.promise);

            var vm = createController();
            vm.export();

            expect(vm.exportstate).toBe('exporting');

            var onProgress = projectCloneServiceMock.exportProject.calls.mostRecent().args[2];
            onProgress(3, 10);

            expect(vm.exportcopied).toBe(3);
            expect(vm.exporttotal).toBe(10);
        });


        it('stays open to say the file was saved', function () {
            // unlike a clone, which visibly appears on the projects page behind
            //  the dialog, an export lands silently in a downloads folder. a
            //  dialog that closed itself would leave no sign anything happened
            projectCloneServiceMock.exportProject.and.returnValue($q.resolve(archive));

            var vm = createController();
            vm.export();
            $rootScope.$digest();

            expect(vm.exportstate).toBe('done');
            expect(vm.exportfilename).toBe('Sentiment.zip');
            expect($mdDialogMock.hide).not.toHaveBeenCalled();
        });


        it('reports examples that could not be saved', function () {
            archive.skipped = 4;
            projectCloneServiceMock.exportProject.and.returnValue($q.resolve(archive));

            var vm = createController();
            vm.export();
            $rootScope.$digest();

            expect(vm.exportstate).toBe('done');
            expect(vm.exportskipped).toBe(4);
        });


        it('reports a failed export', function () {
            projectCloneServiceMock.exportProject
                .and.returnValue($q.reject(new Error('Your web browser ran out of memory')));

            var vm = createController();
            vm.export();
            $rootScope.$digest();

            expect(vm.exportstate).toBe('error');
            expect(vm.exporterrormessage).toBe('Your web browser ran out of memory');
        });


        it('cannot be started twice', function () {
            projectCloneServiceMock.exportProject.and.returnValue($q.defer().promise);

            var vm = createController();
            vm.export();
            vm.export();

            expect(projectCloneServiceMock.exportProject).toHaveBeenCalledTimes(1);
        });


        it('will not run while a clone is running', function () {
            projectCloneServiceMock.cloneProject.and.returnValue($q.defer().promise);

            var vm = createController();
            vm.clone();
            vm.export();

            expect(projectCloneServiceMock.exportProject).not.toHaveBeenCalled();
        });


        it('will not clone while an export is running', function () {
            projectCloneServiceMock.exportProject.and.returnValue($q.defer().promise);

            var vm = createController();
            vm.export();
            vm.clone();

            expect(projectCloneServiceMock.cloneProject).not.toHaveBeenCalled();
        });


        it('is offered for a local project', function () {
            storage = 'local';

            var vm = createController();

            expect(vm.canExport).toBe(true);
            expect(vm.storage).toBe('local');
        });


        it('is not offered for a project type that has no archive format', function () {
            // a language project's model is a blob far too big to put in a file
            //  a child is meant to share, and regression projects exist in
            //  browser storage only
            project = { id : 3, name : 'Poems', type : 'language', storage : 'local' };
            storage = 'local';

            var vm = createController();

            expect(vm.canExport).toBe(false);
        });


        it('is not offered for a regression project', function () {
            project = { id : 4, name : 'House prices', type : 'regression', storage : 'local' };
            storage = 'local';

            var vm = createController();

            expect(vm.canExport).toBe(false);
        });
    });

});
