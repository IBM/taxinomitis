// Guards against a regression of a real bug reported via Sentry: the
// file-upload <input>'s onchange handler is a raw HTML attribute, which used
// to be:
//   onchange="angular.element(this).scope().uploadTrainingData(event, this)"
// - with no guard against .scope() returning undefined. In production this
// happened when a student's session expired (a background poll got a 401,
// which triggers authService.sessionExpired() -> $mdDialog.alert() ->
// $state.go('login') - see auth.service.js) while the browser's native
// file-picker dialog was still open. The state transition tore down the
// training view's DOM while the dialog sat open; when the student then
// finished picking files, `change` fired on an <input> whose Angular scope
// had already been severed, and `angular.element(this).scope()` returned
// undefined, throwing "Cannot read properties of undefined (reading
// 'uploadTrainingData')". Fixed by guarding each onchange attribute with
// `var s = angular.element(this).scope(); if (s) { ... }` - a controller-only
// test can't see this class of bug, since it never $compiles the template or
// exercises the raw onchange attribute.
//
// This doesn't need to reproduce the rare timing race itself (a session
// expiring while a native OS dialog happens to be open) - only its effect:
// an element whose Angular scope has been severed, followed by a change
// event firing on it anyway. Removing a compiled element from the document
// is what actually severs angular.element(node).scope() (real jQuery is
// loaded before angular.js here, matching production - see karma.conf.js -
// and jQuery's .remove() cleans up the $scope data it stored via .data()),
// which is also what happens to the old view's DOM on a ui-router state
// transition.
describe('training.html - file upload <input> onchange handling', function () {

    var $compile, $rootScope, $templateCache;
    var element;

    var TEMPLATE_PATH = 'public/components/training/training.html';

    // Pulls the image-upload <input> straight out of the real template
    // (loaded into $templateCache by ngHtml2JsPreprocessor - see
    // karma.conf.js) rather than keeping a hand-copied duplicate of the
    // markup in this spec, which could silently drift from the real page.
    function extractImageUploadInputMarkup() {
        var html = $templateCache.get(TEMPLATE_PATH);
        var match = /<input id="image-file-upload-\{\{\$index\}\}"[\s\S]*?\/>/.exec(html);
        if (!match) {
            throw new Error('Could not find the image upload <input> markup in ' + TEMPLATE_PATH);
        }
        return match[0];
    }

    beforeEach(module('app'));
    beforeEach(module('ml4kTemplates'));

    beforeEach(inject(function (_$compile_, _$rootScope_, _$templateCache_) {
        $compile = _$compile_;
        $rootScope = _$rootScope_;
        $templateCache = _$templateCache_;
    }));

    afterEach(function () {
        if (element) {
            element.remove();
        }
    });

    it('does not throw when a change event fires on an input after its scope has been torn down', function () {
        var scope = $rootScope.$new();
        scope.project = { type : 'imgtfjs', storage : 'local' };
        scope.label = 'cat';
        scope.$index = 0;
        scope.uploadTrainingData = jasmine.createSpy('uploadTrainingData');

        // wrapped in a plain div, since the <input> itself has ng-if - $compile
        // replaces it with a comment anchor and only inserts the real,
        // linked <input> as a sibling once a digest evaluates the condition
        var wrapper = document.createElement('div');
        wrapper.innerHTML = extractImageUploadInputMarkup();
        element = $compile(wrapper)(scope);
        document.body.appendChild(element[0]);
        $rootScope.$digest();

        var input = element[0].querySelector('input[type="file"]');
        expect(input).not.toBeNull();
        expect(angular.element(input).scope()).toBeDefined();

        // simulate the training view being torn down (e.g. a ui-router
        // state transition triggered by a session expiring) while the
        // native file-picker dialog is still open
        element.remove();
        expect(angular.element(input).scope()).toBeUndefined();

        // the native file dialog then closes, and the browser fires `change`
        // on the input regardless of whether it's still attached to the
        // document - the inline onchange attribute handler survives on the
        // node even though its Angular scope has gone
        expect(function () {
            input.dispatchEvent(new Event('change'));
        }).not.toThrow();

        expect(scope.uploadTrainingData).not.toHaveBeenCalled();
    });

});
