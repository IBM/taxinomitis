describe('webcam directive', function () {

    var $compile;
    var $rootScope;
    var getUserMediaResult;

    beforeEach(function () {
        module('webcam');

        inject(function (_$compile_, _$rootScope_) {
            $compile = _$compile_;
            $rootScope = _$rootScope_;
        });

        getUserMediaResult = {
            then : function (onFulfilled) { this._onFulfilled = onFulfilled; return this; },
            catch : function (onRejected) { this._onRejected = onRejected; return this; }
        };
        spyOn(navigator, 'getMedia').and.returnValue(getUserMediaResult);
    });


    function compileDirective(onError, onStream) {
        var scope = $rootScope.$new();
        scope.config = {};
        scope.handleError = onError || function () {};
        scope.handleStream = onStream || function () {};

        var element = $compile(
            '<webcam channel="config" on-error="handleError(err)" on-stream="handleStream()"></webcam>'
        )(scope);
        scope.$digest();
        return element;
    }


    it('routes a rejected video.play() promise to onError instead of leaving it unhandled', function () {
        var playResult = {
            catch : function (onRejected) { this._onRejected = onRejected; return this; }
        };
        spyOn(HTMLMediaElement.prototype, 'play').and.returnValue(playResult);

        var onError = jasmine.createSpy('onError');
        compileDirective(onError);
        getUserMediaResult._onFulfilled(new MediaStream());

        var playRejection = new Error(
            'The request is not allowed by the user agent or the platform in the current context, ' +
            'possibly because the user denied permission.'
        );
        playRejection.name = 'NotAllowedError';
        playResult._onRejected(playRejection);

        expect(onError).toHaveBeenCalledWith(playRejection);
    });


    it('does not call onError when video.play() resolves normally', function () {
        var playResult = {
            catch : function () { return this; }
        };
        spyOn(HTMLMediaElement.prototype, 'play').and.returnValue(playResult);

        var onError = jasmine.createSpy('onError');
        var onStream = jasmine.createSpy('onStream');
        compileDirective(onError, onStream);
        getUserMediaResult._onFulfilled(new MediaStream());

        expect(onError).not.toHaveBeenCalled();
        expect(onStream).toHaveBeenCalled();
    });


    it('does not throw when video.play() does not return a promise (older browsers)', function () {
        spyOn(HTMLMediaElement.prototype, 'play').and.returnValue(undefined);

        var onError = jasmine.createSpy('onError');

        expect(function () {
            compileDirective(onError);
            getUserMediaResult._onFulfilled(new MediaStream());
        }).not.toThrow();

        expect(onError).not.toHaveBeenCalled();
    });

});
