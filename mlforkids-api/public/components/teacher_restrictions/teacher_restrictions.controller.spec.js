describe('TeacherRestrictionsController', function () {

    var $controller;
    var $q;
    var $rootScope;

    var authServiceMock, usersServiceMock, $mdDialogMock;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
    }));

    beforeEach(function () {
        authServiceMock = jasmine.createSpyObj('authService', ['getProfileDeferred', 'login']);

        usersServiceMock = jasmine.createSpyObj('usersService', ['getClassPolicy', 'modifyClassPolicy']);

        $mdDialogMock = jasmine.createSpyObj('$mdDialog', ['show']);
    });

    function createController() {
        return $controller('TeacherRestrictionsController', {
            authService : authServiceMock,
            usersService : usersServiceMock,
            $mdDialog : $mdDialogMock
        });
    }

    function supervisorProfile() {
        return { user_id : 'teacher1', tenant : 'class1', role : 'supervisor' };
    }

    function policyFixture(overrides) {
        return angular.extend({
            maxUsers : 30,
            maxProjectsPerUser : 3,
            maxTextModels : 3,
            textTrainingItemsPerProject : 10,
            numberTrainingItemsPerProject : 20,
            imageTrainingItemsPerProject : 30,
            soundTrainingItemsPerProject : 40,
            textClassifierExpiry : 48,
            tenantType : 1,
            supportedProjectTypes : [ 'text', 'numbers', 'imgtfjs', 'sounds' ]
        }, overrides || {});
    }


    describe('initial state', function () {

        it('starts with no alerts and saving false', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.defer().promise);

            var vm = createController();

            expect(vm.saving).toBe(false);
            expect(vm.errors).toEqual([]);
            expect(vm.warnings).toEqual([]);
        });

    });


    describe('loading the class policy', function () {

        it('does not fetch the class policy for a non-supervisor', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.resolve({ role : 'student' }));

            var vm = createController();
            $rootScope.$digest();

            expect(usersServiceMock.getClassPolicy).not.toHaveBeenCalled();
            expect(vm.policy).toBeUndefined();
        });

        it('fetches and stores the class policy for a supervisor, unmodified', function () {
            var policy = policyFixture();
            authServiceMock.getProfileDeferred.and.returnValue($q.resolve(supervisorProfile()));
            usersServiceMock.getClassPolicy.and.returnValue($q.resolve(policy));

            var vm = createController();
            $rootScope.$digest();

            expect(usersServiceMock.getClassPolicy).toHaveBeenCalledWith(supervisorProfile());
            // regression check: supportedProjectTypes must be left exactly as
            // the server returned it - the template's indexOf('imgtfjs') /
            // indexOf('sounds') / indexOf('text') / indexOf('numbers') checks
            // rely on these being the raw, unmodified type identifiers
            expect(vm.policy.supportedProjectTypes).toEqual([ 'text', 'numbers', 'imgtfjs', 'sounds' ]);
        });

        it('shows an error alert if fetching the profile fails', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.reject({ status : 500, data : { error : 'boom' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toBe('boom');
        });

        it('shows an error alert if fetching the class policy fails', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.resolve(supervisorProfile()));
            usersServiceMock.getClassPolicy.and.returnValue($q.reject({ status : 500, data : { error : 'boom' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toBe('boom');
        });

        it('defaults the alert message to "Unknown error" when the failure has no message or error field', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.reject({ status : 500 }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors[0].message).toBe('Unknown error');
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


    describe('modifyExpiry dialog setup', function () {

        it('shows the dialog with the expected template and options', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.resolve(supervisorProfile()));
            usersServiceMock.getClassPolicy.and.returnValue($q.resolve(policyFixture()));
            $mdDialogMock.show.and.returnValue($q.defer().promise);
            var vm = createController();
            $rootScope.$digest();
            var fakeEvent = {};

            vm.modifyExpiry(fakeEvent);

            var config = $mdDialogMock.show.calls.mostRecent().args[0];
            expect(config.templateUrl).toBe('static/components/teacher_restrictions/modifyexpiry.tmpl.html');
            expect(config.targetEvent).toBe(fakeEvent);
            expect(config.clickOutsideToClose).toBe(true);
        });

        // the dialog's own controller is defined inline and never compiled in
        // these tests, but $mdDialog.show's config object exposes it directly -
        // invoking it here is the only way to exercise hoursfilter(), which is
        // dense with edge cases and cheap to test exhaustively per
        // FRONTEND_TESTING.md
        function invokeDialogController() {
            var config = $mdDialogMock.show.calls.mostRecent().args[0];
            var dialogScope = $rootScope.$new();
            var dialogMdDialog = jasmine.createSpyObj('$mdDialog', ['hide', 'cancel']);
            config.controller(dialogScope, dialogMdDialog);
            return { scope : dialogScope, mdDialog : dialogMdDialog };
        }

        function setupDialog(textClassifierExpiry) {
            authServiceMock.getProfileDeferred.and.returnValue($q.resolve(supervisorProfile()));
            usersServiceMock.getClassPolicy.and.returnValue($q.resolve(policyFixture({ textClassifierExpiry : textClassifierExpiry })));
            $mdDialogMock.show.and.returnValue($q.defer().promise);
            var vm = createController();
            $rootScope.$digest();
            vm.modifyExpiry({});
            return invokeDialogController();
        }

        it('initialises both initialtextexpiry and textexpiry from the current policy value', function () {
            var dialog = setupDialog(48);

            expect(dialog.scope.initialtextexpiry).toBe(48);
            expect(dialog.scope.textexpiry).toBe(48);
        });

        it('hide() delegates to the injected $mdDialog', function () {
            var dialog = setupDialog(48);
            dialog.scope.hide();
            expect(dialog.mdDialog.hide).toHaveBeenCalledWith();
        });

        it('cancel() delegates to the injected $mdDialog', function () {
            var dialog = setupDialog(48);
            dialog.scope.cancel();
            expect(dialog.mdDialog.cancel).toHaveBeenCalled();
        });

        it('confirm(resp) hides the dialog, resolving with the given response', function () {
            var dialog = setupDialog(48);
            var resp = { textexpiry : 72 };
            dialog.scope.confirm(resp);
            expect(dialog.mdDialog.hide).toHaveBeenCalledWith(resp);
        });

        describe('hoursfilter', function () {

            var hoursfilter;

            beforeEach(function () {
                hoursfilter = setupDialog(48).scope.hoursfilter;
            });

            it('formats exactly 1 hour as singular', function () {
                expect(hoursfilter(1)).toBe('1 hour');
            });

            it('formats under a day as plural hours', function () {
                expect(hoursfilter(2)).toBe('2 hours');
                expect(hoursfilter(23)).toBe('23 hours');
            });

            it('formats exactly 1 day', function () {
                expect(hoursfilter(24)).toBe('1 day');
            });

            it('formats between 1 day and 1 week as days and hours', function () {
                expect(hoursfilter(25)).toBe('1 days, 1 hours');
                expect(hoursfilter(48)).toBe('2 days, 0 hours');
                expect(hoursfilter(167)).toBe('6 days, 23 hours');
            });

            it('formats exactly 1 week', function () {
                expect(hoursfilter(168)).toBe('1 week');
            });

            it('formats over 1 week as weeks, days and hours', function () {
                expect(hoursfilter(169)).toBe('1 week, 0 days, 1 hours');
                expect(hoursfilter(192)).toBe('1 week, 1 days, 0 hours');
                expect(hoursfilter(255)).toBe('1 week, 3 days, 15 hours');
            });

        });

    });


    describe('modifyExpiry saving', function () {

        function setupReady(textClassifierExpiry) {
            authServiceMock.getProfileDeferred.and.returnValue($q.resolve(supervisorProfile()));
            usersServiceMock.getClassPolicy.and.returnValue($q.resolve(policyFixture({ textClassifierExpiry : textClassifierExpiry || 48 })));
            var vm = createController();
            $rootScope.$digest();
            return vm;
        }

        it('shows a "..." placeholder and marks saving while the request is in flight', function () {
            var vm = setupReady(48);
            $mdDialogMock.show.and.returnValue($q.resolve({ textexpiry : 72 }));
            usersServiceMock.modifyClassPolicy.and.returnValue($q.defer().promise);

            vm.modifyExpiry({});
            $rootScope.$digest();

            expect(vm.saving).toBe(true);
            expect(vm.policy.textClassifierExpiry).toBe('...');
            expect(usersServiceMock.modifyClassPolicy).toHaveBeenCalledWith(vm.profile, 72);
        });

        it('updates the policy with the server response on success', function () {
            var vm = setupReady(48);
            $mdDialogMock.show.and.returnValue($q.resolve({ textexpiry : 72 }));
            usersServiceMock.modifyClassPolicy.and.returnValue($q.resolve({ textClassifierExpiry : 72 }));

            vm.modifyExpiry({});
            $rootScope.$digest();

            expect(vm.saving).toBe(false);
            expect(vm.policy.textClassifierExpiry).toBe(72);
        });

        it('reverts to the original value and shows an error alert on failure', function () {
            var vm = setupReady(48);
            $mdDialogMock.show.and.returnValue($q.resolve({ textexpiry : 72 }));
            usersServiceMock.modifyClassPolicy.and.returnValue($q.reject({ status : 500, data : { error : 'save failed' } }));

            vm.modifyExpiry({});
            $rootScope.$digest();

            expect(vm.saving).toBe(false);
            expect(vm.policy.textClassifierExpiry).toBe(48);
            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toBe('save failed');
        });

        it('does nothing when the dialog is cancelled', function () {
            var vm = setupReady(48);
            $mdDialogMock.show.and.returnValue($q.reject());

            vm.modifyExpiry({});
            $rootScope.$digest();

            expect(usersServiceMock.modifyClassPolicy).not.toHaveBeenCalled();
            expect(vm.saving).toBe(false);
            expect(vm.policy.textClassifierExpiry).toBe(48);
        });

    });

});
