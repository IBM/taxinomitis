describe('ProjectCloneDialogController', function () {

    var $controller;
    var $q;
    var $rootScope;

    var $mdDialogMock, projectCloneServiceMock, loggerServiceMock;

    var project, profile;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
    }));

    beforeEach(function () {
        project = { id : 'cloud1', name : 'Sentiment', type : 'text' };
        profile = { user_id : 'user1', tenant : 'class1' };

        $mdDialogMock = jasmine.createSpyObj('$mdDialog', ['hide', 'cancel']);
        projectCloneServiceMock = jasmine.createSpyObj('projectCloneService', ['cloneProject']);
        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error']);
    });

    function createController() {
        return $controller('ProjectCloneDialogController', {
            $mdDialog : $mdDialogMock,
            projectCloneService : projectCloneServiceMock,
            loggerService : loggerServiceMock,
            project : project,
            profile : profile
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

});
