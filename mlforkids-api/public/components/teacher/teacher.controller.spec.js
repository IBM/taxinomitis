describe('TeacherController - API keys menu', function () {

    var $compile, $rootScope, $controller, $q, $templateCache;
    var authServiceMock, usersServiceMock, $mdDialogMock;
    var element;

    var TEMPLATE_PATH = 'public/components/teacher/teacher.html';

    // Only the opening tag of the API keys menu box is needed: it holds both
    // the ng-if that decides whether the box is shown, and the ng-class for
    // the missing credentials warning. Its contents need ui-sref/translate,
    // which this spec doesn't load.
    function extractApiKeysMenuOpenTag() {
        var html = $templateCache.get(TEMPLATE_PATH);
        var match = /<div class="mlprojectmenu"\s+ng-if="[^"]*isManaged[^"]*"[^>]*>/.exec(html);
        if (!match) {
            throw new Error('Could not find the API keys menu markup in ' + TEMPLATE_PATH);
        }
        return match[0];
    }

    beforeEach(module('app'));
    beforeEach(module('ml4kTemplates'));

    beforeEach(inject(function (_$compile_, _$rootScope_, _$controller_, _$q_, _$templateCache_) {
        $compile = _$compile_;
        $rootScope = _$rootScope_;
        $controller = _$controller_;
        $q = _$q_;
        $templateCache = _$templateCache_;
    }));

    beforeEach(function () {
        authServiceMock = jasmine.createSpyObj('authService', ['getProfileDeferred', 'logout']);
        authServiceMock.getProfileDeferred.and.returnValue($q.resolve({
            user_id : 'teacher1', tenant : 'class1', role : 'supervisor'
        }));
        usersServiceMock = jasmine.createSpyObj('usersService', ['getClassPolicy', 'deleteClass']);
        $mdDialogMock = jasmine.createSpyObj('$mdDialog', ['confirm', 'show']);
    });

    afterEach(function () {
        if (element) {
            element.remove();
        }
    });

    function policyFixture(overrides) {
        return angular.extend({
            isManaged : false,
            tenantType : 0,
            maxTextModels : 0,
            needsWatsonApiKeys : true,
            supportedProjectTypes : [ 'text', 'imgtfjs', 'numbers', 'sounds' ]
        }, overrides || {});
    }

    // returns the API keys menu box, or null if it isn't shown
    function renderApiKeysMenu(policy) {
        usersServiceMock.getClassPolicy.and.returnValue($q.resolve(policy));

        var scope = $rootScope.$new();
        scope.vm = $controller('TeacherController', {
            authService : authServiceMock,
            usersService : usersServiceMock,
            $mdDialog : $mdDialogMock
        });
        $rootScope.$digest();

        // ng-if needs a parent element to insert the box into
        element = $compile('<div>' + extractApiKeysMenuOpenTag() + '</div></div>')(scope);
        $rootScope.$digest();

        return element[0].querySelector('.mlprojectmenu');
    }


    describe('visibility', function () {

        it('is shown for an unmanaged class with keys', function () {
            var menu = renderApiKeysMenu(policyFixture({ maxTextModels : 2, needsWatsonApiKeys : true }));
            expect(menu).not.toBeNull();
        });

        it('is shown for an unmanaged class without keys when the text service is not configured', function () {
            var menu = renderApiKeysMenu(policyFixture({ maxTextModels : 0, needsWatsonApiKeys : true }));
            expect(menu).not.toBeNull();
        });

        it('is hidden for an unmanaged class without keys when the text service is configured', function () {
            var menu = renderApiKeysMenu(policyFixture({ maxTextModels : 0, needsWatsonApiKeys : false }));
            expect(menu).toBeNull();
        });

        it('is hidden for a managed class', function () {
            var menu = renderApiKeysMenu(policyFixture({ isManaged : true, tenantType : 2, needsWatsonApiKeys : false }));
            expect(menu).toBeNull();
        });

        it('is hidden before the class policy has loaded', function () {
            usersServiceMock.getClassPolicy.and.returnValue($q.defer().promise);

            var scope = $rootScope.$new();
            scope.vm = $controller('TeacherController', {
                authService : authServiceMock,
                usersService : usersServiceMock,
                $mdDialog : $mdDialogMock
            });
            $rootScope.$digest();
            element = $compile('<div>' + extractApiKeysMenuOpenTag() + '</div></div>')(scope);
            $rootScope.$digest();

            expect(element[0].querySelector('.mlprojectmenu')).toBeNull();
        });

    });


    describe('missing credentials warning', function () {

        it('is shown for a class without keys that supports text projects, when the text service is not configured', function () {
            var menu = renderApiKeysMenu(policyFixture({ maxTextModels : 0, needsWatsonApiKeys : true }));
            expect(menu.classList.contains('warningmenu')).toBe(true);
        });

        it('is not shown for a class with keys', function () {
            var menu = renderApiKeysMenu(policyFixture({ maxTextModels : 2, needsWatsonApiKeys : true }));
            expect(menu.classList.contains('warningmenu')).toBe(false);
        });

        it('is not shown for a class without keys that does not support text projects', function () {
            var menu = renderApiKeysMenu(policyFixture({
                maxTextModels : 0,
                needsWatsonApiKeys : true,
                supportedProjectTypes : [ 'imgtfjs', 'numbers', 'sounds' ]
            }));
            expect(menu.classList.contains('warningmenu')).toBe(false);
        });

    });

});
