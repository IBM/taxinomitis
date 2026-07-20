// NOTE: usersService is a full jasmine spy object below - every method on
// it is a mock with no real implementation. That means none of these tests
// ever make a real HTTP call, so nothing in this file can reach Auth0.
describe('TeacherStudentsController', function () {

    var $controller;
    var $q;
    var $rootScope;
    var $scope;

    var authServiceMock, usersServiceMock, scrollServiceMock, readersServiceMock, loggerServiceMock;
    var $mdDialogMock;

    // a fresh object every test - the controller mutates profile.groups in
    // place, so reusing one shared object across tests would leak state
    // between them (and made results depend on Jasmine's randomised test order)
    var supervisorProfile;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
        $scope = $rootScope.$new();
    }));

    beforeEach(function () {
        supervisorProfile = { user_id : 'teacher1', tenant : 'class1', role : 'supervisor', groups : ['groupA'] };

        authServiceMock = {
            getProfileDeferred : jasmine.createSpy('getProfileDeferred').and.returnValue($q.resolve(supervisorProfile)),
            storeProfile : jasmine.createSpy('storeProfile')
        };
        usersServiceMock = jasmine.createSpyObj('usersService', [
            'getClassPolicy', 'getStudentList',
            'addStudentsToGroup', 'removeStudentsFromGroup',
            'deleteStudents', 'deleteStudent',
            'createClassGroup', 'deleteClassGroup',
            'resetStudentPassword', 'resetStudentsPassword',
            'createStudent', 'createStudents', 'importStudents',
            'getGeneratedPassword'
        ]);
        usersServiceMock.getClassPolicy.and.returnValue($q.resolve({ maxUsers : 40 }));

        scrollServiceMock = jasmine.createSpyObj('scrollService', ['scrollToNewItem']);
        readersServiceMock = jasmine.createSpyObj('readersService', ['createFileReader']);
        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error']);

        $mdDialogMock = jasmine.createSpyObj('$mdDialog', ['confirm', 'show', 'alert']);
        $mdDialogMock.confirm.and.returnValue({
            title : function () { return this; },
            textContent : function () { return this; },
            ariaLabel : function () { return this; },
            targetEvent : function () { return this; },
            ok : function () { return this; },
            cancel : function () { return this; }
        });
        $mdDialogMock.alert.and.returnValue({
            clickOutsideToClose : function () { return this; },
            title : function () { return this; },
            textContent : function () { return this; },
            htmlContent : function () { return this; },
            ariaLabel : function () { return this; },
            ok : function () { return this; },
            targetEvent : function () { return this; }
        });
    });

    function createController() {
        return $controller('TeacherStudentsController', {
            authService : authServiceMock,
            usersService : usersServiceMock,
            scrollService : scrollServiceMock,
            readersService : readersServiceMock,
            $scope : $scope,
            $mdDialog : $mdDialogMock,
            loggerService : loggerServiceMock
        });
    }

    function student(id, username) {
        return { id : id, username : username };
    }


    describe('initialisation', function () {

        it('loads the profile and the class policy for a supervisor, then clears busy', function () {
            var vm = createController();
            $rootScope.$digest();

            expect(vm.profile).toEqual(supervisorProfile);
            expect(usersServiceMock.getClassPolicy).toHaveBeenCalledWith(supervisorProfile);
            expect(vm.policy).toEqual({ maxUsers : 40 });
            expect($scope.busy).toBe(false);
        });

        it('records an error alert if fetching the profile fails', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.reject({ status : 401, data : { error : 'not authorised' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].status).toBe(401);
            expect(scrollServiceMock.scrollToNewItem).toHaveBeenCalledWith('errors1');
        });

        it('records an error alert if fetching the class policy fails', function () {
            usersServiceMock.getClassPolicy.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
        });

    });


    describe('dismissAlert', function () {

        it('removes the alert at the given index', function () {
            var vm = createController();
            vm.errors = [ { alertid : 1 }, { alertid : 2 } ];

            vm.dismissAlert('errors', 0);

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].alertid).toBe(2);
        });

    });


    describe('selection helpers', function () {

        var vm;

        beforeEach(function () {
            vm = createController();
            $rootScope.$digest();
            vm.groupedStudents.groupA = [ student(1, 'alice'), student(2, 'bob') ];
        });

        it('updateStudentSelection adds and then removes a student', function () {
            $scope.updateStudentSelection('groupA', 1);
            expect($scope.isStudentSelected('groupA', 1)).toBe(true);

            $scope.updateStudentSelection('groupA', 1);
            expect($scope.isStudentSelected('groupA', 1)).toBe(false);
        });

        it('does not add more than MAX_PER_GROUP selections', function () {
            for (var i = 0; i < $scope.MAX_PER_GROUP + 5; i++) {
                $scope.updateStudentSelection('groupA', 1000 + i);
            }
            expect($scope.isStudentSelected('groupA', 1000)).toBe(true);
            expect($scope.isStudentSelected('groupA', 1000 + $scope.MAX_PER_GROUP)).toBe(false);
        });

        it('selectAllStudents selects every student in the group', function () {
            $scope.selectAllStudents('groupA');

            expect($scope.areAllStudentsSelected('groupA')).toBe(true);
            expect($scope.isStudentSelected('groupA', 1)).toBe(true);
            expect($scope.isStudentSelected('groupA', 2)).toBe(true);
        });

        it('selectAllStudents toggles off when everything is already selected', function () {
            $scope.selectAllStudents('groupA');
            $scope.selectAllStudents('groupA');

            expect($scope.areAllStudentsSelected('groupA')).toBe(false);
            expect($scope.areStudentsSelected('groupA')).toBe(false);
        });

    });


    describe('fetchAndDisplayStudents / panel expansion', function () {

        var vm;

        beforeEach(function () {
            vm = createController();
            $rootScope.$digest();
        });

        it('fetches students the first time a panel is expanded', function () {
            usersServiceMock.getStudentList.and.returnValue($q.resolve([ student(1, 'alice') ]));

            $scope.collapsePanel('groupA');
            $rootScope.$digest();

            expect(usersServiceMock.getStudentList).toHaveBeenCalledWith(vm.profile, 'groupA');
            expect(vm.groupedStudents.groupA).toEqual([ student(1, 'alice') ]);
            expect($scope.isPanelCollapsed('groupA')).toBe(true);
        });

        it('does not re-fetch when the panel is collapsed and re-expanded', function () {
            vm.groupedStudents.groupA = [ student(1, 'alice') ];

            $scope.collapsePanel('groupA');
            $scope.collapsePanel('groupA');

            expect(usersServiceMock.getStudentList).not.toHaveBeenCalled();
        });

    });


    describe('fetchAndDisplayUngroupedStudents', function () {

        it('fetches ungrouped students the first time it is called', function () {
            usersServiceMock.getStudentList.and.returnValue($q.resolve([ student(1, 'alice') ]));

            var vm = createController();
            $rootScope.$digest();

            $scope.fetchAndDisplayUngroupedStudents();
            $rootScope.$digest();

            expect(usersServiceMock.getStudentList).toHaveBeenCalledWith(vm.profile, '');
            expect(vm.ungroupedStudents).toEqual([ student(1, 'alice') ]);
        });

        it('does not re-fetch on a second call', function () {
            usersServiceMock.getStudentList.and.returnValue($q.resolve([ student(1, 'alice') ]));

            createController();
            $rootScope.$digest();

            $scope.fetchAndDisplayUngroupedStudents();
            $rootScope.$digest();
            $scope.fetchAndDisplayUngroupedStudents();
            $rootScope.$digest();

            expect(usersServiceMock.getStudentList).toHaveBeenCalledTimes(1);
        });

    });


    describe('moveStudentsIntoGroup', function () {

        var vm;

        beforeEach(function () {
            vm = createController();
            $rootScope.$digest();
            vm.groupedStudents.groupA = [ student(1, 'alice'), student(2, 'bob') ];
            vm.groupedStudents.groupB = [];
        });

        it('moves the selected students into the target group', function () {
            $scope.updateStudentSelection('groupA', 1);
            usersServiceMock.addStudentsToGroup.and.returnValue($q.resolve());

            $scope.moveStudentsIntoGroup('groupA', 'groupB');
            $rootScope.$digest();

            expect(usersServiceMock.addStudentsToGroup).toHaveBeenCalledWith([1], 'class1', 'groupB');
            expect(vm.groupedStudents.groupA.map(function (s) { return s.id; })).toEqual([2]);
            expect(vm.groupedStudents.groupB.map(function (s) { return s.id; })).toEqual([1]);
        });

        it('does not call the API when nothing is selected', function () {
            usersServiceMock.addStudentsToGroup.and.returnValue($q.resolve());

            $scope.moveStudentsIntoGroup('groupA', 'groupB');
            $rootScope.$digest();

            expect(usersServiceMock.addStudentsToGroup).not.toHaveBeenCalled();
        });

    });


    describe('removeStudentsFromGroup', function () {

        var vm;

        beforeEach(function () {
            vm = createController();
            $rootScope.$digest();
            vm.groupedStudents.groupA = [ student(1, 'alice') ];
        });

        it('moves selected students to the ungrouped list', function () {
            vm.ungroupedStudents = [];
            $scope.updateStudentSelection('groupA', 1);
            usersServiceMock.removeStudentsFromGroup.and.returnValue($q.resolve());

            $scope.removeStudentsFromGroup('groupA');
            $rootScope.$digest();

            expect(usersServiceMock.removeStudentsFromGroup).toHaveBeenCalledWith([1], 'class1');
            expect(vm.groupedStudents.groupA).toEqual([]);
            expect(vm.ungroupedStudents.map(function (s) { return s.id; })).toEqual([1]);
        });

        it('does not call the API when nothing is selected', function () {
            usersServiceMock.removeStudentsFromGroup.and.returnValue($q.resolve());

            $scope.removeStudentsFromGroup('groupA');
            $rootScope.$digest();

            expect(usersServiceMock.removeStudentsFromGroup).not.toHaveBeenCalled();
        });

    });


    describe('deleteUsers', function () {

        var vm;

        beforeEach(function () {
            vm = createController();
            $rootScope.$digest();
            vm.groupedStudents.groupA = [ student(1, 'alice'), student(2, 'bob') ];
        });

        it('does nothing when no students are selected', function () {
            vm.deleteUsers({}, 'groupA');
            $rootScope.$digest();

            expect(usersServiceMock.deleteStudents).not.toHaveBeenCalled();
        });

        it('deletes the selected students on confirmation', function () {
            $scope.updateStudentSelection('groupA', 1);
            $mdDialogMock.show.and.returnValue($q.resolve());
            usersServiceMock.deleteStudents.and.returnValue($q.resolve({ deleted : [ { id : 1 } ] }));

            vm.deleteUsers({}, 'groupA');
            $rootScope.$digest();

            var deleteArgs = usersServiceMock.deleteStudents.calls.mostRecent().args;
            expect(deleteArgs[0].map(function (s) { return s.id; })).toEqual([1]);
            expect(deleteArgs[1]).toBe('class1');
            expect(vm.groupedStudents.groupA.map(function (s) { return s.id; })).toEqual([2]);
        });

        it('shows a warning when some of the selected students could not be deleted', function () {
            $scope.updateStudentSelection('groupA', 1);
            $scope.updateStudentSelection('groupA', 2);
            $mdDialogMock.show.and.returnValue($q.resolve());
            usersServiceMock.deleteStudents.and.returnValue($q.resolve({ deleted : [ { id : 1 } ] }));

            vm.deleteUsers({}, 'groupA');
            $rootScope.$digest();

            expect(vm.warnings.length).toBe(1);
            expect(vm.groupedStudents.groupA.map(function (s) { return s.id; })).toEqual([2]);
        });

        it('clears the placeholder flag if the confirmation is cancelled', function () {
            $scope.updateStudentSelection('groupA', 1);
            $mdDialogMock.show.and.returnValue($q.reject());

            vm.deleteUsers({}, 'groupA');
            $rootScope.$digest();

            expect(usersServiceMock.deleteStudents).not.toHaveBeenCalled();
            expect(vm.groupedStudents.groupA[0].isPlaceholder).toBe(false);
        });

    });


    describe('deleteUser (single student)', function () {

        var vm, alice;

        beforeEach(function () {
            vm = createController();
            $rootScope.$digest();
            alice = student(1, 'alice');
            vm.groupedStudents.groupA = [ alice ];
        });

        it('deletes the student on confirmation', function () {
            $mdDialogMock.show.and.returnValue($q.resolve());
            usersServiceMock.deleteStudent.and.returnValue($q.resolve());

            vm.deleteUser({}, 'groupA', alice);
            $rootScope.$digest();

            expect(usersServiceMock.deleteStudent).toHaveBeenCalledWith(alice, 'class1');
            expect(vm.groupedStudents.groupA).toEqual([]);
        });

        it('clears the placeholder flag if the confirmation is cancelled', function () {
            $mdDialogMock.show.and.returnValue($q.reject());

            vm.deleteUser({}, 'groupA', alice);
            $rootScope.$digest();

            expect(usersServiceMock.deleteStudent).not.toHaveBeenCalled();
            expect(alice.isPlaceholder).toBe(false);
        });

        it('restores the student if the delete request fails', function () {
            $mdDialogMock.show.and.returnValue($q.resolve());
            usersServiceMock.deleteStudent.and.returnValue($q.reject({ status : 500, data : {} }));

            vm.deleteUser({}, 'groupA', alice);
            $rootScope.$digest();

            expect(alice.isPlaceholder).toBe(false);
            expect(vm.groupedStudents.groupA).toEqual([ alice ]);
        });

    });


    describe('resetUsersPassword', function () {

        var vm;

        beforeEach(function () {
            vm = createController();
            $rootScope.$digest();
            vm.groupedStudents.groupA = [ student(1, 'alice') ];
        });

        it('resets the passwords for the selected students and shows the new password', function () {
            $scope.updateStudentSelection('groupA', 1);
            $mdDialogMock.show.and.returnValue($q.resolve());
            usersServiceMock.resetStudentsPassword.and.returnValue($q.resolve({ password : 'newpass123' }));

            vm.resetUsersPassword({}, 'groupA');
            $rootScope.$digest();

            var resetArgs = usersServiceMock.resetStudentsPassword.calls.mostRecent().args;
            expect(resetArgs[0].map(function (s) { return s.id; })).toEqual([1]);
            expect(resetArgs[1]).toBe('class1');
            expect(vm.groupedStudents.groupA[0].isPlaceholder).toBe(false);
        });

        it('resets allStudentPasswordsReset back to false if the confirmation is cancelled', function () {
            $scope.updateStudentSelection('groupA', 1);
            $mdDialogMock.show.and.returnValue($q.reject());

            vm.resetUsersPassword({}, 'groupA');
            $rootScope.$digest();

            expect(usersServiceMock.resetStudentsPassword).not.toHaveBeenCalled();
            expect(vm.allStudentPasswordsReset).toBe(false);
        });

    });


    describe('resetUserPassword (single student)', function () {

        it('resets the password and clears the placeholder flag', function () {
            var vm = createController();
            $rootScope.$digest();
            var alice = student(1, 'alice');
            vm.groupedStudents.groupA = [ alice ];

            usersServiceMock.resetStudentPassword.and.returnValue($q.resolve({ username : 'alice', password : 'newpass' }));

            vm.resetUserPassword({}, alice);
            $rootScope.$digest();

            expect(usersServiceMock.resetStudentPassword).toHaveBeenCalledWith(alice, 'class1');
            expect(alice.isPlaceholder).toBe(false);
            expect($mdDialogMock.show).toHaveBeenCalled();
        });

    });


    describe('createStudentGroup', function () {

        var vm;

        beforeEach(function () {
            vm = createController();
            $rootScope.$digest();
        });

        it('creates a new group and stores the updated profile', function () {
            $mdDialogMock.show.and.returnValue($q.resolve('groupB'));
            usersServiceMock.createClassGroup.and.returnValue($q.resolve());

            $scope.createStudentGroup({});
            $rootScope.$digest();

            expect(usersServiceMock.createClassGroup).toHaveBeenCalledWith(vm.profile, 'groupB');
            expect(vm.profile.groups).toContain('groupB');
            expect(authServiceMock.storeProfile).toHaveBeenCalledWith(vm.profile);
        });

        it('rejects a duplicate group name without calling the API', function () {
            $mdDialogMock.show.and.returnValue($q.resolve('groupA'));

            $scope.createStudentGroup({});
            $rootScope.$digest();

            expect(usersServiceMock.createClassGroup).not.toHaveBeenCalled();
        });

        it('rejects the reserved group names ALL and ungrouped', function () {
            $mdDialogMock.show.and.returnValue($q.resolve('ALL'));

            $scope.createStudentGroup({});
            $rootScope.$digest();

            expect(usersServiceMock.createClassGroup).not.toHaveBeenCalled();
        });

    });


    describe('deleteStudentGroup', function () {

        var vm;

        beforeEach(function () {
            vm = createController();
            $rootScope.$digest();
        });

        it('deletes an empty group and stores the updated profile', function () {
            vm.groupedStudents.groupA = [];
            usersServiceMock.deleteClassGroup.and.returnValue($q.resolve());

            $scope.deleteStudentGroup({}, 'groupA');
            $rootScope.$digest();

            expect(usersServiceMock.deleteClassGroup).toHaveBeenCalledWith(vm.profile, 'groupA');
            expect(vm.profile.groups).not.toContain('groupA');
        });

        it('refuses to delete a non-empty group', function () {
            vm.groupedStudents.groupA = [ student(1, 'alice') ];

            $scope.deleteStudentGroup({}, 'groupA');
            $rootScope.$digest();

            expect(usersServiceMock.deleteClassGroup).not.toHaveBeenCalled();
        });

    });


    describe('createUser', function () {

        var vm;

        beforeEach(function () {
            vm = createController();
            $rootScope.$digest();
            vm.groupedStudents.groupA = [];
        });

        it('creates a single student on confirmation', function () {
            $mdDialogMock.show.and.returnValue($q.resolve('newstudent'));
            usersServiceMock.createStudent.and.returnValue($q.resolve({ id : 'realid1', username : 'newstudent', password : 'pw' }));

            vm.createUser({}, 'groupA');
            $rootScope.$digest();

            expect(usersServiceMock.createStudent).toHaveBeenCalled();
            expect(vm.groupedStudents.groupA.length).toBe(1);
            expect(vm.groupedStudents.groupA[0].id).toBe('realid1');
            expect(vm.groupedStudents.groupA[0].isPlaceholder).toBe(false);
        });

        it('removes the placeholder student if creation fails', function () {
            $mdDialogMock.show.and.returnValue($q.resolve('newstudent'));
            usersServiceMock.createStudent.and.returnValue($q.reject({ status : 409, data : {} }));

            vm.createUser({}, 'groupA');
            $rootScope.$digest();

            expect(vm.groupedStudents.groupA.length).toBe(0);
        });

        it('does not open the dialog once the group is full', function () {
            vm.groupedStudents.groupA = new Array($scope.MAX_PER_GROUP).fill(student(1, 'x'));

            vm.createUser({}, 'groupA');

            expect($mdDialogMock.show).not.toHaveBeenCalled();
        });

    });


    describe('createMultipleUsers dialog', function () {

        var vm;

        beforeEach(function () {
            vm = createController();
            $rootScope.$digest();
            vm.groupedStudents.groupA = [];
        });

        it('generates a password when the dialog opens', function () {
            usersServiceMock.getGeneratedPassword.and.returnValue($q.resolve({ password : 'generated1' }));
            $mdDialogMock.show.and.returnValue($q.defer().promise); // dialog left open - only testing its controller

            vm.createMultipleUsers({}, 'groupA');

            var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
            var dialogScope = {};
            var dialogMdDialog = jasmine.createSpyObj('dialogMdDialog', ['hide', 'cancel']);
            dialogOptions.controller(dialogScope, dialogMdDialog);
            $rootScope.$digest();

            expect(usersServiceMock.getGeneratedPassword).toHaveBeenCalledWith('class1');
            expect(dialogScope.password).toBe('generated1');
        });

        it('creates the requested number of students and reports successes', function () {
            usersServiceMock.getGeneratedPassword.and.returnValue($q.resolve({ password : 'generated1' }));
            $mdDialogMock.show.and.returnValue($q.resolve({ prefix : 'student', number : 2, password : 'generated1' }));
            usersServiceMock.createStudents.and.returnValue($q.resolve({
                successes : [ student('r1', 'student1'), student('r2', 'student2') ],
                failures : [],
                duplicates : []
            }));

            vm.createMultipleUsers({}, 'groupA');
            $rootScope.$digest();

            expect(usersServiceMock.createStudents).toHaveBeenCalledWith('class1', 'student', 2, 'generated1', 'groupA');
            expect(vm.groupedStudents.groupA.length).toBe(2);
            expect(vm.groupedStudents.groupA.some(function (s) { return s.isPlaceholder; })).toBe(false);
        });

    });


    describe('importMultipleUsers dialog - username parsing', function () {

        var vm, dialogScope, dialogMdDialog, fakeReader;

        beforeEach(function () {
            vm = createController();
            $rootScope.$digest();
            vm.groupedStudents.groupA = [];

            usersServiceMock.getGeneratedPassword.and.returnValue($q.resolve({ password : 'generated1' }));
            $mdDialogMock.show.and.returnValue($q.defer().promise); // dialog left open for these tests

            fakeReader = { readAsText : function () {} };
            readersServiceMock.createFileReader.and.returnValue(fakeReader);

            vm.importMultipleUsers({}, 'groupA');
            var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
            dialogScope = { $applyAsync : function (fn) { fn(); } };
            dialogMdDialog = jasmine.createSpyObj('dialogMdDialog', ['hide', 'cancel']);
            dialogOptions.controller(dialogScope, dialogMdDialog);
        });

        function simulateFileUpload(fileContents) {
            fakeReader.result = fileContents;
            dialogScope.getUsers({ currentTarget : { files : [ {} ] } });
            fakeReader.onload();
        }

        it('parses valid usernames from the uploaded file', function () {
            simulateFileUpload('alice\nbob\ncarol');

            expect(dialogScope.userstoimport).toEqual(['alice', 'bob', 'carol']);
        });

        it('de-duplicates usernames', function () {
            simulateFileUpload('alice\nalice\nbob');

            expect(dialogScope.userstoimport).toEqual(['alice', 'bob']);
        });

        it('filters out lines that are blank once invalid characters are stripped', function () {
            simulateFileUpload('alice\n!!!\nbob');

            expect(dialogScope.userstoimport).not.toContain('');
            expect(dialogScope.userstoimport).toEqual(['alice', 'bob']);
        });

    });

});
