describe('ProjectsController', function () {

    var $controller;
    var $q;
    var $rootScope;
    var $scope;

    var authServiceMock, projectsServiceMock, modelServiceMock, browserStorageServiceMock;
    var cleanupServiceMock, loggerServiceMock;
    var $stateParamsMock, $translateMock, $mdDialogMock;

    var profile = { user_id : 'user1', tenant : 'class1' };

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
        $scope = $rootScope.$new();
    }));

    beforeEach(function () {
        authServiceMock = {
            getProfileDeferred : jasmine.createSpy('getProfileDeferred').and.returnValue($q.resolve(profile))
        };
        projectsServiceMock = jasmine.createSpyObj('projectsService', [
            'getProjects', 'deleteProject', 'shareProject', 'checkProjectCredentials'
        ]);
        modelServiceMock = jasmine.createSpyObj('modelService', ['generateProjectSummary']);
        browserStorageServiceMock = jasmine.createSpyObj('browserStorageService', [
            'requestPersistentStorage', 'deleteAsset'
        ]);
        cleanupServiceMock = jasmine.createSpyObj('cleanupService', ['deleteProject']);
        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error']);

        $stateParamsMock = { id : undefined };
        $translateMock = jasmine.createSpy('$translate').and.returnValue($q.resolve({}));
        $mdDialogMock = jasmine.createSpyObj('$mdDialog', ['confirm', 'show', 'alert']);
    });

    function createController() {
        return $controller('ProjectsController', {
            authService : authServiceMock,
            projectsService : projectsServiceMock,
            modelService : modelServiceMock,
            browserStorageService : browserStorageServiceMock,
            $stateParams : $stateParamsMock,
            $translate : $translateMock,
            $mdDialog : $mdDialogMock,
            $scope : $scope,
            cleanupService : cleanupServiceMock,
            loggerService : loggerServiceMock
        });
    }


    it('loads the profile and populates the projects list', function () {
        var projects = [
            { id : 'proj1', type : 'text', labels : ['cat', 'dog'] }
        ];
        projectsServiceMock.getProjects.and.returnValue($q.resolve(projects));
        modelServiceMock.generateProjectSummary.and.returnValue('cat or dog');

        var vm = createController();
        $rootScope.$digest();

        expect(vm.profile).toEqual(profile);
        expect(vm.projects).toEqual(projects);
        expect(vm.projects[0].labelsSummary).toBe('cat or dog');
    });

    it('excludes the background-noise label from sound project summaries', function () {
        var projects = [
            { id : 'proj1', type : 'sounds', labels : ['clap', '_background_noise_'] }
        ];
        projectsServiceMock.getProjects.and.returnValue($q.resolve(projects));
        modelServiceMock.generateProjectSummary.and.returnValue('clap');

        createController();
        $rootScope.$digest();

        expect(modelServiceMock.generateProjectSummary).toHaveBeenCalledWith(['clap'], ' or ');
    });

    it('records an error alert if fetching the profile fails', function () {
        authServiceMock.getProfileDeferred.and.returnValue($q.reject({ status : 401, data : { error : 'not authorised' } }));

        var vm = createController();
        $rootScope.$digest();

        expect(vm.errors.length).toBe(1);
        expect(vm.errors[0].status).toBe(401);
        expect(vm.errors[0].message).toBe('not authorised');
    });

    it('dismissAlert removes the alert at the given index', function () {
        var vm = createController();
        vm.errors = [ { alertid : 1 }, { alertid : 2 } ];

        vm.dismissAlert('errors', 0);

        expect(vm.errors.length).toBe(1);
        expect(vm.errors[0].alertid).toBe(2);
    });


    describe('deleteProject', function () {

        var project;

        beforeEach(function () {
            projectsServiceMock.getProjects.and.returnValue($q.resolve([]));
            project = { id : 'proj1', name : 'My project', storage : 'cloud', type : 'text' };
        });

        it('removes the project from the list when the user confirms and the delete succeeds', function () {
            var vm = createController();
            $rootScope.$digest();
            vm.projects = [ project ];

            $mdDialogMock.confirm.and.returnValue({
                title : function () { return this; },
                textContent : function () { return this; },
                ariaLabel : function () { return this; },
                targetEvent : function () { return this; },
                ok : function () { return this; },
                cancel : function () { return this; }
            });
            $mdDialogMock.show.and.returnValue($q.resolve());
            projectsServiceMock.deleteProject.and.returnValue($q.resolve());

            vm.deleteProject({}, project);
            $rootScope.$digest();

            expect(vm.projects.length).toBe(0);
            expect(cleanupServiceMock.deleteProject).toHaveBeenCalledWith(project);
        });

        it('leaves the project list unchanged when the user cancels the confirmation', function () {
            var vm = createController();
            $rootScope.$digest();
            vm.projects = [ project ];

            $mdDialogMock.confirm.and.returnValue({
                title : function () { return this; },
                textContent : function () { return this; },
                ariaLabel : function () { return this; },
                targetEvent : function () { return this; },
                ok : function () { return this; },
                cancel : function () { return this; }
            });
            $mdDialogMock.show.and.returnValue($q.reject());

            vm.deleteProject({}, project);
            $rootScope.$digest();

            expect(vm.projects.length).toBe(1);
            expect(projectsServiceMock.deleteProject).not.toHaveBeenCalled();
        });

    });

});
