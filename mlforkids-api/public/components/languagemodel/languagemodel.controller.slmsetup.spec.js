describe('LanguageModelController - small model setup', function () {

    var $controller;
    var $q;
    var $rootScope;
    var $scope;

    var authServiceMock, projectsServiceMock, trainingServiceMock,
        wikipediaServiceMock, weatherServiceMock, languageModelServiceMock, txtServiceMock,
        utilServiceMock, loggerServiceMock, $mdDialogMock, $windowMock, $timeoutReal;
    var $stateParams;

    var profile;
    var reloadSpy;
    var capturedProgressCallback;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_, _$timeout_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
        $timeoutReal = _$timeout_;
        $scope = $rootScope.$new();
    }));

    beforeEach(function () {
        profile = { user_id : 'user1', tenant : 'class1', role : 'student' };

        authServiceMock = {
            getProfileDeferred : jasmine.createSpy('getProfileDeferred').and.returnValue($q.resolve(profile))
        };

        projectsServiceMock = jasmine.createSpyObj('projectsService', [
            'getProject', 'setLanguageModelType',
            'storeSmallLanguageModelConfig', 'storeToyLanguageModelConfig'
        ]);

        trainingServiceMock = jasmine.createSpyObj('trainingService', [
            'getTraining', 'retrieveAsset', 'newTrainingData', 'bulkAddTrainingData',
            'deleteTrainingData', 'storeAsset'
        ]);
        trainingServiceMock.getTraining.and.returnValue($q.resolve([]));

        wikipediaServiceMock = jasmine.createSpyObj('wikipediaService', ['searchByTitle']);
        weatherServiceMock = jasmine.createSpyObj('weatherService', ['getCurrentWeather']);

        languageModelServiceMock = jasmine.createSpyObj('languageModelService', [
            'generateNgrams', 'getSupportedModels', 'getAllModels', 'getModelDetails'
        ]);
        languageModelServiceMock.getSupportedModels.and.returnValue($q.resolve([]));
        languageModelServiceMock.getAllModels.and.returnValue([]);

        txtServiceMock = jasmine.createSpyObj('txtService', ['getContents']);

        reloadSpy = jasmine.createSpy('reload').and.returnValue($q.resolve());
        capturedProgressCallback = undefined;
        var fakeWebllm = {
            MLCEngine : function (cfg) {
                capturedProgressCallback = cfg.initProgressCallback;
                this.reload = reloadSpy;
            }
        };
        utilServiceMock = jasmine.createSpyObj('utilService', ['loadWebLlmProjectSupport']);
        utilServiceMock.loadWebLlmProjectSupport.and.returnValue($q.resolve(fakeWebllm));

        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error']);

        $mdDialogMock = jasmine.createSpyObj('$mdDialog', ['show', 'hide', 'cancel']);

        $windowMock = jasmine.createSpyObj('$window', ['scrollTo']);

        $stateParams = { projectId : 'project1', userId : 'user1' };
    });

    function createController() {
        return $controller('LanguageModelController', {
            authService : authServiceMock,
            projectsService : projectsServiceMock,
            trainingService : trainingServiceMock,
            wikipediaService : wikipediaServiceMock,
            weatherService : weatherServiceMock,
            languageModelService : languageModelServiceMock,
            txtService : txtServiceMock,
            utilService : utilServiceMock,
            loggerService : loggerServiceMock,
            $mdDialog : $mdDialogMock,
            $stateParams : $stateParams,
            $scope : $scope,
            $window : $windowMock,
            $timeout : $timeoutReal,
            $q : $q
        });
    }

    function digestTwice() {
        $rootScope.$digest();
        $rootScope.$digest();
    }

    function baseProject(overrides) {
        return angular.extend({ id : 'project1', userid : 'user1', classid : 'class1', type : 'text' }, overrides || {});
    }

    function createReadyController(project) {
        projectsServiceMock.getProject.and.returnValue($q.resolve(project));
        var vm = createController();
        digestTwice();
        return vm;
    }

    // brings a small-model controller to the ARCHITECTURE phase with a
    // model chosen (but not yet downloaded) - the natural starting point
    // for downloadModel()/changeSmallLanguageModel() tests
    function createSlmArchitectureController(modelId) {
        projectsServiceMock.setLanguageModelType.and.returnValue($q.resolve());
        var vm = createReadyController(baseProject());
        $scope.chooseModelType('small');
        digestTwice();
        $scope.project.slm.id = modelId || 'model1';
        return vm;
    }


    describe('setupSlmSupport (initProgressCallback)', function () {

        it('updates download progress while not reconfiguring', function () {
            createSlmArchitectureController();

            capturedProgressCallback({ progress : 0.5, text : 'halfway' });
            digestTwice();

            expect($scope.project.slm.download).toBe(50);
        });

        it('does not update download progress mid-way through while reconfiguring', function () {
            createSlmArchitectureController();
            $scope.reconfiguring = true;
            $scope.project.slm.download = 100;

            capturedProgressCallback({ progress : 0.5, text : 'halfway' });
            digestTwice();

            expect($scope.project.slm.download).toBe(100);
        });

        it('updates download progress on completion while reconfiguring', function () {
            createSlmArchitectureController();
            $scope.reconfiguring = true;

            capturedProgressCallback({ progress : 1, text : 'done' });
            digestTwice();

            expect($scope.project.slm.download).toBe(100);
        });

    });


    describe('downloadModel', function () {

        it('shows a placeholder download animation immediately when not reconfiguring', function () {
            createSlmArchitectureController();
            reloadSpy.and.returnValue($q.defer().promise); // never resolves - inspect pre-resolution state

            $scope.downloadModel();

            expect($scope.project.slm.download).toBe(101);
            expect($scope.generating).toBe(false);
            expect($scope.generatedmessages).toEqual([]);
        });

        it('does not show the placeholder animation while reconfiguring', function () {
            createSlmArchitectureController();
            $scope.reconfiguring = true;
            $scope.project.slm.download = 100;
            reloadSpy.and.returnValue($q.defer().promise);

            $scope.downloadModel();

            expect($scope.project.slm.download).toBe(100);
        });

        it('reloads with an empty config when no context window size is set', function () {
            createSlmArchitectureController('model1');

            $scope.downloadModel();
            digestTwice();

            expect(reloadSpy).toHaveBeenCalledWith('model1', {});
        });

        it('reloads with the parsed context window size when one is set', function () {
            createSlmArchitectureController('model1');
            $scope.project.slm.contextwindow = '2048';

            $scope.downloadModel();
            digestTwice();

            expect(reloadSpy).toHaveBeenCalledWith('model1', { context_window_size : 2048 });
        });

        it('moves to the context-window phase and resolves true on success', function () {
            createSlmArchitectureController();
            var result;

            $scope.downloadModel().then(function (r) { result = r; });
            digestTwice();

            expect($scope.phase).toBe($scope.PHASES.SMALL.CONTEXTWINDOW);
            expect(result).toBe(true);
        });

        it('does not change the phase on success while reconfiguring', function () {
            createSlmArchitectureController();
            $scope.phase = $scope.PHASES.SMALL.READY;
            $scope.reconfiguring = true;

            $scope.downloadModel();
            digestTwice();

            expect($scope.phase).toBe($scope.PHASES.SMALL.READY);
        });

        describe('failure messages', function () {

            it('shows the WebGPU-not-supported message', function () {
                var vm = createSlmArchitectureController();
                reloadSpy.and.returnValue($q.reject({ message : 'WebGPU is not supported on this device' }));

                var result;
                $scope.downloadModel().then(function (r) { result = r; });
                digestTwice();

                expect(vm.errors[0].status).toBe(400);
                expect(vm.errors[0].message).toContain('WebGPU is not enabled in your browser');
                expect(result).toBe(false);
            });

            it('shows the smallest-model-specific memory message for the smallest model', function () {
                var vm = createSlmArchitectureController('SmolLM2-135M-Instruct-q0f16-MLC');
                reloadSpy.and.returnValue($q.reject({ message : 'insufficient memory or other GPU constraints' }));

                $scope.downloadModel();
                digestTwice();

                expect(vm.errors[0].status).toBe(500);
                expect(vm.errors[0].message).toContain('does not have enough memory to run a small language model');
            });

            it('shows the try-a-smaller-model memory message for other models', function () {
                var vm = createSlmArchitectureController('some-bigger-model');
                reloadSpy.and.returnValue($q.reject({ message : 'insufficient memory or other GPU constraints' }));

                $scope.downloadModel();
                digestTwice();

                expect(vm.errors[0].status).toBe(400);
                expect(vm.errors[0].message).toContain('Try choosing a smaller model');
            });

            it('shows the hardware-requirements message', function () {
                var vm = createSlmArchitectureController();
                reloadSpy.and.returnValue($q.reject({ message : 'Cannot initialize runtime because of requested hardware' }));

                $scope.downloadModel();
                digestTwice();

                expect(vm.errors[0].status).toBe(400);
                expect(vm.errors[0].message).toContain('does not meet the WebGPU requirements');
            });

            it('shows the error message plus a refresh hint for an unrecognised error', function () {
                var vm = createSlmArchitectureController();
                reloadSpy.and.returnValue($q.reject({ message : 'some other webllm failure' }));

                $scope.downloadModel();
                digestTwice();

                expect(vm.errors[0].status).toBe(500);
                expect(vm.errors[0].message).toBe('some other webllm failure It might help to refresh the page.');
            });

            it('falls back to a generic message plus a refresh hint when the error has no message', function () {
                var vm = createSlmArchitectureController();
                reloadSpy.and.returnValue($q.reject({}));

                $scope.downloadModel();
                digestTwice();

                expect(vm.errors[0].message).toBe('Something went wrong. It might help to refresh the page.');
            });

            it('does not reset the download placeholder on failure (button stays disabled - refresh is the only way forward)', function () {
                createSlmArchitectureController();
                reloadSpy.and.returnValue($q.reject({ message : 'WebGPU is not supported' }));

                $scope.downloadModel();
                digestTwice();

                expect($scope.project.slm.download).toBe(101);
            });

        });

    });


    describe('changeSmallLanguageModel', function () {

        it('looks up the newly-chosen model and resets its tools choice to undecided when it supports tools', function () {
            languageModelServiceMock.getSupportedModels.and.returnValue($q.resolve([
                { id : 'model1', label : 'Model 1', toolsupport : true, storagemb : 100, billionparameters : 0.1 }
            ]));
            createSlmArchitectureController('model1');

            $scope.changeSmallLanguageModel();

            expect($scope.project.slm.label).toBe('Model 1');
            expect($scope.project.slm.toolsenabled).toBeNull();
        });

        it('disables tools for a model that does not support them', function () {
            languageModelServiceMock.getSupportedModels.and.returnValue($q.resolve([
                { id : 'model1', label : 'Model 1', toolsupport : false, storagemb : 100, billionparameters : 0.1 }
            ]));
            createSlmArchitectureController('model1');

            $scope.changeSmallLanguageModel();

            expect($scope.project.slm.toolsenabled).toBe(false);
        });

    });


    describe('lookupSmallLanguageModelDetails', function () {

        it('does nothing when no model has been chosen yet', function () {
            createSlmArchitectureController();
            $scope.project.slm.id = undefined;

            expect(function () { $scope.lookupSmallLanguageModelDetails(); }).not.toThrow();
        });

        it('finds the model in slmModels first', function () {
            languageModelServiceMock.getSupportedModels.and.returnValue($q.resolve([
                { id : 'model1', label : 'From slmModels', toolsupport : false, storagemb : 100, billionparameters : 0.1 }
            ]));
            languageModelServiceMock.getAllModels.and.returnValue([
                { id : 'model1', label : 'From getAllModels', toolsupport : false, storagemb : 100, billionparameters : 0.1 }
            ]);
            createSlmArchitectureController('model1');

            $scope.lookupSmallLanguageModelDetails();

            expect($scope.project.slm.label).toBe('From slmModels');
        });

        it('falls back to languageModelService.getAllModels() when not in slmModels', function () {
            languageModelServiceMock.getSupportedModels.and.returnValue($q.resolve([])); // not shader-f16 supported
            languageModelServiceMock.getAllModels.and.returnValue([
                { id : 'model1', label : 'From getAllModels', toolsupport : false, storagemb : 100, billionparameters : 0.1 }
            ]);
            createSlmArchitectureController('model1');

            $scope.lookupSmallLanguageModelDetails();

            expect($scope.project.slm.label).toBe('From getAllModels');
        });

        it('does nothing if the model cannot be found anywhere', function () {
            createSlmArchitectureController('unknown-model');
            $scope.project.slm.label = 'unchanged';

            $scope.lookupSmallLanguageModelDetails();

            expect($scope.project.slm.label).toBe('unchanged');
        });

        it('resets ready/download and returns to the architecture phase', function () {
            languageModelServiceMock.getSupportedModels.and.returnValue($q.resolve([
                { id : 'model1', label : 'Model 1', toolsupport : false, storagemb : 100, billionparameters : 0.1 }
            ]));
            createSlmArchitectureController('model1');
            $scope.project.slm.ready = true;
            $scope.project.slm.download = 100;
            $scope.phase = $scope.PHASES.SMALL.READY;

            $scope.lookupSmallLanguageModelDetails();

            expect($scope.project.slm.ready).toBe(false);
            expect($scope.project.slm.download).toBeUndefined();
            expect($scope.phase).toBe($scope.PHASES.SMALL.ARCHITECTURE);
        });

        it('expands the size/complexity chart scale for an outlier model', function () {
            languageModelServiceMock.getSupportedModels.and.returnValue($q.resolve([
                { id : 'model1', label : 'Huge', toolsupport : false, storagemb : 5000, billionparameters : 10 }
            ]));
            createSlmArchitectureController('model1');

            $scope.lookupSmallLanguageModelDetails();

            expect($scope.sizeChartMax).toBe(5000);
            expect($scope.complexityChartMax).toBe(10);
        });

        it('keeps the default chart scale for a model within the normal range', function () {
            languageModelServiceMock.getSupportedModels.and.returnValue($q.resolve([
                { id : 'model1', label : 'Small', toolsupport : false, storagemb : 200, billionparameters : 0.2 }
            ]));
            createSlmArchitectureController('model1');

            $scope.lookupSmallLanguageModelDetails();

            expect($scope.sizeChartMax).toBe(1500);
            expect($scope.complexityChartMax).toBe(3.0);
        });

    });


    describe('modifySmallModelContextWindow', function () {

        it('sets reconfiguring while downloading, then clears it again on success', function () {
            createSlmArchitectureController();

            $scope.modifySmallModelContextWindow();
            expect($scope.reconfiguring).toBe(true);

            digestTwice();

            expect($scope.reconfiguring).toBe(false);
        });

        it('also clears reconfiguring on failure (downloadModel never rejects)', function () {
            createSlmArchitectureController();
            reloadSpy.and.returnValue($q.reject({ message : 'WebGPU is not supported' }));

            $scope.modifySmallModelContextWindow();
            digestTwice();

            expect($scope.reconfiguring).toBe(false);
        });

        it('ignores a second call while a reload is still in progress', function () {
            createSlmArchitectureController();

            $scope.modifySmallModelContextWindow();
            expect(reloadSpy.calls.count()).toBe(1);

            // reload() has not resolved yet - webllmEngine.reload() cannot
            //  tolerate being called again before that happens
            $scope.modifySmallModelContextWindow();
            expect(reloadSpy.calls.count()).toBe(1);

            digestTwice();

            // once the first reload has finished, a new one is allowed again
            $scope.modifySmallModelContextWindow();
            expect(reloadSpy.calls.count()).toBe(2);
        });

    });


    describe('initSmallModelTemperature', function () {

        it('moves to the temperature phase', function () {
            createSlmArchitectureController();

            $scope.initSmallModelTemperature();

            expect($scope.phase).toBe($scope.PHASES.SMALL.TEMPERATURE);
        });

    });


    describe('dismissAgeWarning', function () {

        it('sets the flag', function () {
            createReadyController(baseProject());

            $scope.dismissAgeWarning();

            expect($scope.ageWarningDisplayed).toBe(true);
        });

    });


    describe('RAG initial context', function () {

        function readyForContext() {
            var vm = createSlmArchitectureController();
            $scope.phase = $scope.PHASES.SMALL.RAGCONTEXT;
            projectsServiceMock.storeSmallLanguageModelConfig.and.returnValue($q.resolve(
                angular.extend({}, $scope.project, { slm : angular.extend({}, $scope.project.slm) })
            ));
            return vm;
        }

        describe('initSmallModelContext', function () {
            it('moves to the RAG-context phase', function () {
                createSlmArchitectureController();
                $scope.initSmallModelContext();
                expect($scope.phase).toBe($scope.PHASES.SMALL.RAGCONTEXT);
            });
        });

        describe('smallModelInitialContextClear', function () {

            it('resets the conversation and marks context as none', function () {
                readyForContext();
                $scope.generatedmessages = [ { role : 'user', content : 'hi' } ];

                $scope.smallModelInitialContextClear();

                expect($scope.generatedmessages).toEqual([]);
                expect($scope.project.slm.initialcontext.state).toBe('none');
            });

            it('does not save while still in the setup wizard (not yet READY)', function () {
                readyForContext();

                $scope.smallModelInitialContextClear();

                expect(projectsServiceMock.storeSmallLanguageModelConfig).not.toHaveBeenCalled();
            });

            it('saves when reviewing from the ready phase', function () {
                readyForContext();
                $scope.phase = $scope.PHASES.SMALL.READY;

                $scope.smallModelInitialContextClear();

                expect(projectsServiceMock.storeSmallLanguageModelConfig).toHaveBeenCalled();
            });

        });

        describe('smallModelInitialContextSet', function () {

            it('marks context as provide', function () {
                readyForContext();

                $scope.smallModelInitialContextSet();

                expect($scope.project.slm.initialcontext.state).toBe('provide');
            });

        });

        describe('removeContextDoc', function () {

            it('removes the doc and resets the conversation (regression: was previously missing the reset)', function () {
                readyForContext();
                $scope.project.slm.initialcontext = { state : 'provide', doc : { type : 'text', title : 't', contents : 'c' } };
                $scope.generatedmessages = [ { role : 'user', content : 'hi' } ];

                $scope.removeContextDoc();

                expect($scope.project.slm.initialcontext.doc).toBeUndefined();
                expect($scope.generatedmessages).toEqual([]);
            });

            it('does nothing if there is no initial context object yet', function () {
                readyForContext();
                $scope.project.slm.initialcontext = undefined;

                expect(function () { $scope.removeContextDoc(); }).not.toThrow();
            });

        });

        describe('addContextText', function () {

            it('shows a dialog pre-filled with any existing text doc contents', function () {
                readyForContext();
                $scope.project.slm.initialcontext = { doc : { type : 'text', contents : 'existing text' } };
                $mdDialogMock.show.and.returnValue($q.reject());

                $scope.addContextText({});

                var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
                expect(dialogOptions.locals.contents).toBe('existing text');
                expect(dialogOptions.templateUrl).toBe('static/components/languagemodel/corpustext.tmpl.html');
            });

            it('shows an empty dialog when there is no existing context', function () {
                readyForContext();
                $mdDialogMock.show.and.returnValue($q.reject());

                $scope.addContextText({});

                var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
                expect(dialogOptions.locals.contents).toBe('');
            });

            it('saves the entered text as the initial context and resets the conversation', function () {
                readyForContext();
                $mdDialogMock.show.and.returnValue($q.resolve({ title : 'ignored', contents : 'new context text' }));
                $scope.generatedmessages = [ { role : 'user', content : 'hi' } ];

                $scope.addContextText({});
                digestTwice();

                expect($scope.project.slm.initialcontext).toEqual(jasmine.objectContaining({
                    state : 'provide',
                    doc : { type : 'text', title : 'text', contents : 'new context text' }
                }));
                expect($scope.generatedmessages).toEqual([]);
                expect(projectsServiceMock.storeSmallLanguageModelConfig).toHaveBeenCalled();
            });

            it('does nothing when the dialog is cancelled', function () {
                readyForContext();
                $mdDialogMock.show.and.returnValue($q.reject());

                $scope.addContextText({});
                digestTwice();

                expect(projectsServiceMock.storeSmallLanguageModelConfig).not.toHaveBeenCalled();
            });

        });

        describe('addContextFile', function () {

            it('reads the file and saves it as the initial context', function () {
                readyForContext();
                var file = { type : 'text', title : 'notes.txt', contents : 'file contents' };
                txtServiceMock.getContents.and.returnValue($q.resolve([ file ]));

                $scope.addContextFile({ currentTarget : { files : [ {} ] } });
                digestTwice();

                expect($scope.project.slm.initialcontext).toEqual(jasmine.objectContaining({ state : 'provide', doc : file }));
                expect(projectsServiceMock.storeSmallLanguageModelConfig).toHaveBeenCalled();
            });

            it('does nothing when there are no files on the event', function () {
                readyForContext();

                var result = $scope.addContextFile({ currentTarget : {} });

                expect(result).toBeUndefined();
                expect(txtServiceMock.getContents).not.toHaveBeenCalled();
            });

            it('shows an error alert if reading the file fails', function () {
                var vm = readyForContext();
                txtServiceMock.getContents.and.returnValue($q.reject(new Error('bad file')));

                $scope.addContextFile({ currentTarget : { files : [ {} ] } });
                digestTwice();

                expect(vm.errors.length).toBe(1);
                expect(vm.errors[0].message).toBe('There was a problem reading your file');
            });

        });

        describe('addContextWikipediaPage', function () {

            it('shows a dialog pre-filled with the existing wikipedia doc when present', function () {
                readyForContext();
                $scope.project.slm.initialcontext = { doc : { type : 'wikipedia', title : 'Cats', contents : 'Cats are cute' } };
                $mdDialogMock.show.and.returnValue($q.reject());

                $scope.addContextWikipediaPage({});

                var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
                expect(dialogOptions.locals.title).toBe('Cats');
                expect(dialogOptions.locals.contents).toBe('Cats are cute');
            });

            it('does not pre-fill from a non-wikipedia doc', function () {
                readyForContext();
                $scope.project.slm.initialcontext = { doc : { type : 'text', title : 'Notes', contents : 'some notes' } };
                $mdDialogMock.show.and.returnValue($q.reject());

                $scope.addContextWikipediaPage({});

                var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
                expect(dialogOptions.locals.title).toBe('');
                expect(dialogOptions.locals.contents).toBe('');
            });

            it('saves the retrieved page as the initial context', function () {
                readyForContext();
                $mdDialogMock.show.and.returnValue($q.resolve({ title : 'Kittens', contents : 'Kittens are cats' }));

                $scope.addContextWikipediaPage({});
                digestTwice();

                expect($scope.project.slm.initialcontext).toEqual(jasmine.objectContaining({
                    state : 'provide',
                    doc : { type : 'wikipedia', title : 'Kittens', contents : 'Kittens are cats' }
                }));
                expect(projectsServiceMock.storeSmallLanguageModelConfig).toHaveBeenCalled();
            });

            it('the inner dialog controller looks up a page by title', function () {
                readyForContext();
                $mdDialogMock.show.and.returnValue($q.reject());
                $scope.addContextWikipediaPage({});
                var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
                var innerScope = {};
                dialogOptions.controller(innerScope, dialogOptions.locals);

                wikipediaServiceMock.searchByTitle.and.returnValue($q.resolve('Kittens are small cats'));
                innerScope.search('Kittens');
                $rootScope.$digest();

                expect(innerScope.contents).toBe('Kittens are small cats');
            });

        });

    });


    describe('tools setup', function () {

        function readyForTools() {
            var vm = createSlmArchitectureController();
            projectsServiceMock.storeSmallLanguageModelConfig.and.returnValue($q.resolve(
                angular.extend({}, $scope.project, { slm : angular.extend({}, $scope.project.slm) })
            ));
            return vm;
        }

        describe('initSmallModelTools', function () {

            it('moves to the tools phase when the model supports tools', function () {
                readyForTools();
                $scope.project.slm.toolsupport = true;

                $scope.initSmallModelTools();

                expect($scope.phase).toBe($scope.PHASES.SMALL.TOOLS);
            });

            it('skips straight to ready when the model does not support tools', function () {
                readyForTools();
                $scope.project.slm.toolsupport = false;

                $scope.initSmallModelTools();
                digestTwice();

                expect($scope.phase).toBe($scope.PHASES.SMALL.READY);
            });

        });

        describe('setSmallModelToolsEnabled', function () {

            it('sets the flag', function () {
                readyForTools();

                $scope.setSmallModelToolsEnabled(true);

                expect($scope.project.slm.toolsenabled).toBe(true);
            });

            it('saves when already in the ready phase', function () {
                readyForTools();
                $scope.phase = $scope.PHASES.SMALL.READY;

                $scope.setSmallModelToolsEnabled(true);

                expect(projectsServiceMock.storeSmallLanguageModelConfig).toHaveBeenCalled();
            });

            it('does not save while still in the setup wizard', function () {
                readyForTools();

                $scope.setSmallModelToolsEnabled(true);

                expect(projectsServiceMock.storeSmallLanguageModelConfig).not.toHaveBeenCalled();
            });

        });

        describe('canRunTool', function () {

            it('is true for a tool with no required parameters', function () {
                readyForTools();
                var tool = { parameters : [], required : [] };

                expect($scope.canRunTool(tool)).toBe(true);
            });

            it('is false when a required parameter has no test value', function () {
                readyForTools();
                var tool = {
                    parameters : [ { name : 'number1' }, { name : 'number2' } ],
                    required : [ 'number1', 'number2' ]
                };
                tool.parameters[0].testvalue = 5;

                expect($scope.canRunTool(tool)).toBe(false);
            });

            it('is true when all required parameters have test values', function () {
                readyForTools();
                var tool = {
                    parameters : [ { name : 'number1' }, { name : 'number2' } ],
                    required : [ 'number1', 'number2' ]
                };
                tool.parameters[0].testvalue = 5;
                tool.parameters[1].testvalue = 10;

                expect($scope.canRunTool(tool)).toBe(true);
            });

            it('ignores optional parameters with no test value', function () {
                readyForTools();
                var tool = {
                    parameters : [ { name : 'optional' } ],
                    required : []
                };

                expect($scope.canRunTool(tool)).toBe(true);
            });

        });

        describe('tryTool', function () {

            it('runs the tool with only the parameters that have test values, and records the output', function () {
                readyForTools();
                var tool = {
                    title : 'multiply_two_numbers',
                    parameters : [ { name : 'number1' }, { name : 'number2' } ],
                    required : [ 'number1', 'number2' ],
                    implementation : jasmine.createSpy('implementation').and.returnValue('42')
                };
                tool.parameters[0].testvalue = 6;
                tool.parameters[1].testvalue = 7;

                $scope.tryTool(tool);
                digestTwice();

                expect(tool.implementation).toHaveBeenCalledWith({ number1 : 6, number2 : 7 });
                expect(tool.testoutput).toBe('42');
            });

            it('omits parameters with an empty-string test value', function () {
                readyForTools();
                var tool = {
                    title : 't',
                    parameters : [ { name : 'a' } ],
                    required : [],
                    implementation : jasmine.createSpy('implementation').and.returnValue('done')
                };
                tool.parameters[0].testvalue = '';

                $scope.tryTool(tool);
                digestTwice();

                expect(tool.implementation).toHaveBeenCalledWith({});
            });

            it('supports a tool implementation that returns a promise (e.g. get_weather)', function () {
                readyForTools();
                weatherServiceMock.getCurrentWeather.and.returnValue($q.resolve({
                    description : 'Sunny', temperature : 20, windspeed : 5
                }));
                var tool = {
                    title : 'get_weather',
                    parameters : [ { name : 'latitude' }, { name : 'longitude' } ],
                    required : [ 'latitude', 'longitude' ],
                    implementation : function (args) {
                        return weatherServiceMock.getCurrentWeather(args.latitude, args.longitude)
                            .then(function (weather) {
                                return weather.description + ', temperature is ' + weather.temperature + '°C ' +
                                       'wind speed is ' + weather.windspeed + ' km/h';
                            });
                    }
                };
                tool.parameters[0].testvalue = 51.5;
                tool.parameters[1].testvalue = -0.1;

                $scope.tryTool(tool);
                digestTwice();

                expect(tool.testoutput).toBe('Sunny, temperature is 20°C wind speed is 5 km/h');
            });

            it('records an error output if the tool implementation throws', function () {
                readyForTools();
                var tool = {
                    title : 'broken_tool',
                    parameters : [],
                    required : [],
                    implementation : function () { throw new Error('tool exploded'); }
                };

                $scope.tryTool(tool);
                digestTwice();

                expect(tool.testoutput).toBe('Error: tool exploded');
            });

            it('shows a placeholder while the tool is running', function () {
                readyForTools();
                var deferred = $q.defer();
                var tool = {
                    title : 'slow_tool', parameters : [], required : [],
                    implementation : function () { return deferred.promise; }
                };

                $scope.tryTool(tool);

                expect(tool.testoutput).toBe('...');
            });

        });

    });


    describe('setProjectReady (small model)', function () {

        it('saves the config and moves to the ready phase', function () {
            var vm = createSlmArchitectureController();
            $scope.project.slm.contextwindow = '2048';
            $scope.project.slm.temperature = 0.8;
            $scope.project.slm.topp = 0.9;
            $scope.project.slm.toolsenabled = false;
            var originalProject = $scope.project;
            var updatedProject = angular.extend({}, $scope.project, { slm : angular.extend({}, $scope.project.slm) });
            projectsServiceMock.storeSmallLanguageModelConfig.and.returnValue($q.resolve(updatedProject));

            $scope.setProjectReady();
            digestTwice();

            // setProjectReady() reassigns $scope.project to the saved result,
            // so the call assertion must use the pre-reassignment reference
            expect(projectsServiceMock.storeSmallLanguageModelConfig).toHaveBeenCalledWith(originalProject, jasmine.objectContaining({
                id : 'model1', contextwindow : '2048', temperature : 0.8, topp : 0.9, toolsenabled : false
            }));
            expect($scope.phase).toBe($scope.PHASES.SMALL.READY);
            expect($scope.project.slm.ready).toBe(true);
            expect(vm.errors.length).toBe(0);
        });

        it('carries over the download progress and toolsupport flags onto the saved project', function () {
            createSlmArchitectureController();
            $scope.project.slm.download = 100;
            $scope.project.slm.toolsupport = true;
            var updatedProject = angular.extend({}, $scope.project, { slm : angular.extend({}, $scope.project.slm) });
            delete updatedProject.slm.download;
            delete updatedProject.slm.toolsupport;
            projectsServiceMock.storeSmallLanguageModelConfig.and.returnValue($q.resolve(updatedProject));

            $scope.setProjectReady();
            digestTwice();

            expect($scope.project.slm.download).toBe(100);
            expect($scope.project.slm.toolsupport).toBe(true);
        });

        it('shows an error alert if saving fails', function () {
            var vm = createSlmArchitectureController();
            projectsServiceMock.storeSmallLanguageModelConfig.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            $scope.setProjectReady();
            digestTwice();

            expect(vm.errors.length).toBe(1);
        });

    });

});
