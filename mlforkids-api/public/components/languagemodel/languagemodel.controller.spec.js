describe('LanguageModelController', function () {

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
        var fakeWebllm = {
            MLCEngine : function (cfg) {
                this.cfg = cfg;
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

    // several controller code paths use $scope.$applyAsync, which (per the
    // existing convention in training.images.controller.spec.js) needs a
    // second digest to flush
    function digestTwice() {
        $rootScope.$digest();
        $rootScope.$digest();
    }

    function createReadyController(project) {
        projectsServiceMock.getProject.and.returnValue($q.resolve(project));
        var vm = createController();
        digestTwice();
        return vm;
    }

    function baseProject(overrides) {
        return angular.extend({ id : 'project1', userid : 'user1', classid : 'class1', type : 'text' }, overrides || {});
    }


    // ===================================================================
    // INITIALISATION
    // ===================================================================
    describe('initialisation', function () {

        it('sets projectId/userId from $stateParams and starts loading, before the profile resolves', function () {
            createController();

            expect($scope.projectId).toBe('project1');
            expect($scope.userId).toBe('user1');
            expect($scope.loading).toBe(true);
            expect($scope.phase).toBe($scope.PHASES.INITIAL);
        });

        it('loads the profile and project, and stops loading when the project has no recognised model type', function () {
            var project = baseProject();
            var vm = createReadyController(project);

            expect(vm.profile).toEqual(profile);
            expect(projectsServiceMock.getProject).toHaveBeenCalledWith('project1', 'user1', 'class1');
            expect($scope.project).toBe(project);
            expect($scope.loading).toBe(false);
            expect($scope.phase).toBe($scope.PHASES.INITIAL);
        });

        it('dispatches to the toy-model restore path when project.modeltype is "toy"', function () {
            createReadyController(baseProject({ modeltype : 'toy' }));

            expect(trainingServiceMock.getTraining).toHaveBeenCalledWith('project1', 'user1', 'class1');
        });

        it('dispatches to the small-model restore path when project.modeltype is "small"', function () {
            createReadyController(baseProject({ modeltype : 'small' }));

            expect(languageModelServiceMock.getSupportedModels).toHaveBeenCalled();
            expect(utilServiceMock.loadWebLlmProjectSupport).toHaveBeenCalled();
        });

        it('records an error alert if fetching the profile fails', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.reject({ status : 401, data : { error : 'not authorised' } }));

            var vm = createController();
            digestTwice();

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].status).toBe(401);
            expect(vm.errors[0].message).toBe('not authorised');
        });

        it('records an error alert with the error itself when there is no err.data', function () {
            projectsServiceMock.getProject.and.returnValue($q.reject({ status : 500 }));

            var vm = createController();
            digestTwice();

            expect(vm.errors[0].status).toBe(500);
            expect(vm.errors[0].message).toBe('Unknown error');
        });

        it('shows a fixed too-large message for a 413 error, regardless of the error data', function () {
            projectsServiceMock.getProject.and.returnValue($q.reject({ status : 413, data : { error : 'this is ignored' } }));

            var vm = createController();
            digestTwice();

            expect(vm.errors[0].status).toBe(413);
            expect(vm.errors[0].message).toBe(
                'Sorry! Your corpus is too large for a toy language model project. ' +
                'Please remove some text from your corpus and try again.'
            );
        });

        it('scrolls to the top of the page when an alert is shown', function () {
            projectsServiceMock.getProject.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            createController();
            digestTwice();

            expect($windowMock.scrollTo).toHaveBeenCalledWith(0, 0);
        });

        it('reports 500 errors to Sentry when it is configured', function () {
            var originalSentry = window.Sentry;
            window.Sentry = jasmine.createSpyObj('Sentry', ['captureException']);

            projectsServiceMock.getProject.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));
            createController();
            digestTwice();

            expect(window.Sentry.captureException).toHaveBeenCalledWith(
                jasmine.objectContaining({ error : { error : 'server error' } })
            );

            window.Sentry = originalSentry;
        });

        it('does not report to Sentry for non-500 errors', function () {
            var originalSentry = window.Sentry;
            window.Sentry = jasmine.createSpyObj('Sentry', ['captureException']);

            projectsServiceMock.getProject.and.returnValue($q.reject({ status : 404, data : { error : 'not found' } }));
            createController();
            digestTwice();

            expect(window.Sentry.captureException).not.toHaveBeenCalled();

            window.Sentry = originalSentry;
        });

    });


    describe('dismissAlert', function () {

        it('removes the alert at the given index', function () {
            var vm = createReadyController(baseProject());
            vm.errors = [ { alertid : 1 }, { alertid : 2 } ];

            vm.dismissAlert('errors', 0);

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].alertid).toBe(2);
        });

    });


    describe('review', function () {

        it('sets the phase directly', function () {
            createReadyController(baseProject());

            $scope.review($scope.PHASES.TOY.TEMPERATURE);

            expect($scope.phase).toBe($scope.PHASES.TOY.TEMPERATURE);
        });

    });


    // ===================================================================
    // TOY MODEL RESTORE
    // ===================================================================
    describe('restoreSavedToyLanguageModel', function () {

        it('initialises default toy config and moves to the corpus phase for a brand new project', function () {
            createReadyController(baseProject({ modeltype : 'toy' }));

            expect($scope.corpus).toEqual([]);
            expect($scope.project.toy).toEqual({ ngrams : 0, temperature : 1.0, topp : 1.0 });
            expect($scope.phase).toBe($scope.PHASES.TOY.CORPUS);
            expect(trainingServiceMock.retrieveAsset).not.toHaveBeenCalled();
        });

        it('restores the corpus document list', function () {
            var docs = [
                { id : 'd1', title : 'Doc 1', type : 'text' },
                { id : 'd2', title : 'Doc 2', type : 'wikipedia' }
            ];
            trainingServiceMock.getTraining.and.returnValue($q.resolve(docs));
            trainingServiceMock.retrieveAsset.and.returnValue($q.reject({ status : 404 }));

            createReadyController(baseProject({ modeltype : 'toy' }));

            expect($scope.corpus).toEqual([
                { id : 'd1', title : 'Doc 1', type : 'text' },
                { id : 'd2', title : 'Doc 2', type : 'wikipedia' }
            ]);
            expect(trainingServiceMock.retrieveAsset).toHaveBeenCalledWith(jasmine.objectContaining({ id : 'project1' }));
        });

        it('does not surface an error when there is no saved analysis yet (retrieveAsset rejects)', function () {
            trainingServiceMock.getTraining.and.returnValue($q.resolve([ { id : 'd1', title : 'Doc 1', type : 'text' } ]));
            trainingServiceMock.retrieveAsset.and.returnValue($q.reject({ status : 404 }));

            var vm = createReadyController(baseProject({ modeltype : 'toy' }));

            expect(vm.errors.length).toBe(0);
            expect($scope.phase).toBe($scope.PHASES.TOY.CORPUS);
        });

        it('leaves the phase at CORPUS when there is a saved analysis, but no ngram size chosen yet', function () {
            trainingServiceMock.getTraining.and.returnValue($q.resolve([ { id : 'd1', title : 'Doc 1', type : 'text' } ]));
            trainingServiceMock.retrieveAsset.and.returnValue($q.resolve({
                '1' : { count : 5, summary : [] }
            }));

            var vm = createReadyController(baseProject({ modeltype : 'toy' }));

            expect($scope.phase).toBe($scope.PHASES.TOY.CORPUS);
            expect($scope.project.toy.tokens).toBeUndefined();
            expect($scope.project.toy.ready).toBeUndefined();
            expect(vm.warnings.length).toBe(0);
        });

        it('leaves the phase at CORPUS when the saved analysis is empty', function () {
            trainingServiceMock.getTraining.and.returnValue($q.resolve([ { id : 'd1', title : 'Doc 1', type : 'text' } ]));
            trainingServiceMock.retrieveAsset.and.returnValue($q.resolve({}));

            createReadyController(baseProject({ modeltype : 'toy', toy : { ngrams : 1, temperature : 1, topp : 1 } }));

            expect($scope.phase).toBe($scope.PHASES.TOY.CORPUS);
        });

        it('restores previously-analyzed tokens and jumps straight to the ready phase', function () {
            var candidateA = { token : 'world', count : 3, cumprob : 0.6, next : [] };
            var candidateB = { token : 'there', count : 2, cumprob : 1.0, next : [] };
            var rootToken = { token : 'hello', count : 5, next : [ candidateA, candidateB ] };
            var savedCorpus = {
                '1' : { count : 5, summary : [ rootToken ] },
                '2' : { count : 0, summary : [] },
                '3' : { count : 0, summary : [] }
            };

            trainingServiceMock.getTraining.and.returnValue($q.resolve([ { id : 'd1', title : 'Doc 1', type : 'text' } ]));
            trainingServiceMock.retrieveAsset.and.returnValue($q.resolve(savedCorpus));

            createReadyController(baseProject({ modeltype : 'toy', toy : { ngrams : 1, temperature : 1, topp : 1 } }));

            expect($scope.phase).toBe($scope.PHASES.TOY.READY);
            expect($scope.project.toy.ready).toBe(true);
            expect($scope.project.toy.tokens).toBe(savedCorpus['1'].summary);
            expect(rootToken.selected).toBe(true);
            // recomputeProbabilities should have run against the restored tokens
            expect(candidateA.viz).toBe(60);
            expect(candidateB.viz).toBe(40);
        });

    });


    // ===================================================================
    // SMALL MODEL RESTORE
    // ===================================================================
    describe('restoreSavedSmallLanguageModel', function () {

        it('initialises default slm config, the model catalogue, and the webllm engine for a brand new project', function () {
            var supportedModels = [
                { id : 'm1', label : 'Model1', storagemb : 100, billionparameters : 0.1 },
                { id : 'm2', label : 'Model2', storagemb : 200, billionparameters : 0.2 }
            ];
            languageModelServiceMock.getSupportedModels.and.returnValue($q.resolve(supportedModels));

            createReadyController(baseProject({ modeltype : 'small' }));

            expect($scope.slmModels).toEqual(supportedModels);
            expect($scope.sizeChartData).toEqual([
                { id : 'm1', label : 'Model1', value : 100 },
                { id : 'm2', label : 'Model2', value : 200 }
            ]);
            expect($scope.complexityChartData).toEqual([
                { id : 'm1', label : 'Model1', value : 0.1 },
                { id : 'm2', label : 'Model2', value : 0.2 }
            ]);
            expect($scope.webllmEngine).toBeDefined();
            expect($scope.project.slm).toEqual({ temperature : 1.0, topp : 1.0, toolsenabled : null });
            expect($scope.phase).toBe($scope.PHASES.SMALL.ARCHITECTURE);
            expect(reloadSpy).not.toHaveBeenCalled();
        });

        it('restores and downloads a previously-chosen model, keeping the saved tools choice', function () {
            var savedModel = {
                id : 'm1', version : '1', size : '1B', label : 'Model1', developer : 'Dev',
                storage : '100 MB', storagemb : 100, billionparameters : 0.1, toolsupport : true
            };
            languageModelServiceMock.getSupportedModels.and.returnValue($q.resolve([ savedModel ]));

            createReadyController(baseProject({
                modeltype : 'small',
                slm : { id : 'm1', temperature : 0.8, topp : 0.9, toolsenabled : true }
            }));

            expect(reloadSpy).toHaveBeenCalledWith('m1', {});
            expect($scope.project.slm.toolsenabled).toBe(true);
            expect($scope.project.slm.toolsupport).toBe(true);
            expect($scope.project.slm.label).toBe('Model1');
            expect($scope.project.slm.ready).toBe(true);
            expect($scope.phase).toBe($scope.PHASES.SMALL.READY);
        });

        it('defaults toolsenabled to false when restoring a model with no tools choice saved', function () {
            var savedModel = { id : 'm1', toolsupport : false, storagemb : 100, billionparameters : 0.1 };
            languageModelServiceMock.getSupportedModels.and.returnValue($q.resolve([ savedModel ]));

            createReadyController(baseProject({
                modeltype : 'small',
                slm : { id : 'm1', temperature : 1, topp : 1 }
            }));

            expect($scope.project.slm.toolsenabled).toBe(false);
        });

        it('passes the saved context window size through to the engine reload', function () {
            var savedModel = { id : 'm1', toolsupport : false, storagemb : 100, billionparameters : 0.1 };
            languageModelServiceMock.getSupportedModels.and.returnValue($q.resolve([ savedModel ]));

            createReadyController(baseProject({
                modeltype : 'small',
                slm : { id : 'm1', temperature : 1, topp : 1, contextwindow : '2048' }
            }));

            expect(reloadSpy).toHaveBeenCalledWith('m1', { context_window_size : 2048 });
        });

    });


    // ===================================================================
    // CHOOSE MODEL TYPE
    // ===================================================================
    describe('chooseModelType', function () {

        it('does nothing while the page is loading', function () {
            createReadyController(baseProject());
            $scope.loading = true;

            $scope.chooseModelType('toy');

            expect(projectsServiceMock.setLanguageModelType).not.toHaveBeenCalled();
        });

        it('does nothing if the project already has a model type', function () {
            createReadyController(baseProject({ modeltype : 'toy' }));

            $scope.chooseModelType('small');

            expect(projectsServiceMock.setLanguageModelType).not.toHaveBeenCalled();
        });

        it('sets up a toy model project', function () {
            projectsServiceMock.setLanguageModelType.and.returnValue($q.resolve());
            createReadyController(baseProject());

            $scope.chooseModelType('toy');
            digestTwice();

            expect(projectsServiceMock.setLanguageModelType).toHaveBeenCalledWith($scope.project, 'toy');
            expect($scope.project.toy).toEqual({ ngrams : 0, temperature : 1.0, topp : 1.0 });
            expect($scope.project.modeltype).toBe('toy');
            expect($scope.phase).toBe($scope.PHASES.TOY.CORPUS);
            expect($scope.loading).toBe(false);
        });

        it('sets up a small model project, including loading the model catalogue and engine', function () {
            projectsServiceMock.setLanguageModelType.and.returnValue($q.resolve());
            createReadyController(baseProject());

            $scope.chooseModelType('small');
            digestTwice();

            expect(languageModelServiceMock.getSupportedModels).toHaveBeenCalled();
            expect($scope.webllmEngine).toBeDefined();
            expect($scope.project.slm).toEqual({ temperature : 1.0, topp : 1.0, toolsenabled : null });
            expect($scope.project.modeltype).toBe('small');
            expect($scope.phase).toBe($scope.PHASES.SMALL.ARCHITECTURE);
            expect($scope.loading).toBe(false);
        });

        it('shows an error for an unrecognised model type', function () {
            projectsServiceMock.setLanguageModelType.and.returnValue($q.resolve());
            var vm = createReadyController(baseProject());

            $scope.chooseModelType('bogus');
            digestTwice();

            expect(vm.errors.length).toBe(1);
            expect($scope.loading).toBe(false);
            expect($scope.project.modeltype).toBeUndefined();
        });

        it('shows an error if saving the chosen model type fails', function () {
            var vm = createReadyController(baseProject());
            projectsServiceMock.setLanguageModelType.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            $scope.chooseModelType('toy');
            digestTwice();

            expect(vm.errors.length).toBe(1);
            expect($scope.loading).toBe(false);
        });

    });


    // ===================================================================
    // TOY MODEL - CORPUS MANAGEMENT
    // ===================================================================
    describe('corpus management', function () {

        function readyToyController() {
            return createReadyController(baseProject({ modeltype : 'toy' }));
        }

        // brings a toy controller to a state where analyzedCorpus is set,
        // so modifyCorpus's re-parse guard is exercised
        function toyControllerWithAnalyzedCorpus() {
            var rootToken = { token : 'hello', count : 5, next : [] };
            trainingServiceMock.getTraining.and.returnValue($q.resolve([ { id : 'd1', title : 'Doc 1', type : 'text' } ]));
            trainingServiceMock.retrieveAsset.and.returnValue($q.resolve({
                '1' : { count : 5, summary : [ rootToken ] },
                '2' : { count : 0, summary : [] },
                '3' : { count : 0, summary : [] }
            }));
            return createReadyController(baseProject({ modeltype : 'toy', toy : { ngrams : 1, temperature : 1, topp : 1 } }));
        }


        describe('addCorpusText', function () {

            it('shows the add-text dialog', function () {
                readyToyController();
                $mdDialogMock.show.and.returnValue($q.reject());

                $scope.addCorpusText({});

                var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
                expect(dialogOptions.templateUrl).toBe('static/components/languagemodel/corpustext.tmpl.html');
                expect(dialogOptions.locals.dlgtitle).toBe('LANGUAGEMODEL.CORPUS.ADDTEXT');
                expect(dialogOptions.locals.placeholder).toBe('Corpus text');
            });

            it('stores the entered text and adds it to the corpus on confirm', function () {
                readyToyController();
                $mdDialogMock.show.and.returnValue($q.resolve({ title : 'My text', contents : 'hello world' }));
                trainingServiceMock.newTrainingData.and.returnValue($q.resolve({ id : 'd1', title : 'My text', type : 'text' }));

                $scope.addCorpusText({});
                digestTwice();

                expect(trainingServiceMock.newTrainingData).toHaveBeenCalledWith(
                    'project1', 'user1', 'class1', 'text', 'local',
                    { type : 'text', title : 'My text', contents : 'hello world' }
                );
                expect($scope.corpus).toEqual([ { id : 'd1', title : 'My text', type : 'text' } ]);
            });

            it('does nothing when the dialog is cancelled', function () {
                readyToyController();
                $mdDialogMock.show.and.returnValue($q.reject());

                $scope.addCorpusText({});
                digestTwice();

                expect(trainingServiceMock.newTrainingData).not.toHaveBeenCalled();
            });

            it('shows an error alert if storing the text fails', function () {
                var vm = readyToyController();
                $mdDialogMock.show.and.returnValue($q.resolve({ title : 'My text', contents : 'hello world' }));
                trainingServiceMock.newTrainingData.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

                $scope.addCorpusText({});
                digestTwice();

                expect(vm.errors.length).toBe(1);
                expect($scope.corpus).toEqual([]);
            });

            it('the inner dialog controller forwards hide/cancel/confirm to $mdDialog', function () {
                readyToyController();
                $mdDialogMock.show.and.returnValue($q.reject());
                $scope.addCorpusText({});
                var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];

                var innerScope = {};
                dialogOptions.controller(innerScope, dialogOptions.locals);

                expect(innerScope.dlgtitle).toBe('LANGUAGEMODEL.CORPUS.ADDTEXT');
                expect(innerScope.placeholder).toBe('Corpus text');

                innerScope.hide();
                expect($mdDialogMock.hide).toHaveBeenCalledWith();

                innerScope.cancel();
                expect($mdDialogMock.cancel).toHaveBeenCalled();

                var resp = { title : 't', contents : 'c' };
                innerScope.confirm(resp);
                expect($mdDialogMock.hide).toHaveBeenCalledWith(resp);
            });

        });


        describe('addWikipediaPage', function () {

            it('shows the add-wikipedia dialog', function () {
                readyToyController();
                $mdDialogMock.show.and.returnValue($q.reject());

                $scope.addWikipediaPage({});

                var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
                expect(dialogOptions.templateUrl).toBe('static/components/languagemodel/wikipedia.tmpl.html');
                expect(dialogOptions.locals.dlgtitle).toBe('LANGUAGEMODEL.CORPUS.ADDWIKIPEDIA');
            });

            it('adds the retrieved page to the corpus on confirm', function () {
                readyToyController();
                $mdDialogMock.show.and.returnValue($q.resolve({ title : 'Kittens', contents : 'Kittens are cats' }));
                trainingServiceMock.newTrainingData.and.returnValue($q.resolve({ id : 'd1', title : 'Kittens', type : 'wikipedia' }));

                $scope.addWikipediaPage({});
                digestTwice();

                expect(trainingServiceMock.newTrainingData).toHaveBeenCalledWith(
                    'project1', 'user1', 'class1', 'text', 'local',
                    { type : 'wikipedia', title : 'Kittens', contents : 'Kittens are cats' }
                );
            });

            it('the inner dialog controller looks up a page by title and populates contents', function () {
                readyToyController();
                $mdDialogMock.show.and.returnValue($q.reject());
                $scope.addWikipediaPage({});
                var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];

                var innerScope = {};
                dialogOptions.controller(innerScope, dialogOptions.locals);

                wikipediaServiceMock.searchByTitle.and.returnValue($q.resolve('Kittens are cats'));
                innerScope.search('Kittens');
                $rootScope.$digest();

                expect(wikipediaServiceMock.searchByTitle).toHaveBeenCalledWith('Kittens');
                expect(innerScope.contents).toBe('Kittens are cats');
            });

            it('the inner dialog controller does not search when no title is given', function () {
                readyToyController();
                $mdDialogMock.show.and.returnValue($q.reject());
                $scope.addWikipediaPage({});
                var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];

                var innerScope = {};
                dialogOptions.controller(innerScope, dialogOptions.locals);

                innerScope.search('');

                expect(wikipediaServiceMock.searchByTitle).not.toHaveBeenCalled();
            });

        });


        describe('addCorpusFile', function () {

            it('reads the chosen files and adds them all to the corpus', function () {
                readyToyController();
                var files = [ { name : 'a.txt' }, { name : 'b.txt' } ];
                var readFiles = [
                    { type : 'text', title : 'a.txt', contents : 'contents a' },
                    { type : 'text', title : 'b.txt', contents : 'contents b' }
                ];
                txtServiceMock.getContents.and.returnValue($q.resolve(readFiles));
                trainingServiceMock.bulkAddTrainingData.and.returnValue($q.resolve([
                    { id : 'd1', title : 'a.txt', type : 'text' },
                    { id : 'd2', title : 'b.txt', type : 'text' }
                ]));

                $scope.addCorpusFile({ currentTarget : { files : files } });
                digestTwice();

                expect(txtServiceMock.getContents).toHaveBeenCalledWith(files);
                expect(trainingServiceMock.bulkAddTrainingData).toHaveBeenCalledWith($scope.project, readFiles, 'user1', 'class1');
                expect($scope.corpus).toEqual([
                    { id : 'd1', title : 'a.txt', type : 'text' },
                    { id : 'd2', title : 'b.txt', type : 'text' }
                ]);
            });

            it('does nothing when there are no files on the event', function () {
                readyToyController();

                var result = $scope.addCorpusFile({ currentTarget : {} });

                expect(result).toBeUndefined();
                expect(txtServiceMock.getContents).not.toHaveBeenCalled();
            });

            it('shows an error alert if reading a file fails', function () {
                var vm = readyToyController();
                txtServiceMock.getContents.and.returnValue($q.reject(new Error('bad file')));

                $scope.addCorpusFile({ currentTarget : { files : [ { name : 'a.txt' } ] } });
                digestTwice();

                expect(vm.errors.length).toBe(1);
                expect(vm.errors[0].message).toBe('There was a problem reading one of your files');
            });

        });


        describe('removeCorpusDoc', function () {

            it('removes the document from the corpus', function () {
                trainingServiceMock.getTraining.and.returnValue($q.resolve([
                    { id : 'd1', title : 'Doc 1', type : 'text' },
                    { id : 'd2', title : 'Doc 2', type : 'text' }
                ]));
                trainingServiceMock.retrieveAsset.and.returnValue($q.reject({ status : 404 }));
                readyToyController();

                trainingServiceMock.deleteTrainingData.and.returnValue($q.resolve());

                $scope.removeCorpusDoc('d1');
                digestTwice();

                expect(trainingServiceMock.deleteTrainingData).toHaveBeenCalledWith('project1', 'user1', 'class1', 'd1');
                expect($scope.corpus).toEqual([ { id : 'd2', title : 'Doc 2', type : 'text' } ]);
            });

        });


        describe('modifyCorpus (triggered by add/remove)', function () {

            it('does not re-parse the corpus when there is no existing analysis yet', function () {
                readyToyController();
                trainingServiceMock.newTrainingData.and.returnValue($q.resolve({ id : 'd1', title : 'My text', type : 'text' }));
                $mdDialogMock.show.and.returnValue($q.resolve({ title : 'My text', contents : 'hello world' }));

                $scope.addCorpusText({});
                digestTwice();

                expect(languageModelServiceMock.generateNgrams).not.toHaveBeenCalled();
            });

            it('re-parses the corpus once an analysis already exists', function () {
                toyControllerWithAnalyzedCorpus();
                trainingServiceMock.getTraining.and.returnValue($q.resolve([
                    { id : 'd1', title : 'Doc 1', type : 'text', contents : 'hello world' },
                    { id : 'd2', title : 'My text', type : 'text', contents : 'hello world' }
                ]));
                languageModelServiceMock.generateNgrams.and.returnValue($q.resolve({
                    bigrams : { count : 1 }, trigrams : { count : 0 }, tetragrams : { count : 0 }
                }));
                trainingServiceMock.newTrainingData.and.returnValue($q.resolve({ id : 'd2', title : 'My text', type : 'text' }));
                $mdDialogMock.show.and.returnValue($q.resolve({ title : 'My text', contents : 'hello world' }));

                $scope.addCorpusText({});
                digestTwice();

                expect(languageModelServiceMock.generateNgrams).toHaveBeenCalled();
            });

            it('regression: shortcuts the ngrams API call and clears stale analysis when the corpus becomes empty', function () {
                toyControllerWithAnalyzedCorpus();
                trainingServiceMock.getTraining.and.returnValue($q.resolve([]));
                trainingServiceMock.deleteTrainingData.and.returnValue($q.resolve());

                $scope.removeCorpusDoc('d1');
                digestTwice();

                expect(languageModelServiceMock.generateNgrams).not.toHaveBeenCalled();
                expect($scope.phase).toBe($scope.PHASES.TOY.CORPUS);
                expect($scope.project.toy.tokens).toBeUndefined();
                expect($scope.project.toy.ready).toBe(false);
            });

            it('regression: does not leave the page stuck loading if re-parsing the corpus fails', function () {
                var vm = toyControllerWithAnalyzedCorpus();
                trainingServiceMock.getTraining.and.returnValue($q.reject(new Error('logic error, no status')));
                trainingServiceMock.deleteTrainingData.and.returnValue($q.resolve());

                $scope.removeCorpusDoc('d1');
                digestTwice();

                expect($scope.loading).toBe(false);
                expect(vm.errors.length).toBe(1);
            });

        });

    });

});
