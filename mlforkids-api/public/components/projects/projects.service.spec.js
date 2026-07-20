describe('projectsService', function () {

    var $httpBackend;
    var $q;
    var $rootScope;
    var projectsService;
    var browserStorageServiceMock;

    var profile = { user_id : 'user1', tenant : 'class1' };

    beforeEach(function () {
        browserStorageServiceMock = jasmine.createSpyObj('browserStorageService', [
            'getProjects', 'idIsLocal', 'getProject', 'deleteProject'
        ]);

        module('app', function ($provide) {
            $provide.value('browserStorageService', browserStorageServiceMock);
        });

        inject(function (_$httpBackend_, _$q_, _$rootScope_, _projectsService_) {
            $httpBackend = _$httpBackend_;
            $q = _$q_;
            $rootScope = _$rootScope_;
            projectsService = _projectsService_;
        });
    });

    afterEach(function () {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });


    describe('getProjects', function () {

        it('combines cloud projects with locally-stored projects', function () {
            var cloudProjects = [ { id : 'cloud1', name : 'Cloud project' } ];
            var localProjects = [ { id : 'local1', name : 'Local project' } ];

            browserStorageServiceMock.getProjects.and.returnValue($q.resolve(localProjects));

            $httpBackend.expectGET('/api/classes/class1/students/user1/projects')
                .respond(200, cloudProjects);

            var result;
            projectsService.getProjects(profile).then(function (projects) {
                result = projects;
            });

            $httpBackend.flush();

            expect(browserStorageServiceMock.getProjects).toHaveBeenCalledWith('user1');
            expect(result).toEqual(cloudProjects.concat(localProjects));
        });

    });


    describe('deleteProject', function () {

        it('deletes a cloud-stored project via the API', function () {
            var project = { id : 'proj1', storage : 'cloud' };

            $httpBackend.expectDELETE('/api/classes/class1/students/user1/projects/proj1')
                .respond(204);

            projectsService.deleteProject(project, 'user1', 'class1');

            $httpBackend.flush();

            expect(browserStorageServiceMock.deleteProject).not.toHaveBeenCalled();
        });

        it('deletes a locally-stored project from browser storage, without an API call', function () {
            var project = { id : 'proj2', storage : 'local', type : 'numbers' };

            browserStorageServiceMock.deleteProject.and.returnValue($q.resolve());

            projectsService.deleteProject(project, 'user1', 'class1');

            expect(browserStorageServiceMock.deleteProject).toHaveBeenCalledWith('proj2');
        });

        it('also deletes the cloud reference for a shared local text project', function () {
            var project = { id : 'proj3', storage : 'local', type : 'text', cloudid : 'cloudref1' };

            browserStorageServiceMock.deleteProject.and.returnValue($q.resolve());

            $httpBackend.expectDELETE('/api/classes/class1/students/user1/localprojects/cloudref1')
                .respond(204);

            projectsService.deleteProject(project, 'user1', 'class1');

            $httpBackend.flush();
        });

    });

});
