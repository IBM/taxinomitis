describe('PretrainedController', function () {

    var $controller;
    var $q;
    var $rootScope;

    var scratchServiceMock, loggerServiceMock, $mdDialogMock, $locationMock, $windowMock;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
    }));

    beforeEach(function () {
        scratchServiceMock = jasmine.createSpyObj('scratchService', ['newTfjsExtension']);
        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error']);
        $mdDialogMock = jasmine.createSpyObj('$mdDialog', ['show', 'hide', 'cancel']);
        $windowMock = jasmine.createSpyObj('$window', ['open']);

        $locationMock = jasmine.createSpyObj('$location', ['protocol', 'host', 'port']);
        $locationMock.protocol.and.returnValue('https');
        $locationMock.host.and.returnValue('machinelearningforkids.co.uk');
        $locationMock.port.and.returnValue(null);
    });

    function createController() {
        return $controller('PretrainedController', {
            scratchService : scratchServiceMock,
            loggerService : loggerServiceMock,
            $mdDialog : $mdDialogMock,
            $location : $locationMock,
            $window : $windowMock
        });
    }


    describe('site url', function () {

        it('does not include a port when there is none', function () {
            var vm = createController();
            vm.openTensorFlowDialog({});

            var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
            var scope = {};
            dialogOptions.controller(scope);

            expect(scope.siteurl).toBe('https://machinelearningforkids.co.uk');
        });

        it('includes the port when one is set', function () {
            $locationMock.port.and.returnValue(8080);

            var vm = createController();
            vm.openTensorFlowDialog({});

            var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
            var scope = {};
            dialogOptions.controller(scope);

            expect(scope.siteurl).toBe('https://machinelearningforkids.co.uk:8080');
        });

    });


    describe('openTensorFlowDialog', function () {

        it('shows the tfjs dialog template', function () {
            var vm = createController();
            var ev = {};

            vm.openTensorFlowDialog(ev);

            var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
            expect(dialogOptions.templateUrl).toBe('static/components/pretrained/tfjs.tmpl.html');
            expect(dialogOptions.targetEvent).toBe(ev);
            expect(dialogOptions.clickOutsideToClose).toBe(true);
        });

    });


    describe('inner dialog controller', function () {

        function getDialogScope() {
            var vm = createController();
            vm.openTensorFlowDialog({});
            var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
            var scope = {};
            dialogOptions.controller(scope);
            return scope;
        }

        it('initialises default scope values', function () {
            var scope = getDialogScope();

            expect(scope.modeljson).toBe('');
            expect(scope.scratchkey).toBe(':scratchkey');
            expect(scope.modeltypeid).toBe(10);
            expect(scope.validating).toBe(false);
        });

        it('hide() hides the dialog', function () {
            var scope = getDialogScope();
            scope.hide();
            expect($mdDialogMock.hide).toHaveBeenCalledWith();
        });

        it('cancel() cancels the dialog', function () {
            var scope = getDialogScope();
            scope.cancel();
            expect($mdDialogMock.cancel).toHaveBeenCalled();
        });

        describe('generateScratchKey', function () {

            it('encodes the model url and type, and clears any error', function () {
                var scope = getDialogScope();
                scope.error = true;

                scope.generateScratchKey('https://example.com/model.json', 10);

                expect(scope.error).toBe(false);
                expect(JSON.parse(decodeURIComponent(scope.scratchkey))).toEqual({
                    modelurl : 'https://example.com/model.json',
                    modeltypeid : 10
                });
            });

        });

        describe('confirm', function () {

            it('creates the extension and opens it in a new tab on success', function () {
                var scope = getDialogScope();
                scope.modeljson = 'https://example.com/model.json';
                scope.modeltypeid = 10;
                scratchServiceMock.newTfjsExtension.and.returnValue($q.resolve({ url : '/api/scratchtfjs/extensions/1' }));

                scope.confirm();
                $rootScope.$digest();

                expect(scratchServiceMock.newTfjsExtension).toHaveBeenCalledWith({
                    modelurl : 'https://example.com/model.json',
                    modeltype : 'teachablemachineimage'
                });
                expect($windowMock.open).toHaveBeenCalledWith(
                    '/scratch/?url=https://machinelearningforkids.co.uk/api/scratchtfjs/extensions/1', '_blank'
                );
                expect(scope.validating).toBe(false);
                expect($mdDialogMock.hide).toHaveBeenCalledWith();
            });

            it('uses the graphdefimage model type when modeltypeid is not 10', function () {
                var scope = getDialogScope();
                scope.modeltypeid = 20;
                scratchServiceMock.newTfjsExtension.and.returnValue($q.resolve({ url : '/api/scratchtfjs/extensions/1' }));

                scope.confirm();
                $rootScope.$digest();

                expect(scratchServiceMock.newTfjsExtension).toHaveBeenCalledWith(jasmine.objectContaining({
                    modeltype : 'graphdefimage'
                }));
            });

            it('sets an error and stops validating if the model is not found', function () {
                var scope = getDialogScope();
                scratchServiceMock.newTfjsExtension.and.returnValue($q.reject({ status : 404 }));

                scope.confirm();
                $rootScope.$digest();

                expect(scope.error).toBe(true);
                expect(scope.validating).toBe(false);
                expect($mdDialogMock.hide).not.toHaveBeenCalled();
                expect($windowMock.open).not.toHaveBeenCalled();
            });

        });

    });

});
