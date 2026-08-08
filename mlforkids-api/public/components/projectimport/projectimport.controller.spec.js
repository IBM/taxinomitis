describe('ProjectImportController', function () {

    var $controller;
    var $q;
    var $rootScope;

    var authServiceMock, projectCloneServiceMock, loggerServiceMock, $stateMock;

    var profile;
    var archivefile;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
    }));

    beforeEach(function () {
        profile = { user_id : 'user1', tenant : 'class1' };

        // a File in every browser that matters, and near enough to one for a
        //  controller that only passes it straight through to the service
        archivefile = new Blob([ 'pretend this is a zip' ], { type : 'application/zip' });
        archivefile.name = 'Sentiment.zip';

        authServiceMock = jasmine.createSpyObj('authService', ['getProfileDeferred', 'login']);
        authServiceMock.getProfileDeferred.and.returnValue($q.resolve(profile));

        projectCloneServiceMock = jasmine.createSpyObj('projectCloneService', ['importProject']);
        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error']);
        $stateMock = jasmine.createSpyObj('$state', ['go']);
    });

    function createController() {
        return $controller('ProjectImportController', {
            authService : authServiceMock,
            projectCloneService : projectCloneServiceMock,
            loggerService : loggerServiceMock,
            $state : $stateMock
        });
    }


    it('starts by waiting for a file, without importing anything', function () {
        var vm = createController();
        $rootScope.$digest();

        expect(vm.state).toBe('choosing');
        expect(projectCloneServiceMock.importProject).not.toHaveBeenCalled();
    });


    it('imports the file it is given, as the current user', function () {
        projectCloneServiceMock.importProject.and.returnValue($q.defer().promise);

        var vm = createController();
        $rootScope.$digest();

        vm.importArchive(archivefile);

        expect(projectCloneServiceMock.importProject)
            .toHaveBeenCalledWith(archivefile, profile, jasmine.any(Function));
        expect(vm.state).toBe('importing');
        expect(vm.filename).toBe('Sentiment.zip');
    });


    it('does nothing when no file was chosen', function () {
        // the file picker can be opened and cancelled
        var vm = createController();
        $rootScope.$digest();

        vm.importArchive(undefined);

        expect(projectCloneServiceMock.importProject).not.toHaveBeenCalled();
        expect(vm.state).toBe('choosing');
    });


    it('shows progress while the import runs', function () {
        projectCloneServiceMock.importProject.and.returnValue($q.defer().promise);

        var vm = createController();
        $rootScope.$digest();
        vm.importArchive(archivefile);

        var onProgress = projectCloneServiceMock.importProject.calls.mostRecent().args[2];
        onProgress(7, 20);

        expect(vm.imported).toBe(7);
        expect(vm.total).toBe(20);
    });


    it('goes to the new project when everything was imported', function () {
        // navigating with the project highlighted is what prompts the browser
        //  for persistent storage - without it the new project is the most
        //  evictable thing on the page
        projectCloneServiceMock.importProject.and.returnValue($q.resolve({
            project : { id : 12 }, imported : 20, skipped : 0, testdata : false
        }));

        var vm = createController();
        $rootScope.$digest();

        vm.importArchive(archivefile);
        $rootScope.$digest();

        expect($stateMock.go).toHaveBeenCalledWith('projects', { id : 12 });
    });


    it('stops to report examples that could not be imported', function () {
        // the projects page has nowhere to show this, so navigating straight
        //  there would silently lose it
        projectCloneServiceMock.importProject.and.returnValue($q.resolve({
            project : { id : 12 }, imported : 18, skipped : 2, testdata : false
        }));

        var vm = createController();
        $rootScope.$digest();

        vm.importArchive(archivefile);
        $rootScope.$digest();

        expect(vm.state).toBe('reporting');
        expect(vm.skipped).toBe(2);
        expect(vm.imported).toBe(18);
        expect($stateMock.go).not.toHaveBeenCalled();
    });


    it('goes to the new project once a partial import is acknowledged', function () {
        projectCloneServiceMock.importProject.and.returnValue($q.resolve({
            project : { id : 12 }, imported : 18, skipped : 2, testdata : false
        }));

        var vm = createController();
        $rootScope.$digest();

        vm.importArchive(archivefile);
        $rootScope.$digest();

        vm.goToProject();

        expect($stateMock.go).toHaveBeenCalledWith('projects', { id : 12 });
    });


    it('reports a file it could not open', function () {
        // callFake rather than returnValue - a rejected promise built at spy
        //  setup time has no handler attached when the profile digest runs,
        //  which $q reports as an unhandled rejection
        projectCloneServiceMock.importProject.and.callFake(function () {
            return $q.reject(new Error('This file is not a project archive'));
        });

        var vm = createController();
        $rootScope.$digest();

        vm.importArchive(archivefile);
        $rootScope.$digest();

        expect(vm.state).toBe('error');
        expect(vm.errors.length).toBe(1);
        expect(vm.errors[0].message).toBe('This file is not a project archive');
        expect($stateMock.go).not.toHaveBeenCalled();
    });


    it('lets the child try a different file after a failure', function () {
        projectCloneServiceMock.importProject.and.callFake(function () {
            return $q.reject(new Error('This file is not a project archive'));
        });

        var vm = createController();
        $rootScope.$digest();

        vm.importArchive(archivefile);
        $rootScope.$digest();

        vm.startAgain();

        expect(vm.state).toBe('choosing');
        expect(vm.errors).toEqual([]);
    });


    it('cannot be started twice', function () {
        projectCloneServiceMock.importProject.and.returnValue($q.defer().promise);

        var vm = createController();
        $rootScope.$digest();

        vm.importArchive(archivefile);
        vm.importArchive(archivefile);

        expect(projectCloneServiceMock.importProject).toHaveBeenCalledTimes(1);
    });


    it('clears an earlier failure when a new file is chosen', function () {
        var vm = createController();
        $rootScope.$digest();

        projectCloneServiceMock.importProject.and.callFake(function () {
            return $q.reject(new Error('nope'));
        });
        vm.importArchive(archivefile);
        $rootScope.$digest();
        expect(vm.errors.length).toBe(1);

        projectCloneServiceMock.importProject.and.returnValue($q.defer().promise);
        vm.importArchive(archivefile);

        expect(vm.errors).toEqual([]);
    });
});
