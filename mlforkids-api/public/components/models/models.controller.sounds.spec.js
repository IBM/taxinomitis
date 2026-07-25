// Tests specific to 'sounds' projects: sound projects train a classifier
// locally in the browser using TensorFlow.js, and are tested by continuous
// listening rather than a one-off test submission. Shared init/error-alert/
// quiz/download behaviour is covered in models.controller.common.spec.js -
// this file only covers what's different for sound projects.
describe('ModelsController (sound projects)', function () {

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
        projectsServiceMock.getLabels.and.returnValue($q.resolve({ cat : 3, dog : 4 }));

        trainingServiceMock = jasmine.createSpyObj('trainingService', [
            'getModels', 'newModel', 'testModel', 'deleteModel'
        ]);
        trainingServiceMock.getModels.and.returnValue($q.resolve([]));

        quizServiceMock = jasmine.createSpyObj('quizService', ['getQuestion', 'restoreQuestion']);
        soundTrainingServiceMock = jasmine.createSpyObj('soundTrainingService', [
            'initSoundSupport', 'getModels', 'newModel', 'deleteModel', 'startTest', 'stopTest', 'reset'
        ]);
        soundTrainingServiceMock.initSoundSupport.and.returnValue($q.resolve({}));
        soundTrainingServiceMock.getModels.and.returnValue($q.resolve([]));
        soundTrainingServiceMock.stopTest.and.returnValue($q.resolve());
        imageTrainingServiceMock = jasmine.createSpyObj('imageTrainingService', [
            'initImageSupport', 'getModels', 'newModel', 'deleteModel', 'testCanvas', 'testBase64ImageData', 'reset'
        ]);
        regressionTrainingServiceMock = jasmine.createSpyObj('regressionTrainingService', [
            'initRegressionSupport', 'getModels', 'newModel', 'deleteModel', 'testModel', 'reset'
        ]);
        numberTrainingServiceMock = jasmine.createSpyObj('numberTrainingService', [
            'initNumberSupport', 'getModels', 'newModel', 'deleteModel', 'testModel'
        ]);

        modelServiceMock = jasmine.createSpyObj('modelService', [
            'generateProjectSummary', 'reviewTrainingData', 'getStatus'
        ]);
        modelServiceMock.generateProjectSummary.and.returnValue('cat or dog');
        modelServiceMock.reviewTrainingData.and.returnValue({ counts : [], status : 'data' });
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
        gpuDetectionServiceMock.isConstrained.and.returnValue(false);
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

    function soundsProject(overrides) {
        return angular.extend({
            id : 'proj1', userid : 'user1', type : 'sounds', storage : 'cloud', labels : [ 'cat', 'dog' ]
        }, overrides || {});
    }

    function readyController(project) {
        projectsServiceMock.getProject.and.returnValue($q.resolve(project));
        var vm = createController();
        $rootScope.$digest();
        return vm;
    }


    describe('initialisation', function () {

        it('initialises sound support with the project labels, always loading a saved model if available', function () {
            var project = soundsProject();
            readyController(project);

            expect(soundTrainingServiceMock.initSoundSupport).toHaveBeenCalledWith('proj1', [ 'cat', 'dog' ], true);
        });

        it('initialises sound support even when there are no labels yet (unlike image projects)', function () {
            var project = soundsProject({ labels : [] });

            var vm = readyController(project);

            expect(soundTrainingServiceMock.initSoundSupport).toHaveBeenCalledWith('proj1', [], true);
            expect(vm.errors).toEqual([]);
        });

        it('fetches the latest model status when a model was loaded', function () {
            soundTrainingServiceMock.initSoundSupport.and.returnValue($q.resolve({ loaded : true }));
            soundTrainingServiceMock.getModels.and.returnValue($q.resolve([ { classifierid : 'proj1', status : 'Available' } ]));

            readyController(soundsProject());

            expect(soundTrainingServiceMock.getModels).toHaveBeenCalled();
            expect($scope.models).toEqual([ { classifierid : 'proj1', status : 'Available' } ]);
        });

        it('shows a warning banner when sound support reports one (e.g. the Firefox warning)', function () {
            soundTrainingServiceMock.initSoundSupport.and.returnValue($q.resolve({
                warning : { message : 'Firefox users have reported problems...' }
            }));

            var vm = readyController(soundsProject());

            expect(vm.warnings.length).toBe(1);
            expect(vm.warnings[0].message).toBe('Firefox users have reported problems...');
        });

        it('sets constrainedDevice from the URL when the "simplified" query param is present', function () {
            $locationMock.search.and.returnValue({ simplified : true });

            readyController(soundsProject());

            expect($scope.constrainedDevice).toBe(true);
        });

        it('falls back to GPU detection for constrainedDevice when there is no URL override', function () {
            gpuDetectionServiceMock.isConstrained.and.returnValue(true);

            readyController(soundsProject());

            expect($scope.constrainedDevice).toBe(true);
        });

    });


    describe('creating a model', function () {

        it('creates a new model via soundTrainingService with the requested simplified flag', function () {
            var project = soundsProject();
            var vm = readyController(project);
            soundTrainingServiceMock.newModel.and.returnValue($q.resolve({ classifierid : 'proj1', status : 'Training', updated : new Date() }));

            vm.createModel({}, project, true);
            $rootScope.$digest();

            expect(soundTrainingServiceMock.newModel).toHaveBeenCalledWith('proj1', 'user1', 'class1', true);
        });

        it('requests persistent browser storage for a local sounds project', function () {
            var project = soundsProject({ storage : 'local' });
            var vm = readyController(project);
            soundTrainingServiceMock.newModel.and.returnValue($q.defer().promise);

            vm.createModel({}, project, false);

            expect(browserStorageServiceMock.requestPersistentStorage).toHaveBeenCalled();
        });

    });


    describe('deleting a model', function () {

        it('deletes the model via soundTrainingService using the project id', function () {
            var project = soundsProject();
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', status : 'Available' } ];
            soundTrainingServiceMock.deleteModel.and.returnValue($q.resolve());

            vm.deleteModel({}, project, { classifierid : 'proj1' });
            $rootScope.$digest();

            expect(soundTrainingServiceMock.deleteModel).toHaveBeenCalledWith('proj1');
            expect($scope.models).toEqual([]);
        });

        it('does not resume polling after a successful delete, since there is nothing left to check', function () {
            // see the equivalent test in models.controller.numbers.spec.js for
            // the full explanation - this is the same fix, applying to
            // images/sounds/regression too
            var project = soundsProject();
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', status : 'Available' } ];
            soundTrainingServiceMock.deleteModel.and.returnValue($q.resolve());

            vm.deleteModel({}, project, { classifierid : 'proj1' });
            $rootScope.$digest();

            soundTrainingServiceMock.getModels.calls.reset();
            $interval.flush(2000);
            expect(soundTrainingServiceMock.getModels).not.toHaveBeenCalled();
        });

    });


    describe('testModel', function () {

        it('does nothing - sound projects are tested via continuous listening, not form submission', function () {
            var project = soundsProject();
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', credentialsid : 'creds1', status : 'Available' } ];

            vm.testModel({}, {}, project);
            $rootScope.$digest();

            expect(trainingServiceMock.testModel).not.toHaveBeenCalled();
            expect($scope.testoutput).toBeUndefined();
        });

    });


    describe('startListening / stopListening', function () {

        it('starts listening and displays predictions as they arrive', function () {
            var vm = readyController(soundsProject());
            var callback;
            soundTrainingServiceMock.startTest.and.callFake(function (cb) { callback = cb; });

            vm.startListening();

            expect($scope.listening).toBe(true);
            expect(soundTrainingServiceMock.startTest).toHaveBeenCalled();

            callback([ { class_name : 'bark', confidence : 91.2 } ]);
            $rootScope.$digest();

            expect($scope.testoutput).toBe('bark');
            expect($scope.testoutput_explanation).toBe('with 91% confidence');
        });

        it('does not start listening again if already listening', function () {
            var vm = readyController(soundsProject());
            vm.startListening();
            soundTrainingServiceMock.startTest.calls.reset();

            vm.startListening();

            expect(soundTrainingServiceMock.startTest).not.toHaveBeenCalled();
        });

        it('stops listening and clears the test output', function () {
            var vm = readyController(soundsProject());
            vm.startListening();
            $scope.testoutput = 'bark';

            vm.stopListening();
            $rootScope.$digest();
            // stopTest().then() schedules $applyAsync(clearTestOutput) *during*
            // the digest above, too late for that same digest's flush check -
            // a second digest (or $timeout.flush()) is needed to run it
            $timeout.flush();

            expect($scope.listening).toBe(false);
            expect(soundTrainingServiceMock.stopTest).toHaveBeenCalled();
            expect($scope.testoutput).toBeUndefined();
        });

        it('does not call stopTest if not currently listening', function () {
            var vm = readyController(soundsProject());

            vm.stopListening();

            expect(soundTrainingServiceMock.stopTest).not.toHaveBeenCalled();
        });

        it('logs but does not alert the user if stopping the microphone fails', function () {
            var vm = readyController(soundsProject());
            vm.startListening();
            soundTrainingServiceMock.stopTest.and.returnValue($q.reject(new Error('mic error')));

            vm.stopListening();
            $rootScope.$digest();

            expect(vm.errors).toEqual([]);
        });

    });


    describe('status polling', function () {

        it('polls every 2 seconds while training', function () {
            var project = soundsProject();
            var vm = readyController(project);
            soundTrainingServiceMock.newModel.and.returnValue($q.resolve({ classifierid : 'proj1', status : 'Training', updated : new Date() }));

            vm.createModel({}, project, false);
            $rootScope.$digest();

            soundTrainingServiceMock.getModels.calls.reset();
            soundTrainingServiceMock.getModels.and.returnValue($q.resolve([ { classifierid : 'proj1', status : 'Training', updated : new Date() } ]));

            $interval.flush(1999);
            $rootScope.$digest();
            expect(soundTrainingServiceMock.getModels).not.toHaveBeenCalled();

            $interval.flush(1);
            $rootScope.$digest();
            expect(soundTrainingServiceMock.getModels).toHaveBeenCalledTimes(1);
        });

    });


    describe('page cleanup ($destroy)', function () {

        it('resets the sound training service and no others', function () {
            readyController(soundsProject());

            $scope.$destroy();

            expect(soundTrainingServiceMock.reset).toHaveBeenCalled();
            expect(imageTrainingServiceMock.reset).not.toHaveBeenCalled();
            expect(regressionTrainingServiceMock.reset).not.toHaveBeenCalled();
        });

        it('stops listening before resetting, if the page is left while listening', function () {
            var vm = readyController(soundsProject());
            vm.startListening();

            $scope.$destroy();

            expect(soundTrainingServiceMock.stopTest).toHaveBeenCalled();
            expect(soundTrainingServiceMock.reset).toHaveBeenCalled();
        });

        it('does not try to stop listening if not currently listening', function () {
            readyController(soundsProject());

            $scope.$destroy();

            expect(soundTrainingServiceMock.stopTest).not.toHaveBeenCalled();
            expect(soundTrainingServiceMock.reset).toHaveBeenCalled();
        });

    });

});
