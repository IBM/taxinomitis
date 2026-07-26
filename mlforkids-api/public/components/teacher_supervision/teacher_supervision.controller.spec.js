describe('TeacherProjectsController', function () {

    var $controller;
    var $q;
    var $rootScope;
    var $scope;

    var authServiceMock, projectsServiceMock, trainingServiceMock, $mdDialogMock, loggerServiceMock;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
        $scope = $rootScope.$new();
    }));

    beforeEach(function () {
        authServiceMock = jasmine.createSpyObj('authService', ['getProfileDeferred', 'login']);

        projectsServiceMock = jasmine.createSpyObj('projectsService', ['getClassProjects']);

        trainingServiceMock = jasmine.createSpyObj('trainingService', [
            'getUnmanagedClassifiers', 'deleteModel', 'deleteBluemixClassifier'
        ]);

        $mdDialogMock = jasmine.createSpyObj('$mdDialog', ['confirm', 'show']);

        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error', 'warn']);
    });

    function createController() {
        return $controller('TeacherProjectsController', {
            authService : authServiceMock,
            projectsService : projectsServiceMock,
            trainingService : trainingServiceMock,
            $mdDialog : $mdDialogMock,
            $scope : $scope,
            loggerService : loggerServiceMock
        });
    }

    function supervisorProfile() {
        return { user_id : 'teacher1', tenant : 'class1', role : 'supervisor' };
    }

    // $mdDialog.confirm() returns a chainable builder in the real service;
    // this fake accepts the same chained calls and returns itself each time
    function confirmBuilderMock() {
        var builder = {};
        [ 'title', 'textContent', 'ariaLabel', 'targetEvent', 'ok', 'cancel' ].forEach(function (method) {
            builder[method] = jasmine.createSpy(method).and.callFake(function () { return builder; });
        });
        return builder;
    }

    function readyController() {
        authServiceMock.getProfileDeferred.and.returnValue($q.resolve(supervisorProfile()));
        projectsServiceMock.getClassProjects.and.returnValue($q.resolve([]));
        trainingServiceMock.getUnmanagedClassifiers.and.returnValue($q.resolve({ conv : [] }));
        $mdDialogMock.confirm.and.returnValue(confirmBuilderMock());

        var vm = createController();
        $rootScope.$digest();
        return vm;
    }


    describe('initial state', function () {

        it('starts with no alerts, a default sort order, and no delete request in flight', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.defer().promise);

            var vm = createController();

            expect(vm.errors).toEqual([]);
            expect(vm.warnings).toEqual([]);
            expect(vm.orderBy).toBe('name');
            expect($scope.submittingDeleteRequest).toBe(false);
        });

    });


    describe('loading data for a supervisor', function () {

        it('does not fetch projects or classifiers for a non-supervisor', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.resolve({ role : 'student' }));

            createController();
            $rootScope.$digest();

            expect(projectsServiceMock.getClassProjects).not.toHaveBeenCalled();
            expect(trainingServiceMock.getUnmanagedClassifiers).not.toHaveBeenCalled();
        });

        it('fetches both the projects list and the unmanaged classifiers list for a supervisor', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.resolve(supervisorProfile()));
            projectsServiceMock.getClassProjects.and.returnValue($q.resolve([]));
            trainingServiceMock.getUnmanagedClassifiers.and.returnValue($q.resolve({ conv : [] }));

            createController();
            $rootScope.$digest();

            expect(projectsServiceMock.getClassProjects).toHaveBeenCalledWith(supervisorProfile());
            expect(trainingServiceMock.getUnmanagedClassifiers).toHaveBeenCalledWith('class1');
        });

        it('shows an error alert if fetching the profile fails', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.reject({ status : 500, data : { error : 'boom' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toBe('boom');
        });

        it('shows an error alert if fetching the projects list fails', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.resolve(supervisorProfile()));
            projectsServiceMock.getClassProjects.and.returnValue($q.reject({ status : 500, data : { error : 'boom' } }));
            trainingServiceMock.getUnmanagedClassifiers.and.returnValue($q.resolve({ conv : [] }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toBe('boom');
        });

        it('silently ignores a 403 fetching the unmanaged classifiers list (expected for managed tenants)', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.resolve(supervisorProfile()));
            projectsServiceMock.getClassProjects.and.returnValue($q.resolve([]));
            trainingServiceMock.getUnmanagedClassifiers.and.returnValue($q.reject({ status : 403 }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors).toEqual([]);
            expect(vm.warnings).toEqual([]);
        });

        it('does not show an alert for a non-403 failure fetching the unmanaged classifiers list either (logged only)', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.resolve(supervisorProfile()));
            projectsServiceMock.getClassProjects.and.returnValue($q.resolve([]));
            trainingServiceMock.getUnmanagedClassifiers.and.returnValue($q.reject({ status : 500, data : { error : 'boom' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors).toEqual([]);
            expect(loggerServiceMock.error).toHaveBeenCalled();
        });

    });


    describe('labelsSummary', function () {

        function loadProjects(projects) {
            authServiceMock.getProfileDeferred.and.returnValue($q.resolve(supervisorProfile()));
            projectsServiceMock.getClassProjects.and.returnValue($q.resolve(projects));
            trainingServiceMock.getUnmanagedClassifiers.and.returnValue($q.resolve({ conv : [] }));

            var vm = createController();
            $rootScope.$digest();
            return vm;
        }

        it('leaves labelsSummary unset for a project with no labels', function () {
            var vm = loadProjects([ { id : 'p1', labels : [] } ]);
            expect(vm.projects[0].labelsSummary).toBeUndefined();
        });

        it('shows a single label as-is', function () {
            var vm = loadProjects([ { id : 'p1', labels : [ 'cat' ] } ]);
            expect(vm.projects[0].labelsSummary).toBe('cat');
        });

        it('joins two labels with "or"', function () {
            var vm = loadProjects([ { id : 'p1', labels : [ 'cat', 'dog' ] } ]);
            expect(vm.projects[0].labelsSummary).toBe('cat or dog');
        });

        it('lists all three labels, comma-separated with a trailing "or"', function () {
            var vm = loadProjects([ { id : 'p1', labels : [ 'cat', 'dog', 'fish' ] } ]);
            expect(vm.projects[0].labelsSummary).toBe('cat, dog or fish');
        });

        it('names the first two labels and counts the rest for four labels', function () {
            var vm = loadProjects([ { id : 'p1', labels : [ 'cat', 'dog', 'fish', 'bird' ] } ]);
            expect(vm.projects[0].labelsSummary).toBe('cat, dog or 2 other classes');
        });

        it('scales the "other classes" count correctly for many labels', function () {
            var vm = loadProjects([ { id : 'p1', labels : [ 'a', 'b', 'c', 'd', 'e', 'f' ] } ]);
            expect(vm.projects[0].labelsSummary).toBe('a, b or 4 other classes');
        });

    });


    describe('dismissAlert', function () {

        it('removes only the alert at the given index from the given list', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.defer().promise);
            var vm = createController();
            vm.errors = [ { message : 'a' }, { message : 'b' }, { message : 'c' } ];

            vm.dismissAlert('errors', 1);

            expect(vm.errors).toEqual([ { message : 'a' }, { message : 'c' } ]);
        });

    });


    describe('deleteModel', function () {

        it('optimistically clears hasModel and requests deletion when confirmed', function () {
            var vm = readyController();
            var project = { id : 'p1', name : 'My Project', userid : 'user1', classid : 'class1', classifierId : 'clsf1', hasModel : true };
            $mdDialogMock.show.and.returnValue($q.resolve());
            trainingServiceMock.deleteModel.and.returnValue($q.resolve());

            vm.deleteModel({}, project);
            $rootScope.$digest();

            expect(project.hasModel).toBe(false);
            expect(trainingServiceMock.deleteModel).toHaveBeenCalledWith(project, 'user1', 'class1', 'clsf1');
        });

        it('mentions the project owner in the confirmation text when there is one', function () {
            var vm = readyController();
            var project = { id : 'p1', name : 'My Project', owner : { username : 'student1' } };
            $mdDialogMock.show.and.returnValue($q.defer().promise);

            vm.deleteModel({}, project);

            expect($mdDialogMock.confirm().textContent).toHaveBeenCalledWith(
                "Do you want to delete student1's machine learning model from project My Project?"
            );
        });

        it('does not delete anything if the confirmation is cancelled', function () {
            var vm = readyController();
            var project = { id : 'p1', name : 'My Project', hasModel : true };
            $mdDialogMock.show.and.returnValue($q.reject());

            vm.deleteModel({}, project);
            $rootScope.$digest();

            expect(project.hasModel).toBe(true);
            expect(trainingServiceMock.deleteModel).not.toHaveBeenCalled();
        });

        it('shows an error alert if the deletion request fails', function () {
            var vm = readyController();
            var project = { id : 'p1', name : 'My Project', hasModel : true };
            $mdDialogMock.show.and.returnValue($q.resolve());
            trainingServiceMock.deleteModel.and.returnValue($q.reject({ status : 500, data : { error : 'boom' } }));

            vm.deleteModel({}, project);
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toBe('boom');
        });

    });


    describe('deleteClassifier', function () {

        function classifierFixture() {
            return { id : 'clsf1', name : 'My Workspace', type : 'conv', credentials : { id : 'cred1' } };
        }

        it('does not mark a delete request as in-flight merely by opening the confirmation dialog', function () {
            // regression test: submittingDeleteRequest used to be set to true
            // as soon as the Delete button was clicked, before the user had
            // even confirmed
            var vm = readyController();
            $mdDialogMock.show.and.returnValue($q.defer().promise);

            vm.deleteClassifier({}, classifierFixture());

            expect($scope.submittingDeleteRequest).toBe(false);
        });

        it('leaves every delete button enabled after the confirmation is cancelled', function () {
            // regression test: cancelling never reset the flag, so it stayed
            // stuck at true (disabling all delete buttons) for the rest of
            // the page's life
            var vm = readyController();
            $mdDialogMock.show.and.returnValue($q.reject());

            vm.deleteClassifier({}, classifierFixture());
            $rootScope.$digest();

            expect($scope.submittingDeleteRequest).toBe(false);
            expect(trainingServiceMock.deleteBluemixClassifier).not.toHaveBeenCalled();
        });

        it('a cancelled delete does not block deleting a different classifier afterwards', function () {
            var vm = readyController();
            vm.classifiers = { conv : [ classifierFixture(), { id : 'clsf2', name : 'Other', type : 'conv', credentials : { id : 'cred2' } } ] };
            $mdDialogMock.show.and.returnValue($q.reject());
            vm.deleteClassifier({}, classifierFixture());
            $rootScope.$digest();

            $mdDialogMock.show.and.returnValue($q.resolve());
            trainingServiceMock.deleteBluemixClassifier.and.returnValue($q.resolve());
            vm.deleteClassifier({}, vm.classifiers.conv[1]);
            $rootScope.$digest();

            expect(trainingServiceMock.deleteBluemixClassifier).toHaveBeenCalled();
            expect(vm.classifiers.conv.length).toBe(1);
        });

        it('marks the request in-flight once confirmed, and clears it on success while removing the classifier from the list', function () {
            var vm = readyController();
            vm.classifiers = { conv : [ classifierFixture() ] };
            $mdDialogMock.show.and.returnValue($q.resolve());
            trainingServiceMock.deleteBluemixClassifier.and.returnValue($q.defer().promise);

            vm.deleteClassifier({}, classifierFixture());
            $rootScope.$digest();

            expect($scope.submittingDeleteRequest).toBe(true);
            expect(trainingServiceMock.deleteBluemixClassifier).toHaveBeenCalledWith('class1', 'clsf1', 'cred1', 'conv');
        });

        it('clears the in-flight flag and removes the classifier from its type list on success', function () {
            var vm = readyController();
            vm.classifiers = { conv : [ classifierFixture(), { id : 'clsf2', name : 'Other', type : 'conv', credentials : { id : 'cred2' } } ] };
            $mdDialogMock.show.and.returnValue($q.resolve());
            trainingServiceMock.deleteBluemixClassifier.and.returnValue($q.resolve());

            vm.deleteClassifier({}, classifierFixture());
            $rootScope.$digest();

            expect($scope.submittingDeleteRequest).toBe(false);
            expect(vm.classifiers.conv).toEqual([ { id : 'clsf2', name : 'Other', type : 'conv', credentials : { id : 'cred2' } } ]);
        });

        it('clears the in-flight flag and shows an error alert on failure, leaving the classifier in the list', function () {
            var vm = readyController();
            vm.classifiers = { conv : [ classifierFixture() ] };
            $mdDialogMock.show.and.returnValue($q.resolve());
            trainingServiceMock.deleteBluemixClassifier.and.returnValue($q.reject({ status : 500, data : { error : 'boom' } }));

            vm.deleteClassifier({}, classifierFixture());
            $rootScope.$digest();

            expect($scope.submittingDeleteRequest).toBe(false);
            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toBe('boom');
            expect(vm.classifiers.conv.length).toBe(1);
        });

    });

});
