describe('RegressionDescribeController', function () {

    var $controller;
    var $q;
    var $rootScope;
    var $scope;

    var authServiceMock, loggerServiceMock, browserStorageServiceMock, projectsServiceMock, scrollServiceMock;
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

        scrollServiceMock = jasmine.createSpyObj('scrollService', ['scrollToNewItem']);

        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error', 'warn']);

        $stateParamsMock = { projectId : 'proj1', userId : 'user1', modelId : 'model1' };
    });

    function createController() {
        return $controller('RegressionDescribeController', {
            authService : authServiceMock,
            loggerService : loggerServiceMock,
            browserStorageService : browserStorageServiceMock,
            projectsService : projectsServiceMock,
            scrollService : scrollServiceMock,
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
        });

    });


    describe('successful load', function () {

        it('builds chartData with both training and validation loss, and stops loading', function () {
            var project = { id : 'proj1' };
            var history = { epochs : [1, 2, 3], trainingLoss : [0.9, 0.5, 0.2], validationLoss : [1.0, 0.6, 0.3] };
            projectsServiceMock.getProject.and.returnValue($q.resolve(project));
            browserStorageServiceMock.retrieveAsset.and.returnValue($q.resolve(history));

            createController();
            $rootScope.$digest();

            expect(browserStorageServiceMock.retrieveAsset).toHaveBeenCalledWith('proj1-history');
            expect($scope.trainingHistory).toBe(history);
            expect($scope.chartData).toEqual({
                epochs : [1, 2, 3],
                training : [0.9, 0.5, 0.2],
                validation : [1.0, 0.6, 0.3]
            });
            expect($scope.loading).toBe(false);
        });

    });


    describe('error handling', function () {

        it('shows a friendly warning and scrolls to it when there is no trained model yet', function () {
            var project = { id : 'proj1' };
            projectsServiceMock.getProject.and.returnValue($q.resolve(project));
            browserStorageServiceMock.retrieveAsset.and.returnValue($q.reject({ status : 404 }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors).toEqual([]);
            expect(vm.warnings.length).toBe(1);
            expect(vm.warnings[0].message).toBe('Model information is not available. Try training a new model.');
            // regression check: the warning alert has no "errors<id>" element in the DOM,
            // so scrolling must target it by its own "warnings<id>" id, not "errors<id>"
            expect(scrollServiceMock.scrollToNewItem).toHaveBeenCalledWith('warnings1');
            expect($scope.loading).toBe(false);
        });

        it('shows a generic error (not the friendly warning) when the project itself 404s', function () {
            projectsServiceMock.getProject.and.returnValue($q.reject({ status : 404, data : { message : 'project not found' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.warnings).toEqual([]);
            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toBe('project not found');
            expect(scrollServiceMock.scrollToNewItem).toHaveBeenCalledWith('errors1');
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
            expect(scrollServiceMock.scrollToNewItem).toHaveBeenCalledWith('errors1');
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

    });

});
