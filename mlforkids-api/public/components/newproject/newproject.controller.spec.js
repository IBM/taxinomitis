describe('NewProjectController', function () {

    var $controller;
    var $q;
    var $rootScope;
    var $scope;

    var authServiceMock, projectsServiceMock, browserStorageServiceMock, loggerServiceMock;
    var $stateMock, $translateMock;

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
        projectsServiceMock = jasmine.createSpyObj('projectsService', ['createProject']);
        browserStorageServiceMock = jasmine.createSpyObj('browserStorageService', ['isSupported']);
        browserStorageServiceMock.isSupported.and.returnValue($q.resolve(1));
        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error']);

        $stateMock = jasmine.createSpyObj('$state', ['go']);

        $translateMock = jasmine.createSpy('$translate').and.returnValue($q.resolve({
            'NEWPROJECT.ERRORS.EXCEEDLIMIT' : 'You have reached the limit for the number of projects you can have.',
            'NEWPROJECT.ERRORS.TRYITNOW' : 'You can only create one project at a time if you use "Try it now".'
        }));
        $translateMock.use = jasmine.createSpy('use').and.returnValue('en');
    });

    function createController() {
        return $controller('NewProjectController', {
            authService : authServiceMock,
            projectsService : projectsServiceMock,
            browserStorageService : browserStorageServiceMock,
            loggerService : loggerServiceMock,
            $state : $stateMock,
            $rootScope : $rootScope,
            $scope : $scope,
            $translate : $translateMock
        });
    }


    it('loads the profile', function () {
        var vm = createController();
        $rootScope.$digest();

        expect(vm.profile).toEqual(profile);
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

    it('checks whether local project storage is supported', function () {
        createController();
        $rootScope.$digest();

        expect($scope.isLocalSupported).toBe(true);
    });


    describe('vm.focused', function () {

        it('defaults to the crowdsourced option for teachers', function () {
            $rootScope.isTeacher = true;
            var vm = createController();

            expect(vm.focused).toBe('crowdsourced');
        });

        it('defaults to the name field for students', function () {
            $rootScope.isTeacher = false;
            var vm = createController();

            expect(vm.focused).toBe('name');
        });

    });


    describe('$scope.language', function () {

        it('uses the site language when it is a supported project language', function () {
            $translateMock.use.and.returnValue('fr');
            createController();

            expect($scope.language).toBe('fr');
        });

        it('maps nl-be to nl', function () {
            $translateMock.use.and.returnValue('nl-be');
            createController();

            expect($scope.language).toBe('nl');
        });

        it('falls back to the universal language for unsupported site languages', function () {
            $translateMock.use.and.returnValue('pl');
            createController();

            expect($scope.language).toBe('xx');
        });

    });


    describe('$scope.isInvalid', function () {

        var vm;

        beforeEach(function () {
            vm = createController();
        });

        it('is not invalid for non-numbers project types', function () {
            expect($scope.isInvalid('text')).toBe(false);
        });

        it('is invalid when there are no fields for a numbers project', function () {
            vm.fields = [];
            expect($scope.isInvalid('numbers')).toBe(true);
        });

        it('is invalid when there are more than 10 fields', function () {
            vm.fields = new Array(11).fill({ type : 'number' });
            expect($scope.isInvalid('numbers')).toBe(true);
        });

        it('is valid with between 1 and 10 simple number fields', function () {
            vm.fields = [ { type : 'number' } ];
            expect($scope.isInvalid('numbers')).toBe(false);
        });

        it('is invalid when a multichoice field has too few choices', function () {
            vm.fields = [ { type : 'multichoice', choices : ['a'] } ];
            expect($scope.isInvalid('numbers')).toBe(true);
        });

        it('is invalid when a multichoice field has too many choices', function () {
            vm.fields = [ { type : 'multichoice', choices : ['a', 'b', 'c', 'd', 'e', 'f'] } ];
            expect($scope.isInvalid('numbers')).toBe(true);
        });

        it('is invalid when a multichoice field contains a choice starting with a digit', function () {
            vm.fields = [ { type : 'multichoice', choices : ['1abc', 'def'] } ];
            expect($scope.isInvalid('numbers')).toBe(true);
        });

        it('is invalid when a multichoice choice is too long', function () {
            vm.fields = [ { type : 'multichoice', choices : ['abcdefghij', 'def'] } ];
            expect($scope.isInvalid('numbers')).toBe(true);
        });

        it('is valid with a well-formed multichoice field', function () {
            vm.fields = [ { type : 'multichoice', choices : ['cat', 'dog'] } ];
            expect($scope.isInvalid('numbers')).toBe(false);
        });

    });


    describe('vm.addFieldChoice', function () {

        var vm, field;

        beforeEach(function () {
            vm = createController();
            field = { choices : ['cat'] };
        });

        it('adds a trimmed choice and returns true', function () {
            var result = vm.addFieldChoice('  dog  ', field);

            expect(result).toBe(true);
            expect(field.choices).toEqual(['cat', 'dog']);
        });

        it('rejects an empty choice', function () {
            var result = vm.addFieldChoice('   ', field);

            expect(result).toBe(false);
            expect(field.choices).toEqual(['cat']);
        });

        it('rejects a choice that already exists', function () {
            var result = vm.addFieldChoice('cat', field);

            expect(result).toBe(false);
            expect(field.choices).toEqual(['cat']);
        });

        it('rejects a choice that is too long', function () {
            var result = vm.addFieldChoice('waytoolongchoice', field);

            expect(result).toBe(false);
            expect(field.choices).toEqual(['cat']);
        });

    });


    describe('vm.confirm', function () {

        var vm;

        beforeEach(function () {
            vm = createController();
            $rootScope.$digest();
        });

        it('strips extra field properties for a numbers project', function () {
            projectsServiceMock.createProject.and.returnValue($q.resolve({ id : 'proj1' }));

            var projectSpec = {
                type : 'numbers',
                storage : 'cloud',
                fields : [
                    { name : 'a', type : 'number', extra : 'should be removed' },
                    { name : 'b', type : 'multichoice', choices : ['x', 'y'], extra : 'should be removed' }
                ]
            };

            vm.confirm(projectSpec);
            $rootScope.$digest();

            expect(projectSpec.fields).toEqual([
                { name : 'a', type : 'number' },
                { name : 'b', type : 'multichoice', choices : ['x', 'y'] }
            ]);
        });

        it('removes the fields property for a non-numbers project', function () {
            projectsServiceMock.createProject.and.returnValue($q.resolve({ id : 'proj1' }));

            var projectSpec = { type : 'text', storage : 'cloud', fields : [ { name : 'a' } ] };

            vm.confirm(projectSpec);
            $rootScope.$digest();

            expect(projectSpec.fields).toBeUndefined();
        });

        it('blocks cloud storage for regression projects', function () {
            var projectSpec = { type : 'regression', storage : 'cloud' };

            vm.confirm(projectSpec);

            expect(vm.errors.length).toBe(1);
            expect(projectsServiceMock.createProject).not.toHaveBeenCalled();
            expect($scope.creating).toBe(false);
        });

        it('blocks cloud storage for language projects', function () {
            var projectSpec = { type : 'language', storage : 'cloud' };

            vm.confirm(projectSpec);

            expect(vm.errors.length).toBe(1);
            expect(projectsServiceMock.createProject).not.toHaveBeenCalled();
            expect($scope.creating).toBe(false);
        });

        it('creates the project and navigates to it on success', function () {
            projectsServiceMock.createProject.and.returnValue($q.resolve({ id : 'proj1' }));

            var projectSpec = { type : 'text', storage : 'cloud' };
            vm.confirm(projectSpec);
            $rootScope.$digest();

            expect(projectsServiceMock.createProject).toHaveBeenCalledWith(projectSpec, 'user1', 'class1');
            expect($stateMock.go).toHaveBeenCalledWith('projects', { id : 'proj1' });
        });

        it('shows a "try it now" specific message when session users hit the project limit', function () {
            vm.profile = { user_id : 'user1', tenant : 'session-users' };
            projectsServiceMock.createProject.and.returnValue($q.reject({
                status : 409,
                data : { error : 'User already has maximum number of projects' }
            }));

            vm.confirm({ type : 'text', storage : 'cloud' });
            $rootScope.$digest();

            expect(vm.errors[0].message).toContain('one project at a time');
            expect($scope.creating).toBe(false);
        });

        it('shows the standard exceeded-limit message for class users', function () {
            projectsServiceMock.createProject.and.returnValue($q.reject({
                status : 409,
                data : { error : 'User already has maximum number of projects' }
            }));

            vm.confirm({ type : 'text', storage : 'cloud' });
            $rootScope.$digest();

            expect(vm.errors[0].message).toContain('reached the limit');
            expect($scope.creating).toBe(false);
        });

        it('shows the raw error message for other failures', function () {
            projectsServiceMock.createProject.and.returnValue($q.reject({
                status : 500,
                data : { message : 'Something went wrong' }
            }));

            vm.confirm({ type : 'text', storage : 'cloud' });
            $rootScope.$digest();

            expect(vm.errors[0].message).toBe('Something went wrong');
            expect($scope.creating).toBe(false);
        });

    });

});
