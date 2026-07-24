// These reproduce two real bugs that only showed up with jQuery + Bootstrap's
// actual collapse.js loaded (see karma.conf.js) - neither could be caught by
// a controller-only unit test, since they're both about how Bootstrap's
// document-level delegated click handling interacts with Angular's DOM
// updates.
//
// The group twisty used to be:
//   <a data-toggle="collapse" href="#group{{$index}}" ng-click="collapsePanel(group)">
//     <span ng-hide="isPanelCollapsed(group)" class="glyphicon-chevron-right"></span>
//     <span ng-if="isPanelCollapsed(group)" class="glyphicon-chevron-down"></span>
//   </a>
//   <div id="group{{$index}}" class="panel-collapse collapse">
//
// Bug 1 (fixed by dropping data-toggle/href/target from the <a>): Bootstrap's
// collapse "data-api" click handler only calls e.preventDefault() if it can
// match the delegated selector by walking up from event.target to document
// (bootstrap.js ~line 747). Clicking the chevron-right icon (always present,
// just hidden via ng-hide/CSS) worked fine. But clicking the chevron-down
// icon (only present via ng-if while expanded) triggered collapsePanel()
// synchronously via ng-click's $apply, which ran a $digest that flipped
// ng-if back to false and removed the clicked span from the DOM before the
// click event finished bubbling to document. With the span detached,
// Bootstrap's delegated handler could no longer find its `<a>` ancestor,
// e.preventDefault() never ran, and the browser followed the anchor's href
// like a real link - instead of just collapsing the panel.
//
// Bug 2 (fixed by adding `ng-class="{in: isPanelCollapsed(group)}"` to the
// panel body, and removing Bootstrap's involvement entirely): the panel body
// itself had no Angular binding - its visibility was only ever toggled by
// Bootstrap's collapse.js adding/removing the "in" class, via its own
// document-delegated (and CSS-transition-timed) click handling, completely
// independent of isPanelCollapsed(group)/the chevron icon. Since that
// handler suffered from exactly the same "detached node" problem as bug 1,
// the panel body and the icon could end up disagreeing about whether the
// group was open.
describe('TeacherStudentsController - group twisty click handling', function () {

    var $compile, $rootScope, $controller, $q, $templateCache;
    var authServiceMock, usersServiceMock, scrollServiceMock, readersServiceMock, loggerServiceMock;
    var $mdDialogMock;
    var element;

    var TEMPLATE_PATH = 'public/components/teacher_students/teacher_students.html';

    // Pulls the group twisty <a>...</a> straight out of the real template
    // (loaded into $templateCache by ngHtml2JsPreprocessor - see
    // karma.conf.js) rather than keeping a hand-copied duplicate of the
    // markup in this spec, which could silently drift from the real page.
    function extractGroupTwistyMarkup() {
        var html = $templateCache.get(TEMPLATE_PATH);
        var match = /<a ng-click="collapsePanel\(group\)">[\s\S]*?<\/a>/.exec(html);
        if (!match) {
            throw new Error('Could not find the group twisty markup in ' + TEMPLATE_PATH);
        }
        return match[0];
    }

    // Only the opening tag of the collapsible group body is needed to check
    // whether its visibility is wired up to isPanelCollapsed(group) - its
    // real content needs md-checkbox/md-select/translate and other
    // dependencies this spec doesn't load.
    function extractGroupPanelBodyOpenTag() {
        var html = $templateCache.get(TEMPLATE_PATH);
        var match = /<div id="group\{\{\$index\}\}"[^>]*>/.exec(html);
        if (!match) {
            throw new Error('Could not find the group panel body markup in ' + TEMPLATE_PATH);
        }
        return match[0].replace('{{$index}}', '0') + '</div>';
    }

    beforeEach(module('app'));
    beforeEach(module('ml4kTemplates'));

    // The real markup includes a `| translate` filter, which this test
    // doesn't otherwise load (see test/karma/fake-app-module.js) - stub it
    // out as a pass-through, since the translated text isn't relevant here.
    beforeEach(module(function ($provide) {
        $provide.factory('translateFilter', function () {
            return function (input) {
                return input;
            };
        });
    }));

    beforeEach(inject(function (_$compile_, _$rootScope_, _$controller_, _$q_, _$templateCache_) {
        $compile = _$compile_;
        $rootScope = _$rootScope_;
        $controller = _$controller_;
        $q = _$q_;
        $templateCache = _$templateCache_;
    }));

    beforeEach(function () {
        authServiceMock = {
            getProfileDeferred : jasmine.createSpy('getProfileDeferred').and.returnValue($q.resolve({
                user_id : 'teacher1', tenant : 'class1', role : 'supervisor', groups : ['groupA']
            }))
        };
        usersServiceMock = jasmine.createSpyObj('usersService', ['getClassPolicy', 'getStudentList']);
        usersServiceMock.getClassPolicy.and.returnValue($q.resolve({ maxUsers : 40 }));
        usersServiceMock.getStudentList.and.returnValue($q.resolve([]));
        scrollServiceMock = jasmine.createSpyObj('scrollService', ['scrollToNewItem']);
        readersServiceMock = jasmine.createSpyObj('readersService', ['createFileReader']);
        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error']);
        $mdDialogMock = jasmine.createSpyObj('$mdDialog', ['confirm', 'show', 'alert']);
    });

    afterEach(function () {
        if (element) {
            element.remove();
        }
        location.hash = '';
    });

    it('does not follow the href when collapsing an already-open group', function () {
        var scope = $rootScope.$new();
        $controller('TeacherStudentsController', {
            authService : authServiceMock,
            usersService : usersServiceMock,
            scrollService : scrollServiceMock,
            readersService : readersServiceMock,
            $scope : scope,
            $mdDialog : $mdDialogMock,
            loggerService : loggerServiceMock
        });
        $rootScope.$digest();

        scope.group = 'groupA';
        scope.$index = 0;
        element = $compile(extractGroupTwistyMarkup())(scope);
        // Bootstrap's delegated handler is bound on `document`, so the
        // compiled element has to actually be part of the live document -
        // a detached/offline element would never reach it.
        document.body.appendChild(element[0]);
        $rootScope.$digest();

        // starting state: closed. Click the visible (chevron-right) icon to expand.
        var chevronRight = element[0].querySelector('.glyphicon-chevron-right');
        chevronRight.click();
        $rootScope.$digest();

        expect(scope.isPanelCollapsed('groupA')).toBe(true); // true == expanded, despite the name

        // now open. Click the visible (chevron-down) icon to collapse it again.
        var chevronDown = element[0].querySelector('.glyphicon-chevron-down');
        expect(chevronDown).not.toBeNull();
        chevronDown.click();
        $rootScope.$digest();

        expect(scope.isPanelCollapsed('groupA')).toBe(false);
        expect(location.hash).toBe('');
    });

    it('keeps the panel body visibility in sync with isPanelCollapsed(group)', function () {
        // The group's student list (`<div id="group{{$index}}" class="panel-collapse collapse">`,
        // teacher_students.html:61) had no Angular binding of its own - its
        // visibility was only ever toggled by Bootstrap's collapse.js adding/
        // removing the "in" CSS class, via its own async (CSS-transition
        // timed) click handling, entirely independently of
        // isPanelCollapsed(group). Since that handler fails to fire whenever
        // a click lands on the ng-if'd chevron (see the test above), the
        // panel body's "in" class and the icon can end up disagreeing about
        // whether the group is open - and because Bootstrap's own toggle is
        // asynchronous/CSS-transition-timed, driving it via real clicks here
        // would just make this test racy rather than proving the fix.
        // Instead, this asserts the fix directly: the panel body's "in"
        // class must be driven by isPanelCollapsed(group) itself (e.g. via
        // ng-class), so it can never fall out of step with the icon,
        // regardless of whether Bootstrap's own click handling ever runs.
        var scope = $rootScope.$new();
        $controller('TeacherStudentsController', {
            authService : authServiceMock,
            usersService : usersServiceMock,
            scrollService : scrollServiceMock,
            readersService : readersServiceMock,
            $scope : scope,
            $mdDialog : $mdDialogMock,
            loggerService : loggerServiceMock
        });
        $rootScope.$digest();

        scope.group = 'groupA';
        scope.$index = 0;

        var wrapper = document.createElement('div');
        wrapper.innerHTML = extractGroupPanelBodyOpenTag();
        element = $compile(wrapper)(scope);
        document.body.appendChild(element[0]);
        $rootScope.$digest();

        var panelBody = element[0].querySelector('#group0');

        function isPanelBodyOpen() {
            return panelBody.classList.contains('in');
        }

        expect(isPanelBodyOpen()).toBe(false);

        scope.collapsePanel('groupA');
        $rootScope.$digest();
        expect(scope.isPanelCollapsed('groupA')).toBe(true);
        expect(isPanelBodyOpen()).toBe(true);

        scope.collapsePanel('groupA');
        $rootScope.$digest();
        expect(scope.isPanelCollapsed('groupA')).toBe(false);
        expect(isPanelBodyOpen()).toBe(false);

        scope.collapsePanel('groupA');
        $rootScope.$digest();
        expect(scope.isPanelCollapsed('groupA')).toBe(true);
        expect(isPanelBodyOpen()).toBe(true);
    });

});
