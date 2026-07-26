describe('ImageDescribeController', function () {

    var $controller;
    var $q;
    var $rootScope;
    var $scope;

    var authServiceMock, loggerServiceMock, browserStorageServiceMock, projectsServiceMock;
    var $stateParamsMock;

    var profile;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
        $scope = $rootScope.$new();
    }));

    beforeEach(function () {
        profile = { user_id : 'user1', tenant : 'class1' };

        authServiceMock = jasmine.createSpyObj('authService', ['getProfileDeferred', 'login']);
        authServiceMock.getProfileDeferred.and.returnValue($q.resolve(profile));

        projectsServiceMock = jasmine.createSpyObj('projectsService', ['getProject']);

        browserStorageServiceMock = jasmine.createSpyObj('browserStorageService', ['retrieveAsset']);

        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error', 'warn']);

        $stateParamsMock = { projectId : 'proj1', userId : 'user1', modelId : 'model1' };
    });

    function createController() {
        return $controller('ImageDescribeController', {
            authService : authServiceMock,
            loggerService : loggerServiceMock,
            browserStorageService : browserStorageServiceMock,
            projectsService : projectsServiceMock,
            $stateParams : $stateParamsMock,
            $scope : $scope
        });
    }


    describe('initial state', function () {

        it('sets loading and reads ids from $stateParams synchronously, before anything resolves', function () {
            projectsServiceMock.getProject.and.returnValue($q.defer().promise);

            createController();

            expect($scope.loading).toBe(true);
            expect($scope.projectId).toBe('proj1');
            expect($scope.userId).toBe('user1');
            expect($scope.modelId).toBe('model1');
            expect($scope.trainingHistory).toBeUndefined();
            expect($scope.chartData).toBeUndefined();
        });

    });


    describe('successful load', function () {

        it('fetches the project using the ids from $stateParams and the tenant from the profile', function () {
            projectsServiceMock.getProject.and.returnValue($q.resolve({ id : 'proj1' }));
            browserStorageServiceMock.retrieveAsset.and.returnValue($q.defer().promise);

            createController();
            $rootScope.$digest();

            expect(projectsServiceMock.getProject).toHaveBeenCalledWith('proj1', 'user1', 'class1');
        });

        it('requests the stored training history using the project id', function () {
            projectsServiceMock.getProject.and.returnValue($q.resolve({ id : 'proj1' }));
            browserStorageServiceMock.retrieveAsset.and.returnValue($q.defer().promise);

            createController();
            $rootScope.$digest();

            expect(browserStorageServiceMock.retrieveAsset).toHaveBeenCalledWith('proj1-history');
        });

        it('builds chartData from the stored training history and stops loading', function () {
            var project = { id : 'proj1' };
            var history = { epochs : [1, 2, 3], trainingLoss : [0.9, 0.5, 0.2] };
            projectsServiceMock.getProject.and.returnValue($q.resolve(project));
            browserStorageServiceMock.retrieveAsset.and.returnValue($q.resolve(history));

            createController();
            $rootScope.$digest();

            expect($scope.trainingHistory).toBe(history);
            expect($scope.chartData).toEqual({ epochs : [1, 2, 3], training : [0.9, 0.5, 0.2] });
            expect($scope.loading).toBe(false);
        });

    });


    describe('error handling', function () {

        it('shows a friendly warning (not an error) when there is no trained model yet', function () {
            var project = { id : 'proj1' };
            projectsServiceMock.getProject.and.returnValue($q.resolve(project));
            browserStorageServiceMock.retrieveAsset.and.returnValue($q.reject({ status : 404 }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors).toEqual([]);
            expect(vm.warnings.length).toBe(1);
            expect(vm.warnings[0].message).toBe('Model information is not available. Try training a new model.');
            expect($scope.loading).toBe(false);
        });

        it('shows a generic error (not the friendly warning) when the project itself 404s, since there is no project to be missing a model for', function () {
            projectsServiceMock.getProject.and.returnValue($q.reject({ status : 404, data : { message : 'project not found' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.warnings).toEqual([]);
            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toBe('project not found');
            expect($scope.loading).toBe(false);
        });

        it('shows a generic error alert with the server-provided message for a non-404 failure', function () {
            var project = { id : 'proj1' };
            projectsServiceMock.getProject.and.returnValue($q.resolve(project));
            browserStorageServiceMock.retrieveAsset.and.returnValue($q.reject({ status : 500, data : { error : 'server exploded' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toBe('server exploded');
            expect(vm.errors[0].status).toBe(500);
        });

        it('defaults the alert message to "Unknown error" when the failure has no message or error field', function () {
            var project = { id : 'proj1' };
            projectsServiceMock.getProject.and.returnValue($q.resolve(project));
            browserStorageServiceMock.retrieveAsset.and.returnValue($q.reject({ status : 500 }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors[0].message).toBe('Unknown error');
        });

    });


    describe('dismissAlert', function () {

        it('removes only the alert at the given index from the given list', function () {
            var vm = createController();
            vm.errors = [ { message : 'a' }, { message : 'b' }, { message : 'c' } ];

            vm.dismissAlert('errors', 1);

            expect(vm.errors).toEqual([ { message : 'a' }, { message : 'c' } ]);
        });

        it('operates on the warnings list when asked to', function () {
            var vm = createController();
            vm.warnings = [ { message : 'a' }, { message : 'b' } ];

            vm.dismissAlert('warnings', 0);

            expect(vm.warnings).toEqual([ { message : 'b' } ]);
        });

    });

});
