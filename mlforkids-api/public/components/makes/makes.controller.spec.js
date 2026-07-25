describe('MakesController', function () {

    var $controller;
    var $q;
    var $rootScope;
    var $scope;

    var authServiceMock, loggerServiceMock, projectsServiceMock;
    var $stateParams;

    var profile;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
        $scope = $rootScope.$new();
    }));

    beforeEach(function () {
        profile = { user_id : 'user1', tenant : 'class1', role : 'student' };

        authServiceMock = {
            getProfileDeferred : jasmine.createSpy('getProfileDeferred').and.returnValue($q.resolve(profile))
        };
        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error']);
        projectsServiceMock = jasmine.createSpyObj('projectsService', ['getProject', 'supportedMakes']);

        $stateParams = { projectId : 'project1', userId : 'user1' };
    });

    function createController() {
        return $controller('MakesController', {
            authService : authServiceMock,
            loggerService : loggerServiceMock,
            $stateParams : $stateParams,
            $scope : $scope,
            projectsService : projectsServiceMock
        });
    }


    it('initialises projectId and userId from $stateParams, and starts loading', function () {
        createController();

        expect($scope.projectId).toBe('project1');
        expect($scope.userId).toBe('user1');
        expect($scope.loading).toBe(true);
    });

    it('loads the project and the makes it supports', function () {
        var project = { id : 'project1', type : 'text' };
        var makes = [ { id : 'scratch3' }, { id : 'app-inventor' } ];
        projectsServiceMock.getProject.and.returnValue($q.resolve(project));
        projectsServiceMock.supportedMakes.and.returnValue(makes);

        createController();
        $rootScope.$digest();

        expect(projectsServiceMock.getProject).toHaveBeenCalledWith('project1', 'user1', 'class1');
        expect(projectsServiceMock.supportedMakes).toHaveBeenCalledWith(project);
        expect($scope.project).toBe(project);
        expect($scope.makes).toBe(makes);
        expect($scope.loading).toBe(false);
    });

    it('records a failure if fetching the profile fails', function () {
        authServiceMock.getProfileDeferred.and.returnValue($q.reject({ status : 401, data : { error : 'not authorised' } }));

        createController();
        $rootScope.$digest();

        expect($scope.loading).toBe(false);
        expect($scope.failure).toEqual({ message : 'not authorised', status : 401 });
        expect(projectsServiceMock.getProject).not.toHaveBeenCalled();
    });

    it('records a failure if fetching the project fails', function () {
        projectsServiceMock.getProject.and.returnValue($q.reject({ status : 404, data : { error : 'project not found' } }));

        createController();
        $rootScope.$digest();

        expect($scope.loading).toBe(false);
        expect($scope.failure).toEqual({ message : 'project not found', status : 404 });
        expect($scope.makes).toBeUndefined();
    });

});
