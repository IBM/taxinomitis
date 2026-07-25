describe('Scratch3Controller', function () {

    var $controller;
    var $q;
    var $rootScope;
    var $scope;

    var authServiceMock, modelServiceMock, projectsServiceMock, scratchkeysServiceMock, loggerServiceMock;
    var $stateParams;

    var profile;
    var origin;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
        $scope = $rootScope.$new();
    }));

    beforeEach(function () {
        origin = window.location.origin;
        profile = { user_id : 'user1', tenant : 'class1', role : 'student' };

        authServiceMock = {
            getProfileDeferred : jasmine.createSpy('getProfileDeferred').and.returnValue($q.resolve(profile))
        };
        modelServiceMock = jasmine.createSpyObj('modelService', ['isModelSavedInBrowser']);
        modelServiceMock.isModelSavedInBrowser.and.returnValue(false);
        projectsServiceMock = jasmine.createSpyObj('projectsService', ['getProject']);
        scratchkeysServiceMock = jasmine.createSpyObj('scratchkeysService', ['getScratchKeys']);
        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error']);

        $stateParams = { projectId : 'project1', userId : 'user1' };
    });

    function createController() {
        return $controller('Scratch3Controller', {
            authService : authServiceMock,
            modelService : modelServiceMock,
            projectsService : projectsServiceMock,
            scratchkeysService : scratchkeysServiceMock,
            loggerService : loggerServiceMock,
            $stateParams : $stateParams,
            $scope : $scope
        });
    }

    // mirrors the escaping logic in Scratch3Controller's private escapeProjectName,
    // used to build expected values for locally-generated extension urls
    function escapeProjectName(input) {
        return input.replaceAll(/[\(\)!&<>]/g, ' ')
                    .replaceAll(/[']/g, '%27');
    }


    describe('initialisation', function () {

        it('sets projectId/userId and default projecturls from $stateParams before the profile loads', function () {
            createController();

            expect($scope.projectId).toBe('project1');
            expect($scope.userId).toBe('user1');
            expect($scope.projecturls.train).toBe('/#!/mlproject/user1/project1/training');
            expect($scope.projecturls.learnandtest).toBe('/#!/mlproject/user1/project1/models');
        });

    });


    describe('cloud projects', function () {

        it('fetches a scratch key for a non-local project, and does not append a query to the extension url', function () {
            var project = { id : 'project1', userid : 'user1', type : 'imgtfjs', storage : 'cloud', labels : [ 'a' ] };
            projectsServiceMock.getProject.and.returnValue($q.resolve(project));
            scratchkeysServiceMock.getScratchKeys.and.returnValue($q.resolve([ { id : 'key1' } ]));

            createController();
            $rootScope.$digest();

            expect(scratchkeysServiceMock.getScratchKeys).toHaveBeenCalledWith(project, 'user1', 'class1');
            expect($scope.project).toBe(project);
            expect($scope.projecturls.train).toBe('/#!/mlproject/user1/project1/training');
            expect($scope.projecturls.learnandtest).toBe('/#!/mlproject/user1/project1/models');
            expect($scope.scratchkey.id).toBe('key1');
            expect($scope.scratchkey.extensionurl).toBe(origin + '/api/scratch/key1/extension3.js');
        });

        it('marks the scratch key with a placeholder model when one is saved in the browser', function () {
            var project = { id : 'project1', userid : 'user1', type : 'imgtfjs', storage : 'cloud', labels : [ 'a' ] };
            projectsServiceMock.getProject.and.returnValue($q.resolve(project));
            scratchkeysServiceMock.getScratchKeys.and.returnValue($q.resolve([ { id : 'key1' } ]));
            modelServiceMock.isModelSavedInBrowser.and.returnValue(true);

            createController();
            $rootScope.$digest();

            expect(modelServiceMock.isModelSavedInBrowser).toHaveBeenCalledWith('imgtfjs', 'project1');
            expect($scope.scratchkey.model).toBe('placeholder');
        });

    });


    describe('text projects', function () {

        it('always fetches a scratch key, even when the project is stored locally', function () {
            var project = { id : 'localproj1', userid : 'user1', type : 'text', storage : 'local', labels : [ 'a' ] };
            projectsServiceMock.getProject.and.returnValue($q.resolve(project));
            scratchkeysServiceMock.getScratchKeys.and.returnValue($q.resolve([ { id : 'key1' } ]));

            createController();
            $rootScope.$digest();

            expect(scratchkeysServiceMock.getScratchKeys).toHaveBeenCalledWith(project, 'user1', 'class1');
            expect($scope.scratchkey.extensionurl).toBe(
                origin + '/api/scratch/key1/extension3.js' + encodeURIComponent('?projectid=localproj1')
            );
        });

    });


    describe('local (non-text) projects', function () {

        it('does not fetch a scratch key, and builds a local extension url from the project', function () {
            var project = { id : 'localproj2', userid : 'user1', name : 'My Project', type : 'imgtfjs', storage : 'local', labels : [ 'cat', 'dog' ] };
            projectsServiceMock.getProject.and.returnValue($q.resolve(project));

            createController();
            $rootScope.$digest();

            expect(scratchkeysServiceMock.getScratchKeys).not.toHaveBeenCalled();

            var expectedQuery = '?' + 'projectid=localproj2&' + 'projectname=' + escapeProjectName('My Project') + '&' + 'labelslist=cat,dog&';
            expect($scope.scratchkey).toEqual(jasmine.objectContaining({
                id : 'localproj2',
                name : 'My Project',
                type : 'imgtfjs',
                extensionurl : origin + '/api/scratch/localproject/local/imgtfjs/extension3.js' + encodeURIComponent(expectedQuery)
            }));
        });

        it('escapes special characters in the project name', function () {
            var project = { id : 'localproj3', userid : 'user1', name : "It's (Fun)!", type : 'sounds', storage : 'local', labels : [ 'a' ] };
            projectsServiceMock.getProject.and.returnValue($q.resolve(project));

            createController();
            $rootScope.$digest();

            var decodedQuery = decodeURIComponent(
                $scope.scratchkey.extensionurl.split('extension3.js')[1]
            );
            expect(decodedQuery).toContain('projectname=' + escapeProjectName("It's (Fun)!"));
        });

        it('marks the scratch key with a placeholder model when one is saved in the browser', function () {
            var project = { id : 'localproj2', userid : 'user1', name : 'My Project', type : 'imgtfjs', storage : 'local', labels : [ 'cat' ] };
            projectsServiceMock.getProject.and.returnValue($q.resolve(project));
            modelServiceMock.isModelSavedInBrowser.and.returnValue(true);

            createController();
            $rootScope.$digest();

            expect($scope.scratchkey.model).toBe('placeholder');
        });

        it('sets input/output labels and a columns query for a regression project with columns', function () {
            var project = {
                id : 'localproj4', userid : 'user1', name : 'Regr', type : 'regression', storage : 'local',
                columns : [ { label : 'x', output : false }, { label : 'y', output : true } ]
            };
            projectsServiceMock.getProject.and.returnValue($q.resolve(project));

            createController();
            $rootScope.$digest();

            expect($scope.project.labels).toEqual([ 'input', 'output' ]);
            expect($scope.project.hasOutput).toBe(true);

            var decodedQuery = decodeURIComponent($scope.scratchkey.extensionurl.split('extension3.js')[1]);
            expect(decodedQuery).toContain('columns=' + JSON.stringify([ { label : 'x', output : false }, { label : 'y', output : true } ]));
        });

        it('sets hasOutput to false when no regression column is an output', function () {
            var project = {
                id : 'localproj5', userid : 'user1', name : 'Regr', type : 'regression', storage : 'local',
                columns : [ { label : 'x', output : false } ]
            };
            projectsServiceMock.getProject.and.returnValue($q.resolve(project));

            createController();
            $rootScope.$digest();

            expect($scope.project.hasOutput).toBe(false);
        });

        it('adds a userid/fields query for a numbers project', function () {
            var project = {
                id : 'localproj6', userid : 'user1', name : 'Nums', type : 'numbers', storage : 'local',
                labels : [ 'a' ], fields : [ { name : 'age', type : 'number' } ]
            };
            projectsServiceMock.getProject.and.returnValue($q.resolve(project));

            createController();
            $rootScope.$digest();

            var decodedQuery = decodeURIComponent($scope.scratchkey.extensionurl.split('extension3.js')[1]);
            expect(decodedQuery).toContain('userid=user1');
            expect(decodedQuery).toContain('fields=' + JSON.stringify(project.fields));
        });

    });


    describe('error handling', function () {

        it('records a failure if fetching the profile fails', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.reject({ status : 401, data : { error : 'not authorised' } }));

            createController();
            $rootScope.$digest();

            expect($scope.failure).toEqual({ message : 'not authorised', status : 401 });
            expect(projectsServiceMock.getProject).not.toHaveBeenCalled();
        });

        it('records a failure if fetching the project fails', function () {
            projectsServiceMock.getProject.and.returnValue($q.reject({ status : 404, data : { error : 'project not found' } }));

            createController();
            $rootScope.$digest();

            expect($scope.failure).toEqual({ message : 'project not found', status : 404 });
        });

        it('records a failure if fetching the scratch key fails', function () {
            var project = { id : 'project1', userid : 'user1', type : 'imgtfjs', storage : 'cloud', labels : [ 'a' ] };
            projectsServiceMock.getProject.and.returnValue($q.resolve(project));
            scratchkeysServiceMock.getScratchKeys.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            createController();
            $rootScope.$digest();

            expect($scope.failure).toEqual({ message : 'server error', status : 500 });
        });

    });

});
