// Tests specific to 'regression' projects: regression projects train a
// regression model locally in the browser using TensorFlow.js, predicting
// numeric output column(s) from numeric input column(s). Shared init/
// error-alert/quiz/download behaviour is covered in
// models.controller.common.spec.js - this file only covers what's different
// for regression projects.
describe('ModelsController (regression projects)', function () {

    var $controller;
    var $q;
    var $rootScope;
    var $scope;
    var $timeout;
    var $interval;

    var authServiceMock, projectsServiceMock, trainingServiceMock, quizServiceMock;
    var soundTrainingServiceMock, imageTrainingServiceMock, regressionTrainingServiceMock, numberTrainingServiceMock;
    var modelServiceMock, utilServiceMock, storageServiceMock, downloadServiceMock, browserStorageServiceMock;
    var imageToolsServiceMock, webcamsServiceMock, gpuDetectionServiceMock;
    var scrollServiceMock, loggerServiceMock;
    var $stateParamsMock, $locationMock, $mdDialogMock, $stateMock;

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

        authServiceMock = {
            getProfileDeferred : jasmine.createSpy('getProfileDeferred').and.returnValue($q.resolve(profile))
        };
        projectsServiceMock = jasmine.createSpyObj('projectsService', [
            'getProject', 'getLabels', 'getFields', 'createLocalProject'
        ]);
        projectsServiceMock.getLabels.and.returnValue($q.resolve({ data : 12, outputcolumns : 1 }));

        trainingServiceMock = jasmine.createSpyObj('trainingService', [
            'getModels', 'newModel', 'testModel', 'deleteModel'
        ]);
        trainingServiceMock.getModels.and.returnValue($q.resolve([]));

        quizServiceMock = jasmine.createSpyObj('quizService', ['getQuestion', 'restoreQuestion']);
        soundTrainingServiceMock = jasmine.createSpyObj('soundTrainingService', [
            'initSoundSupport', 'getModels', 'newModel', 'deleteModel', 'startTest', 'stopTest', 'reset'
        ]);
        imageTrainingServiceMock = jasmine.createSpyObj('imageTrainingService', [
            'initImageSupport', 'getModels', 'newModel', 'deleteModel', 'testCanvas', 'testBase64ImageData', 'reset'
        ]);
        regressionTrainingServiceMock = jasmine.createSpyObj('regressionTrainingService', [
            'initRegressionSupport', 'getModels', 'newModel', 'deleteModel', 'testModel', 'reset'
        ]);
        regressionTrainingServiceMock.initRegressionSupport.and.returnValue($q.resolve(false));
        regressionTrainingServiceMock.getModels.and.returnValue($q.resolve([]));
        numberTrainingServiceMock = jasmine.createSpyObj('numberTrainingService', [
            'initNumberSupport', 'getModels', 'newModel', 'deleteModel', 'testModel'
        ]);

        modelServiceMock = jasmine.createSpyObj('modelService', [
            'generateProjectSummary', 'reviewTrainingData', 'getStatus'
        ]);
        modelServiceMock.generateProjectSummary.and.returnValue('weight');
        modelServiceMock.reviewTrainingData.and.returnValue({ counts : [ { label : 'data', count : 12 } ], status : 'data' });
        modelServiceMock.getStatus.and.callFake(function (models) {
            if (!models || models.length === 0) { return 'idle'; }
            if (models.every(function (m) { return m.status === 'Training'; })) { return 'training'; }
            if (models.every(function (m) { return m.status === 'Available'; })) { return 'ready'; }
            return 'error';
        });

        utilServiceMock = jasmine.createSpyObj('utilService', [
            'loadImageProjectSupport', 'loadTensorFlow', 'logTfjsMemory', 'isGoogleFilesUrl'
        ]);
        storageServiceMock = jasmine.createSpyObj('storageService', ['getItem', 'setItem', 'removeItem']);
        downloadServiceMock = jasmine.createSpyObj('downloadService', ['downloadFile']);
        browserStorageServiceMock = jasmine.createSpyObj('browserStorageService', [
            'requestPersistentStorage', 'idIsLocal'
        ]);
        imageToolsServiceMock = jasmine.createSpyObj('imageToolsService', ['resizeImageElement', 'getDataFromFile']);
        webcamsServiceMock = jasmine.createSpyObj('webcamsService', ['getDevices']);
        gpuDetectionServiceMock = jasmine.createSpyObj('gpuDetectionService', ['isConstrained']);
        scrollServiceMock = jasmine.createSpyObj('scrollService', ['scrollToNewItem']);
        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error', 'warn']);

        $stateParamsMock = { projectId : 'proj1', userId : 'user1' };
        $locationMock = jasmine.createSpyObj('$location', ['search']);
        $locationMock.search.and.returnValue({});
        $mdDialogMock = jasmine.createSpyObj('$mdDialog', ['show', 'hide', 'cancel']);
        $mdDialogMock.show.and.returnValue($q.resolve());
        $stateMock = jasmine.createSpyObj('$state', ['reload']);
    });

    function createController() {
        return $controller('ModelsController', {
            authService : authServiceMock,
            projectsService : projectsServiceMock,
            trainingService : trainingServiceMock,
            quizService : quizServiceMock,
            soundTrainingService : soundTrainingServiceMock,
            imageTrainingService : imageTrainingServiceMock,
            regressionTrainingService : regressionTrainingServiceMock,
            numberTrainingService : numberTrainingServiceMock,
            modelService : modelServiceMock,
            utilService : utilServiceMock,
            storageService : storageServiceMock,
            downloadService : downloadServiceMock,
            browserStorageService : browserStorageServiceMock,
            imageToolsService : imageToolsServiceMock,
            webcamsService : webcamsServiceMock,
            gpuDetectionService : gpuDetectionServiceMock,
            scrollService : scrollServiceMock,
            loggerService : loggerServiceMock,
            $stateParams : $stateParamsMock,
            $location : $locationMock,
            $scope : $scope,
            $mdDialog : $mdDialogMock,
            $timeout : $timeout,
            $interval : $interval,
            $state : $stateMock
        });
    }

    function regressionProject(overrides) {
        return angular.extend({
            id : 'proj1', userid : 'user1', type : 'regression', storage : 'cloud',
            columns : [
                { label : 'height', type : 'number', output : false },
                { label : 'weight', type : 'number', output : true }
            ]
        }, overrides || {});
    }

    function readyController(project) {
        projectsServiceMock.getProject.and.returnValue($q.resolve(project));
        var vm = createController();
        $rootScope.$digest();
        return vm;
    }


    describe('initialisation', function () {

        it('always sets the two pseudo-labels, regardless of the project columns', function () {
            var project = regressionProject();
            readyController(project);

            expect($scope.project.labels).toEqual([ 'input', 'output' ]);
        });

        it('initialises regression support with the whole project', function () {
            var project = regressionProject();
            readyController(project);

            expect(regressionTrainingServiceMock.initRegressionSupport).toHaveBeenCalledWith(project);
        });

        it('fetches the latest model status when a model was loaded', function () {
            regressionTrainingServiceMock.initRegressionSupport.and.returnValue($q.resolve(true));
            regressionTrainingServiceMock.getModels.and.returnValue($q.resolve([ { classifierid : 'proj1', status : 'Available' } ]));

            readyController(regressionProject());

            expect(regressionTrainingServiceMock.getModels).toHaveBeenCalled();
            expect($scope.models).toEqual([ { classifierid : 'proj1', status : 'Available' } ]);
        });

        it('keeps minimumExamples at "ten" for a regression project', function () {
            readyController(regressionProject());

            expect($scope.minimumExamples).toBe('ten');
        });

        it('does not set constrainedDevice, even with the URL override or a constrained GPU (no simplified-training mode for regression)', function () {
            $locationMock.search.and.returnValue({ simplified : true });
            gpuDetectionServiceMock.isConstrained.and.returnValue(true);

            readyController(regressionProject());

            expect($scope.constrainedDevice).toBeUndefined();
        });

        it('builds the project summary from the output columns only', function () {
            var project = regressionProject({
                columns : [
                    { label : 'height', type : 'number', output : false },
                    { label : 'weight', type : 'number', output : true }
                ]
            });

            readyController(project);

            expect(modelServiceMock.generateProjectSummary).toHaveBeenCalledWith([ 'weight' ], ' and ');
            expect($scope.projectSummary).toBe('weight');
        });

        it('defaults to a single "something" column when the project has no columns defined yet', function () {
            var project = regressionProject({ columns : undefined });

            readyController(project);

            expect(modelServiceMock.generateProjectSummary).toHaveBeenCalledWith([ 'something' ], ' and ');
        });

        it('uses a fixed "something" summary (skipping generateProjectSummary) when there are columns but none are marked as output', function () {
            var project = regressionProject({
                columns : [ { label : 'height', type : 'number', output : false } ]
            });

            readyController(project);

            expect(modelServiceMock.generateProjectSummary).not.toHaveBeenCalled();
            expect($scope.projectSummary).toBe('something');
        });

    });


    describe('creating a model', function () {

        it('creates a new model via regressionTrainingService, with no simplified-training option', function () {
            var project = regressionProject();
            var vm = readyController(project);
            regressionTrainingServiceMock.newModel.and.returnValue($q.resolve({ classifierid : 'proj1', status : 'Training', updated : new Date() }));

            vm.createModel({}, project, false);
            $rootScope.$digest();

            expect(regressionTrainingServiceMock.newModel).toHaveBeenCalledWith(project);
            expect(regressionTrainingServiceMock.newModel.calls.mostRecent().args.length).toBe(1);
        });

        it('requests persistent browser storage for a local regression project', function () {
            var project = regressionProject({ storage : 'local' });
            var vm = readyController(project);
            regressionTrainingServiceMock.newModel.and.returnValue($q.defer().promise);

            vm.createModel({}, project, false);

            expect(browserStorageServiceMock.requestPersistentStorage).toHaveBeenCalled();
        });

    });


    describe('deleting a model', function () {

        it('deletes the model via regressionTrainingService using the project id', function () {
            var project = regressionProject();
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', status : 'Available' } ];
            regressionTrainingServiceMock.deleteModel.and.returnValue($q.resolve());

            vm.deleteModel({}, project, { classifierid : 'proj1' });
            $rootScope.$digest();

            expect(regressionTrainingServiceMock.deleteModel).toHaveBeenCalledWith('proj1');
            expect($scope.models).toEqual([]);
        });

        it('does not resume polling after a successful delete, since there is nothing left to check', function () {
            // see the equivalent test in models.controller.numbers.spec.js for
            // the full explanation - this is the same fix, applying to
            // images/sounds/regression too
            var project = regressionProject();
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', status : 'Available' } ];
            regressionTrainingServiceMock.deleteModel.and.returnValue($q.resolve());

            vm.deleteModel({}, project, { classifierid : 'proj1' });
            $rootScope.$digest();

            regressionTrainingServiceMock.getModels.calls.reset();
            $interval.flush(2000);
            expect(regressionTrainingServiceMock.getModels).not.toHaveBeenCalled();
        });

    });


    describe('testing a model', function () {

        it('submits only the non-output numeric columns, and displays the raw prediction object', function () {
            var project = regressionProject();
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', status : 'Available' } ];
            $scope.testformData.height = '182.5';
            regressionTrainingServiceMock.testModel.and.returnValue($q.resolve([ { weight : 79.4 } ]));

            vm.testModel({}, {}, project);
            $rootScope.$digest();
            $timeout.flush();

            expect(regressionTrainingServiceMock.testModel).toHaveBeenCalledWith(project, { height : 182.5 });
            expect($scope.testoutput).toEqual({ weight : 79.4 });
        });

        it('does not include output columns in the submitted test data', function () {
            var project = regressionProject();
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', status : 'Available' } ];
            $scope.testformData.height = '150';
            $scope.testformData.weight = '999'; // an output column - should be ignored as input
            regressionTrainingServiceMock.testModel.and.returnValue($q.resolve([]));

            vm.testModel({}, {}, project);

            var submitted = regressionTrainingServiceMock.testModel.calls.mostRecent().args[1];
            expect(submitted.weight).toBeUndefined();
        });

        it('shows an error alert when the test request fails', function () {
            var project = regressionProject();
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', status : 'Available' } ];
            $scope.testformData.height = '150';
            regressionTrainingServiceMock.testModel.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            vm.testModel({}, {}, project);
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
        });

    });


    describe('status polling', function () {

        it('polls every 2 seconds while training', function () {
            var project = regressionProject();
            var vm = readyController(project);
            regressionTrainingServiceMock.newModel.and.returnValue($q.resolve({ classifierid : 'proj1', status : 'Training', updated : new Date() }));

            vm.createModel({}, project, false);
            $rootScope.$digest();

            regressionTrainingServiceMock.getModels.calls.reset();
            regressionTrainingServiceMock.getModels.and.returnValue($q.resolve([ { classifierid : 'proj1', status : 'Training', updated : new Date() } ]));

            $interval.flush(1999);
            $rootScope.$digest();
            expect(regressionTrainingServiceMock.getModels).not.toHaveBeenCalled();

            $interval.flush(1);
            $rootScope.$digest();
            expect(regressionTrainingServiceMock.getModels).toHaveBeenCalledTimes(1);
        });

    });


    describe('page cleanup ($destroy)', function () {

        it('resets the regression training service and no others', function () {
            readyController(regressionProject());

            $scope.$destroy();

            expect(regressionTrainingServiceMock.reset).toHaveBeenCalled();
            expect(soundTrainingServiceMock.reset).not.toHaveBeenCalled();
            expect(imageTrainingServiceMock.reset).not.toHaveBeenCalled();
        });

    });

});
