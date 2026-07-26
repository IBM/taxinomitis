describe('ModelTextDescribeController', function () {

    var $controller;
    var $q;
    var $rootScope;
    var $scope;
    var $timeout;
    var $interval;

    var authServiceMock, projectsServiceMock, trainingServiceMock, fcnnVisualisationServiceMock,
        loggerServiceMock, utilServiceMock, scrollServiceMock;
    var $stateParamsMock;

    var profile;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_, _$timeout_, _$interval_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
        $timeout = _$timeout_;
        $interval = _$interval_;
        $scope = $rootScope.$new();
    }));

    beforeEach(function () {
        profile = { user_id : 'user1', tenant : 'class1' };

        authServiceMock = jasmine.createSpyObj('authService', ['getProfileDeferred', 'login']);
        authServiceMock.getProfileDeferred.and.returnValue($q.resolve(profile));

        projectsServiceMock = jasmine.createSpyObj('projectsService', ['getProject']);

        trainingServiceMock = jasmine.createSpyObj('trainingService', ['getModels', 'getModel']);

        fcnnVisualisationServiceMock = jasmine.createSpyObj('fcnnVisualisationService', [
            'init', 'create', 'clearInputLabels', 'hideAnnotation', 'updateInputText',
            'highlightInputText', 'updateLabels', 'showAnnotation', 'displayWeights',
            'removeValues', 'updateOutputHtml', 'toggleLayerHighlight', 'remove_focus',
            'highlightHiddenLayerNode'
        ]);

        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error', 'warn']);

        utilServiceMock = jasmine.createSpyObj('utilService', ['loadScript']);
        utilServiceMock.loadScript.and.returnValue($q.resolve());

        scrollServiceMock = jasmine.createSpyObj('scrollService', ['scrollToNewItem']);

        $stateParamsMock = { projectId : 'proj1', userId : 'user1', modelId : 'model1' };
    });

    function createController() {
        return $controller('ModelTextDescribeController', {
            authService : authServiceMock,
            projectsService : projectsServiceMock,
            trainingService : trainingServiceMock,
            fcnnVisualisationService : fcnnVisualisationServiceMock,
            loggerService : loggerServiceMock,
            utilService : utilServiceMock,
            scrollService : scrollServiceMock,
            $stateParams : $stateParamsMock,
            $scope : $scope,
            $timeout : $timeout,
            $interval : $interval
        });
    }

    // a node/example needs one entry per input-layer node for whichever
    // architecture is active when it's used (CUSTOM=7, BAG_OF_WORDS=10,
    // FEATURE_SELECTION=9) - 10 is enough to cover all three
    function nodeValues(count) {
        var values = [];
        for (var i = 0; i < (count || 10); i++) {
            values.push({ value : i });
        }
        return values;
    }

    function exampleFixture(text, label) {
        return {
            text : text,
            label : label,
            output : { cat : 80, dog : 20 },
            random : nodeValues(),
            bagofwords : nodeValues(),
            customfeatures : nodeValues()
        };
    }

    function project() {
        return { id : 'proj1', labels : [ 'cat', 'dog' ] };
    }

    function modelinfo() {
        return {
            examples : [
                exampleFixture('this is example one', 'cat'),
                exampleFixture('this is example two', 'dog')
            ]
        };
    }

    // wires up the full happy-path init chain and returns the vm, ready to
    // drive the wizard
    function readyController() {
        projectsServiceMock.getProject.and.returnValue($q.resolve(project()));
        trainingServiceMock.getModels.and.returnValue($q.resolve([ { status : 'Available', updated : new Date() } ]));
        trainingServiceMock.getModel.and.returnValue($q.resolve(modelinfo()));

        var vm = createController();
        $rootScope.$digest();
        $timeout.flush();
        return vm;
    }


    describe('initial state', function () {

        it('sets loading and reads ids from $stateParams synchronously, before anything resolves', function () {
            utilServiceMock.loadScript.and.returnValue($q.defer().promise);

            createController();

            expect($scope.loading).toBe(true);
            expect($scope.projectId).toBe('proj1');
            expect($scope.userId).toBe('user1');
            expect($scope.modelId).toBe('model1');
        });

        it('loads the d3 script before doing anything else', function () {
            utilServiceMock.loadScript.and.returnValue($q.defer().promise);

            createController();

            expect(utilServiceMock.loadScript).toHaveBeenCalledWith('/static/bower_components/d3/d3.min.js');
            expect(authServiceMock.getProfileDeferred).not.toHaveBeenCalled();
        });

    });


    describe('successful load', function () {

        it('fetches models for the project and then the specific model, and initialises the visualisation', function () {
            var vm = readyController();

            expect(trainingServiceMock.getModels).toHaveBeenCalledWith(project(), 'user1', 'class1');
            expect(trainingServiceMock.getModel).toHaveBeenCalledWith('proj1', 'user1', 'class1', 'model1', jasmine.any(Date));
            expect($scope.loading).toBe(false);
            expect($scope.modelinfo).toEqual(modelinfo());
            expect(fcnnVisualisationServiceMock.init).toHaveBeenCalledWith('mlforkidsmodelvizimg');
            expect(vm.errors).toEqual([]);
            expect(vm.warnings).toEqual([]);
        });

        it('treats a "Training" model the same as "Available" and still describes it', function () {
            projectsServiceMock.getProject.and.returnValue($q.resolve(project()));
            trainingServiceMock.getModels.and.returnValue($q.resolve([ { status : 'Training', updated : new Date() } ]));
            trainingServiceMock.getModel.and.returnValue($q.resolve(modelinfo()));

            var vm = createController();
            $rootScope.$digest();
            $timeout.flush();

            expect(trainingServiceMock.getModel).toHaveBeenCalled();
            expect(vm.errors).toEqual([]);
            expect(vm.warnings).toEqual([]);
        });

    });


    describe('error handling', function () {

        it('shows a friendly warning (not a crash, not a generic error) when there is no model yet (empty models array)', function () {
            // regression test: models[0].status used to be dereferenced even
            // when models was empty, throwing instead of showing this warning
            projectsServiceMock.getProject.and.returnValue($q.resolve(project()));
            trainingServiceMock.getModels.and.returnValue($q.resolve([]));

            var vm = createController();
            $rootScope.$digest();

            expect(trainingServiceMock.getModel).not.toHaveBeenCalled();
            expect(vm.errors).toEqual([]);
            expect(vm.warnings.length).toBe(1);
            expect(vm.warnings[0].message).toBe('Model not ready to be described');
            expect(scrollServiceMock.scrollToNewItem).toHaveBeenCalledWith('warnings1');
            expect($scope.loading).toBe(false);
            expect(fcnnVisualisationServiceMock.init).not.toHaveBeenCalled();
        });

        it('shows the same friendly warning when models is undefined', function () {
            projectsServiceMock.getProject.and.returnValue($q.resolve(project()));
            trainingServiceMock.getModels.and.returnValue($q.resolve(undefined));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.warnings.length).toBe(1);
            expect(vm.warnings[0].message).toBe('Model not ready to be described');
        });

        it('shows the friendly warning (not a crash) when the model status is neither Available nor Training', function () {
            projectsServiceMock.getProject.and.returnValue($q.resolve(project()));
            trainingServiceMock.getModels.and.returnValue($q.resolve([ { status : 'Failed', updated : new Date() } ]));

            var vm = createController();
            $rootScope.$digest();

            expect(trainingServiceMock.getModel).not.toHaveBeenCalled();
            expect(vm.warnings.length).toBe(1);
            expect(vm.warnings[0].message).toBe('Model not ready to be described');
        });

        it('does not run initializeVisualisation after showing the "not ready" warning', function () {
            projectsServiceMock.getProject.and.returnValue($q.resolve(project()));
            trainingServiceMock.getModels.and.returnValue($q.resolve([]));

            createController();
            $rootScope.$digest();
            $timeout.flush(0, true); // flush anything pending without throwing if there's nothing to flush

            expect(fcnnVisualisationServiceMock.init).not.toHaveBeenCalled();
            expect($scope.modelinfo).toBeUndefined();
        });

        it('shows a friendly warning and scrolls to it when the project 404s with no project loaded being irrelevant here (still generic, since this 404 happens before any model check)', function () {
            projectsServiceMock.getProject.and.returnValue($q.reject({ status : 404, data : { message : 'project not found' } }));

            var vm = createController();
            $rootScope.$digest();

            // the project itself failed to load, so $scope.project is unset -
            // this must NOT be confused with the "model not ready" case
            expect(vm.warnings).toEqual([]);
            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toBe('project not found');
            expect(scrollServiceMock.scrollToNewItem).toHaveBeenCalledWith('errors1');
        });

        it('shows the friendly "train a new model" warning when the project loaded but the model fetch itself 404s', function () {
            projectsServiceMock.getProject.and.returnValue($q.resolve(project()));
            trainingServiceMock.getModels.and.returnValue($q.resolve([ { status : 'Available', updated : new Date() } ]));
            trainingServiceMock.getModel.and.returnValue($q.reject({ status : 404 }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors).toEqual([]);
            expect(vm.warnings.length).toBe(1);
            expect(vm.warnings[0].message).toBe('Model information is not available. Try training a new model.');
            expect(scrollServiceMock.scrollToNewItem).toHaveBeenCalledWith('warnings1');
        });

        it('shows a generic error alert for a non-404 failure', function () {
            projectsServiceMock.getProject.and.returnValue($q.resolve(project()));
            trainingServiceMock.getModels.and.returnValue($q.reject({ status : 500, data : { error : 'server exploded' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toBe('server exploded');
            expect(vm.errors[0].status).toBe(500);
            expect(scrollServiceMock.scrollToNewItem).toHaveBeenCalledWith('errors1');
        });

    });


    describe('dismissAlert', function () {

        it('removes only the alert at the given index from the given list', function () {
            var vm = createController();
            vm.errors = [ { message : 'a' }, { message : 'b' }, { message : 'c' } ];

            vm.dismissAlert('errors', 1);

            expect(vm.errors).toEqual([ { message : 'a' }, { message : 'c' } ]);
        });

    });


    describe('wizard navigation boundaries', function () {

        it('starts on page 1', function () {
            var vm = readyController();
            expect(vm.wizardPage).toBe(1);
        });

        it('previousPage does not go below page 1', function () {
            var vm = readyController();

            vm.previousPage();

            expect(vm.wizardPage).toBe(1);
            expect(vm.wizardBusy).toBe(false);
        });

        it('nextPage does not go beyond page 29', function () {
            var vm = readyController();
            vm.wizardPage = 29;

            vm.nextPage();

            expect(vm.wizardPage).toBe(29);
        });

        it('nextPage advances the page and marks the wizard busy until the step completes', function () {
            var vm = readyController();

            vm.nextPage();

            expect(vm.wizardPage).toBe(2);
            // page 2's step (highlightNetworkLayersInSequence) completes synchronously
            expect(vm.wizardBusy).toBe(false);
        });

    });


    // regression test for the previousPage() bug: landing back on page 6 (from
    // page 7) has to redraw the FEATURE_SELECTION diagram and re-display the
    // training example, the same as landing back on pages 4 and 5 already did -
    // otherwise the diagram is left showing the wrong (CUSTOM) architecture and
    // populateInputLayer under-populates it (uses the wrong node count)
    describe('wizard: navigating back to page 6 from page 7', function () {

        function advanceToPage7(vm) {
            vm.nextPage(); // -> 2
            vm.nextPage(); // -> 3
            $timeout.flush(0, true);
            vm.nextPage(); // -> 4
            $interval.flush(200 * 7); // populateInputLayer(random, FAST) over the CUSTOM input layer (7 nodes)
            vm.nextPage(); // -> 5
            $interval.flush(400 * 10); // populateInputLayer(bagofwords, SLOW) over the BAG_OF_WORDS input layer (10 nodes)
            vm.nextPage(); // -> 6
            $interval.flush(400 * 9); // populateInputLayer(customfeatures, SLOW) over the FEATURE_SELECTION input layer (9 nodes)
            vm.nextPage(); // -> 7
            $interval.flush(200 * 7); // populateInputLayer(random, FAST) over the CUSTOM input layer again (7 nodes)
        }

        it('redraws the FEATURE_SELECTION architecture when going back to page 6', function () {
            var vm = readyController();
            advanceToPage7(vm);
            fcnnVisualisationServiceMock.create.calls.reset();

            vm.previousPage();

            expect(vm.wizardPage).toBe(6);
            expect(fcnnVisualisationServiceMock.create).toHaveBeenCalledWith([ 1, 9, 6, 7, 2 ], [ 0, 20, 20, 20, 100 ]);
        });

        it('re-displays the training example text when going back to page 6', function () {
            var vm = readyController();
            advanceToPage7(vm);
            fcnnVisualisationServiceMock.updateInputText.calls.reset();
            fcnnVisualisationServiceMock.highlightInputText.calls.reset();

            vm.previousPage();

            expect(fcnnVisualisationServiceMock.updateInputText).toHaveBeenCalledWith('this is example one');
            expect(fcnnVisualisationServiceMock.highlightInputText).toHaveBeenCalled();
        });

        it('populates all 9 FEATURE_SELECTION input nodes (not just 7) once back on page 6', function () {
            var vm = readyController();
            advanceToPage7(vm);

            vm.previousPage();
            fcnnVisualisationServiceMock.updateLabels.calls.reset();
            $interval.flush(400 * 9);

            expect(fcnnVisualisationServiceMock.updateLabels).toHaveBeenCalledTimes(9);
        });

    });


    describe('pan and zoom controls', function () {

        var vizImg, vizHost;

        beforeEach(function () {
            vizImg = document.createElement('div');
            vizImg.id = 'mlforkidsmodelvizimg';

            vizHost = document.createElement('div');
            vizHost.id = 'mlforkidsmodelvizimghost';
            vizHost.style.width = '50px';
            vizHost.style.height = '50px';
            vizHost.style.overflow = 'scroll';
            var scrollableContent = document.createElement('div');
            scrollableContent.style.width = '500px';
            scrollableContent.style.height = '500px';
            vizHost.appendChild(scrollableContent);

            document.body.appendChild(vizImg);
            document.body.appendChild(vizHost);
        });

        afterEach(function () {
            vizImg.remove();
            vizHost.remove();
        });

        it('grow increases the diagram width by 10% every tick', function () {
            var vm = readyController();

            vm.grow();
            $interval.flush(50);

            expect(vizImg.style.width).toBe('110%');
        });

        it('stop cancels an in-progress grow', function () {
            var vm = readyController();

            vm.grow();
            $interval.flush(50);
            vm.stop();
            $interval.flush(200);

            expect(vizImg.style.width).toBe('110%');
        });

        it('shrink never takes the diagram below 100%', function () {
            var vm = readyController();
            vm.grow();
            $interval.flush(100);
            vm.stop();
            expect(vizImg.style.width).toBe('120%');

            vm.shrink();
            $interval.flush(200);

            expect(vizImg.style.width).toBe('100%');
        });

        it('goleft/goright scroll the host container horizontally', function () {
            var vm = readyController();

            vm.goleft();
            $interval.flush(50);
            expect(vizHost.scrollLeft).toBe(20);

            vm.goright();
            $interval.flush(50);
            expect(vizHost.scrollLeft).toBe(0);
        });

    });


    describe('page cleanup ($destroy)', function () {

        it('stops any running wizard animation', function () {
            var vm = readyController();
            vm.nextPage(); // page 2 starts a repeating highlight animation

            fcnnVisualisationServiceMock.remove_focus.calls.reset();
            $scope.$destroy();

            expect(fcnnVisualisationServiceMock.remove_focus).toHaveBeenCalled();
        });

    });

});
