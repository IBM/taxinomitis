// Tests specific to 'numbers' projects: numbers projects train a decision
// tree classifier via a cloud API that has to be polled for status. Shared
// init/error-alert/quiz/download behaviour is covered in
// models.controller.common.spec.js - this file only covers what's different
// for numbers projects.
describe('ModelsController (numbers projects)', function () {

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
    // the numbers-project delete path deliberately fires a cloud delete
    // request without attaching a .catch() to it (confirmed intentional -
    // see the "fire-and-forget" test below), so Angular's default
    // unhandled-rejection reporting needs to be turned off for this file
    beforeEach(module(function ($qProvider) {
        $qProvider.errorOnUnhandledRejections(false);
    }));

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
        projectsServiceMock.getFields.and.returnValue($q.resolve([
            { name : 'weight', type : 'number' },
            { name : 'colour', type : 'multichoice', choices : [ 'red', 'blue' ] }
        ]));

        trainingServiceMock = jasmine.createSpyObj('trainingService', [
            'getModels', 'newModel', 'testModel', 'deleteModel'
        ]);
        trainingServiceMock.getModels.and.returnValue($q.resolve([]));
        trainingServiceMock.deleteModel.and.returnValue($q.resolve());

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
        numberTrainingServiceMock = jasmine.createSpyObj('numberTrainingService', [
            'initNumberSupport', 'getModels', 'newModel', 'deleteModel', 'testModel'
        ]);
        numberTrainingServiceMock.initNumberSupport.and.returnValue($q.resolve(false));
        numberTrainingServiceMock.getModels.and.returnValue($q.resolve([]));
        numberTrainingServiceMock.deleteModel.and.returnValue($q.resolve());

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

    function numbersProject(overrides) {
        return angular.extend({
            id : 'proj1', userid : 'user1', type : 'numbers', storage : 'cloud', labels : [ 'cat', 'dog' ]
        }, overrides || {});
    }

    function readyController(project) {
        projectsServiceMock.getProject.and.returnValue($q.resolve(project));
        var vm = createController();
        $rootScope.$digest();
        return vm;
    }


    describe('initialisation', function () {

        it('fetches the project fields and initialises number support with no server model info when none exists', function () {
            var project = numbersProject();
            readyController(project);

            expect(projectsServiceMock.getFields).toHaveBeenCalledWith(project, 'user1', 'class1');
            expect(project.fields.length).toBe(2);
            expect(numberTrainingServiceMock.initNumberSupport).toHaveBeenCalledWith(project, undefined);
        });

        it('passes the server-hosted model info to initNumberSupport when the server already has one', function () {
            var project = numbersProject();
            var serverModel = { classifierid : 'proj1', status : 'Training' };
            trainingServiceMock.getModels.and.returnValue($q.resolve([ serverModel ]));

            readyController(project);

            expect(numberTrainingServiceMock.initNumberSupport).toHaveBeenCalledWith(project, serverModel);
        });

        it('fetches the latest model status when a model was loaded (from browser or server)', function () {
            numberTrainingServiceMock.initNumberSupport.and.returnValue($q.resolve(true));
            numberTrainingServiceMock.getModels.and.returnValue($q.resolve([ { classifierid : 'proj1', status : 'Available' } ]));

            var project = numbersProject();
            readyController(project);

            expect(numberTrainingServiceMock.getModels).toHaveBeenCalled();
            expect($scope.models).toEqual([ { classifierid : 'proj1', status : 'Available' } ]);
        });

        it('does not fetch model status when nothing was loaded', function () {
            numberTrainingServiceMock.initNumberSupport.and.returnValue($q.resolve(false));

            var project = numbersProject();
            readyController(project);

            expect(numberTrainingServiceMock.getModels).not.toHaveBeenCalled();
        });

    });


    describe('creating a model', function () {

        it('creates a new model via numberTrainingService with the whole project object', function () {
            var project = numbersProject();
            var vm = readyController(project);
            numberTrainingServiceMock.newModel.and.returnValue($q.resolve({ classifierid : 'proj1', status : 'Training', updated : new Date() }));

            vm.createModel({}, project, false);
            $rootScope.$digest();

            expect(numberTrainingServiceMock.newModel).toHaveBeenCalledWith(project, 'user1', 'class1');
            expect($scope.models).toEqual([ { classifierid : 'proj1', status : 'Training', updated : jasmine.any(Date) } ]);
        });

        it('requests persistent browser storage for a local numbers project', function () {
            var project = numbersProject({ storage : 'local' });
            var vm = readyController(project);
            numberTrainingServiceMock.newModel.and.returnValue($q.defer().promise);

            vm.createModel({}, project, false);

            expect(browserStorageServiceMock.requestPersistentStorage).toHaveBeenCalled();
        });

        it('shows the model as failed AND raises an error alert when the new model itself reports an error', function () {
            var project = numbersProject();
            var vm = readyController(project);
            var failedModel = { classifierid : 'proj1', status : 'Failed', updated : new Date(), error : { status : 500, data : { error : 'training failed' } } };
            numberTrainingServiceMock.newModel.and.returnValue($q.resolve(failedModel));

            vm.createModel({}, project, false);
            $rootScope.$digest();

            expect($scope.models).toEqual([ failedModel ]);
            expect(vm.errors.length).toBe(1);
        });

    });


    describe('deleting a model', function () {

        it('deletes the locally-stored model only, for a local project', function () {
            var project = numbersProject({ storage : 'local' });
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', status : 'Available' } ];

            vm.deleteModel({}, project, { classifierid : 'proj1' });
            $rootScope.$digest();

            expect(numberTrainingServiceMock.deleteModel).toHaveBeenCalledWith('proj1');
            expect(trainingServiceMock.deleteModel).not.toHaveBeenCalled();
            expect($scope.models).toEqual([]);
        });

        it('also asks the server to delete its classifier for a non-local project', function () {
            var project = numbersProject({ storage : 'cloud' });
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', status : 'Available' } ];

            vm.deleteModel({}, project, { classifierid : 'proj1' });
            $rootScope.$digest();

            expect(trainingServiceMock.deleteModel).toHaveBeenCalledWith(project, 'user1', 'class1', 'proj1');
        });

        it('still reports success even if the (fire-and-forget) server-side delete fails', function () {
            // confirmed intentional: the cloud-side delete for numbers projects is
            // best-effort and its outcome does not affect what the UI shows
            var project = numbersProject({ storage : 'cloud' });
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', status : 'Available' } ];
            trainingServiceMock.deleteModel.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            vm.deleteModel({}, project, { classifierid : 'proj1' });
            $rootScope.$digest();

            expect($scope.models).toEqual([]);
            expect($scope.submittingDeleteRequest).toBe(false);
            expect(vm.errors.length).toBe(0);
        });

        it('does not resume polling after a successful delete, since there is nothing left to check', function () {
            // the controller used to unconditionally call refreshModels() again
            // for numbers/images/sounds/regression projects after a delete, even
            // though $scope.models was just cleared to [] - fixed to behave like
            // text projects instead, and just stop refreshing
            var project = numbersProject();
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', status : 'Available' } ];

            vm.deleteModel({}, project, { classifierid : 'proj1' });
            $rootScope.$digest();

            numberTrainingServiceMock.getModels.calls.reset();
            $interval.flush(8000);
            expect(numberTrainingServiceMock.getModels).not.toHaveBeenCalled();
        });

    });


    describe('testing a model', function () {

        it('converts number fields to numbers before submitting the test', function () {
            var project = numbersProject();
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', credentialsid : 'creds1', status : 'Available' } ];
            $scope.testformData.weight = '4.5';
            $scope.testformData.colour = 'red';
            numberTrainingServiceMock.testModel.and.returnValue($q.resolve([ { class_name : 'cat', confidence : 90 } ]));

            vm.testModel({}, {}, project);
            $rootScope.$digest();
            $timeout.flush();

            expect($scope.testformData.weight).toBe(4.5);
            expect($scope.testformData.colour).toBe('red');
            expect(numberTrainingServiceMock.testModel).toHaveBeenCalledWith(project, $scope.testformData);
            expect($scope.testoutput).toBe('cat');
        });

        it('parses whole numbers with parseInt rather than parseFloat', function () {
            var project = numbersProject();
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', credentialsid : 'creds1', status : 'Available' } ];
            $scope.testformData.weight = '7';
            $scope.testformData.colour = 'blue';
            numberTrainingServiceMock.testModel.and.returnValue($q.resolve([]));

            vm.testModel({}, {}, project);

            expect($scope.testformData.weight).toBe(7);
        });

        it('leaves an already-numeric value untouched', function () {
            var project = numbersProject();
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', credentialsid : 'creds1', status : 'Available' } ];
            $scope.testformData.weight = 12.5;
            $scope.testformData.colour = 'red';
            numberTrainingServiceMock.testModel.and.returnValue($q.resolve([]));

            vm.testModel({}, {}, project);

            expect($scope.testformData.weight).toBe(12.5);
        });

    });


    describe('status polling', function () {

        it('polls every 8 seconds while training', function () {
            var project = numbersProject();
            var vm = readyController(project);
            numberTrainingServiceMock.newModel.and.returnValue($q.resolve({ classifierid : 'proj1', status : 'Training', updated : new Date() }));

            vm.createModel({}, project, false);
            $rootScope.$digest();

            numberTrainingServiceMock.getModels.calls.reset();
            numberTrainingServiceMock.getModels.and.returnValue($q.resolve([ { classifierid : 'proj1', status : 'Training', updated : new Date() } ]));

            $interval.flush(7999);
            $rootScope.$digest();
            expect(numberTrainingServiceMock.getModels).not.toHaveBeenCalled();

            $interval.flush(1);
            $rootScope.$digest();
            expect(numberTrainingServiceMock.getModels).toHaveBeenCalledTimes(1);
        });

    });


    describe('page cleanup ($destroy)', function () {

        it('does not call any of the browser-training reset functions for a numbers project', function () {
            var project = numbersProject();
            readyController(project);

            $scope.$destroy();

            expect(soundTrainingServiceMock.reset).not.toHaveBeenCalled();
            expect(imageTrainingServiceMock.reset).not.toHaveBeenCalled();
            expect(regressionTrainingServiceMock.reset).not.toHaveBeenCalled();
        });

    });

});
