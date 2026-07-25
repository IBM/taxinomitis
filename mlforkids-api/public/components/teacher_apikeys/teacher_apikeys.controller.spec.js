// NOTE: usersService is a full jasmine spy object below - every method on
// it is a mock with no real implementation. That means none of these tests
// ever make a real HTTP call, so nothing in this file can reach Watson/IBM Cloud.
describe('TeacherApiKeysController', function () {

    var $controller;
    var $q;
    var $rootScope;
    var $scope;

    var authServiceMock, usersServiceMock, scrollServiceMock, loggerServiceMock;
    var $mdDialogMock;

    // fresh object every test - some tests mutate the profile/credentials
    // in place, so reusing one shared object would leak state between tests
    var supervisorProfile;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
        $scope = $rootScope.$new();
    }));

    beforeEach(function () {
        supervisorProfile = { user_id : 'teacher1', tenant : 'class1', role : 'supervisor' };

        authServiceMock = {
            getProfileDeferred : jasmine.createSpy('getProfileDeferred').and.returnValue($q.resolve(supervisorProfile))
        };
        usersServiceMock = jasmine.createSpyObj('usersService', [
            'getClassPolicy', 'getCredentials',
            'verifyCredentials', 'deleteCredentials',
            'addCredentials', 'modifyCredentials'
        ]);
        usersServiceMock.getClassPolicy.and.returnValue($q.resolve({ isManaged : false }));
        usersServiceMock.getCredentials.and.returnValue($q.resolve([]));

        scrollServiceMock = jasmine.createSpyObj('scrollService', ['scrollToNewItem']);
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
        return $controller('TeacherApiKeysController', {
            authService : authServiceMock,
            usersService : usersServiceMock,
            scrollService : scrollServiceMock,
            $mdDialog : $mdDialogMock,
            loggerService : loggerServiceMock
        });
    }

    function creds(id, credstype) {
        return { id : id, apikey : 'key' + id, credstype : credstype };
    }

    // supervisor, unmanaged class, with the given initial conv credentials
    function createReadyController(initialCreds) {
        usersServiceMock.getCredentials.and.returnValue($q.resolve(initialCreds || []));
        var vm = createController();
        $rootScope.$digest();
        return vm;
    }


    describe('initialisation', function () {

        it('loads credentials for a supervisor of an unmanaged class', function () {
            usersServiceMock.getCredentials.and.returnValue($q.resolve([ creds(1, 'conv_lite') ]));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.profile).toEqual(supervisorProfile);
            expect(usersServiceMock.getClassPolicy).toHaveBeenCalledWith(supervisorProfile);
            expect(usersServiceMock.getCredentials).toHaveBeenCalledWith(supervisorProfile, 'conv');
            expect(vm.credentials.conv).toEqual([ creds(1, 'conv_lite') ]);
            expect(vm.credentials.loading.conv).toBe(false);
            expect(vm.credentials.totals.conv).toBe(5);
        });

        it('does not fetch credentials for a supervisor of a managed class', function () {
            usersServiceMock.getClassPolicy.and.returnValue($q.resolve({ isManaged : true }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.policy.isManaged).toBe(true);
            expect(usersServiceMock.getCredentials).not.toHaveBeenCalled();
            expect(vm.credentials).toBeUndefined();
        });

        it('does not fetch the class policy for a non-supervisor', function () {
            var studentProfile = { user_id : 'student1', tenant : 'class1', role : 'student' };
            authServiceMock.getProfileDeferred.and.returnValue($q.resolve(studentProfile));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.profile).toEqual(studentProfile);
            expect(usersServiceMock.getClassPolicy).not.toHaveBeenCalled();
            expect(vm.credentials).toBeUndefined();
        });

        it('records an error alert if fetching the profile fails', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.reject({ status : 401, data : { error : 'not authorised' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].status).toBe(401);
            expect(vm.errors[0].message).toBe('not authorised');
        });

        it('records an error alert if fetching the class policy fails', function () {
            usersServiceMock.getClassPolicy.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
        });

        it('records an error alert and marks credentials as failed if fetching credentials fails', function () {
            usersServiceMock.getCredentials.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.credentials.failed.conv).toBe(true);
            expect(vm.credentials.loading.conv).toBe(false);
            expect(vm.errors.length).toBe(1);
        });

    });


    describe('computeLimit (via credential loading)', function () {

        it('counts conv_lite and conv_plustrial as 5 models each', function () {
            var vm = createReadyController([ creds(1, 'conv_lite'), creds(2, 'conv_plustrial') ]);
            expect(vm.credentials.totals.conv).toBe(10);
        });

        it('counts conv_standard as 20 models', function () {
            var vm = createReadyController([ creds(1, 'conv_standard') ]);
            expect(vm.credentials.totals.conv).toBe(20);
        });

        it('counts conv_plus as 50 models', function () {
            var vm = createReadyController([ creds(1, 'conv_plus') ]);
            expect(vm.credentials.totals.conv).toBe(50);
        });

        it('adds up mixed credential types', function () {
            var vm = createReadyController([ creds(1, 'conv_lite'), creds(2, 'conv_standard') ]);
            expect(vm.credentials.totals.conv).toBe(25);
        });

        it('is 0 when there are no credentials', function () {
            var vm = createReadyController([]);
            expect(vm.credentials.totals.conv).toBe(0);
        });

        it('is UNKNOWN if any credential has an unrecognised credstype', function () {
            var vm = createReadyController([ creds(1, 'conv_standard'), creds(2, 'some_future_type') ]);
            expect(vm.credentials.totals.conv).toBe(vm.CONSTANTS.UNKNOWN);
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


    describe('verifyCredentials', function () {

        it('marks the credentials as verified on success', function () {
            var vm = createReadyController();
            var cred = creds(1, 'conv_lite');
            usersServiceMock.verifyCredentials.and.returnValue($q.resolve());

            vm.verifyCredentials({}, cred);
            $rootScope.$digest();

            expect(usersServiceMock.verifyCredentials).toHaveBeenCalledWith(vm.profile, cred);
            expect(cred.verified).toBe(true);
            expect(cred.verifying).toBe(false);
        });

        it('shows a dialog and leaves the credentials unverified on failure', function () {
            var vm = createReadyController();
            var cred = creds(1, 'conv_lite');
            usersServiceMock.verifyCredentials.and.returnValue($q.reject({ data : { error : 'invalid key' } }));

            vm.verifyCredentials({}, cred);
            $rootScope.$digest();

            expect(cred.verified).toBe(false);
            expect(cred.verifying).toBe(false);
            expect($mdDialogMock.alert).toHaveBeenCalled();
            expect($mdDialogMock.show).toHaveBeenCalled();
        });

    });


    describe('deleteCredentials', function () {

        var vm, cred;

        beforeEach(function () {
            cred = creds(1, 'conv_lite');
            vm = createReadyController([ cred ]);
        });

        it('removes the credentials and recomputes the limit on confirmation', function () {
            $mdDialogMock.show.and.returnValue($q.resolve());
            usersServiceMock.deleteCredentials.and.returnValue($q.resolve());

            vm.deleteCredentials({}, cred, 'conv');
            $rootScope.$digest();

            expect(usersServiceMock.deleteCredentials).toHaveBeenCalledWith(vm.profile, cred);
            expect(vm.credentials.conv).toEqual([]);
            expect(vm.credentials.totals.conv).toBe(0);
        });

        it('does not call the API when the confirmation is cancelled', function () {
            $mdDialogMock.show.and.returnValue($q.reject());

            vm.deleteCredentials({}, cred, 'conv');
            $rootScope.$digest();

            expect(usersServiceMock.deleteCredentials).not.toHaveBeenCalled();
            expect(vm.credentials.conv).toEqual([ cred ]);
        });

        it('records an error alert and keeps the credentials if the delete request fails', function () {
            $mdDialogMock.show.and.returnValue($q.resolve());
            usersServiceMock.deleteCredentials.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            vm.deleteCredentials({}, cred, 'conv');
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect(vm.credentials.conv).toEqual([ cred ]);
        });

    });


    describe('addCredentials', function () {

        var vm;

        beforeEach(function () {
            vm = createReadyController([]);
        });

        it('adds a placeholder immediately, then replaces it with the stored credentials', function () {
            $mdDialogMock.show.and.returnValue($q.resolve({ apikey : 'newkey', credstype : 'conv_lite' }));
            usersServiceMock.addCredentials.and.returnValue($q.resolve(creds('real1', 'conv_lite')));

            vm.addCredentials({}, 'conv');
            $rootScope.$digest();

            var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
            expect(dialogOptions.templateUrl).toBe('static/components/teacher_apikeys/newcredsconv.tmpl.html');

            expect(usersServiceMock.addCredentials).toHaveBeenCalledWith(
                jasmine.objectContaining({ apikey : 'newkey', credstype : 'conv_lite', servicetype : 'conv' }),
                'class1'
            );
            expect(vm.credentials.conv.length).toBe(1);
            expect(vm.credentials.conv[0].id).toBe('real1');
            expect(vm.credentials.totals.conv).toBe(5);
        });

        it('removes the placeholder and records an error alert if storing fails', function () {
            $mdDialogMock.show.and.returnValue($q.resolve({ apikey : 'newkey', credstype : 'conv_lite' }));
            usersServiceMock.addCredentials.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            vm.addCredentials({}, 'conv');
            $rootScope.$digest();

            expect(vm.credentials.conv).toEqual([]);
            expect(vm.errors.length).toBe(1);
            expect(scrollServiceMock.scrollToNewItem).toHaveBeenCalledWith('errors' + vm.errors[0].alertid);
        });

        it('does not call the API when the dialog is cancelled', function () {
            $mdDialogMock.show.and.returnValue($q.reject());

            vm.addCredentials({}, 'conv');
            $rootScope.$digest();

            expect(usersServiceMock.addCredentials).not.toHaveBeenCalled();
            expect(vm.credentials.conv).toEqual([]);
        });

    });


    describe('modifyCredentials', function () {

        var vm, cred;

        beforeEach(function () {
            cred = creds(1, 'conv_lite');
            vm = createReadyController([ cred ]);
        });

        it('updates the credstype and recomputes the limit on success', function () {
            $mdDialogMock.show.and.returnValue($q.resolve({ credstype : 'conv_standard' }));
            usersServiceMock.modifyCredentials.and.returnValue($q.resolve());

            vm.modifyCredentials({}, cred, 'conv');
            $rootScope.$digest();

            var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
            expect(dialogOptions.templateUrl).toBe('static/components/teacher_apikeys/modifycredsconv.tmpl.html');

            expect(usersServiceMock.modifyCredentials).toHaveBeenCalledWith(cred, 'conv', 'conv_standard', 'class1');
            expect(cred.credstype).toBe('conv_standard');
            expect(vm.credentials.totals.conv).toBe(20);
        });

        it('leaves the credstype unchanged and records an error alert if the update fails', function () {
            $mdDialogMock.show.and.returnValue($q.resolve({ credstype : 'conv_standard' }));
            usersServiceMock.modifyCredentials.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            vm.modifyCredentials({}, cred, 'conv');
            $rootScope.$digest();

            expect(cred.credstype).toBe('conv_lite');
            expect(vm.errors.length).toBe(1);
            expect(scrollServiceMock.scrollToNewItem).toHaveBeenCalledWith('errors' + vm.errors[0].alertid);
        });

        it('does not call the API when the dialog is cancelled', function () {
            $mdDialogMock.show.and.returnValue($q.reject());

            vm.modifyCredentials({}, cred, 'conv');
            $rootScope.$digest();

            expect(usersServiceMock.modifyCredentials).not.toHaveBeenCalled();
            expect(cred.credstype).toBe('conv_lite');
        });

    });


    describe('explainLimit', function () {

        it('shows an explanatory dialog', function () {
            var vm = createReadyController([]);

            vm.explainLimit();

            expect($mdDialogMock.alert).toHaveBeenCalled();
            expect($mdDialogMock.show).toHaveBeenCalled();
        });

    });

});
