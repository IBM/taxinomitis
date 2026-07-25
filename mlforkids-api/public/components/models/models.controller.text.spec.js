// Tests specific to 'text' projects: text projects train a classifier via
// a cloud API (Watson Assistant) that has to be polled for status, with an
// extra local/cloud-shadow-project wrinkle for local projects. Shared
// init/error-alert/quiz/download behaviour is covered in
// models.controller.common.spec.js - this file only covers what's different
// for text projects.
describe('ModelsController (text projects)', function () {

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
            'getModels', 'newModel', 'newLocalProjectTextModel', 'testModel', 'testModelPrep',
            'deleteModel', 'deleteTrainingData'
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
        utilServiceMock.isGoogleFilesUrl.and.returnValue(false);
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

    function cloudTextProject(overrides) {
        return angular.extend({
            id : 'proj1', userid : 'user1', type : 'text', storage : 'cloud', labels : [ 'cat', 'dog' ]
        }, overrides || {});
    }
    function localTextProject(overrides) {
        return angular.extend({
            id : 'localproj1', userid : 'user1', type : 'text', storage : 'local', labels : [ 'cat', 'dog' ]
        }, overrides || {});
    }

    // creates a controller and lets init settle, for the given project
    function readyController(project) {
        projectsServiceMock.getProject.and.returnValue($q.resolve(project));
        var vm = createController();
        $rootScope.$digest();
        return vm;
    }


    describe('creating a model - cloud storage', function () {

        it('calls trainingService.newModel with the project id', function () {
            var project = cloudTextProject();
            var vm = readyController(project);
            trainingServiceMock.newModel.and.returnValue($q.resolve({ classifierid : 'm1', status : 'Training', updated : new Date() }));

            vm.createModel({}, project, false);
            $rootScope.$digest();

            expect(trainingServiceMock.newModel).toHaveBeenCalledWith('proj1', 'user1', 'class1');
            expect(browserStorageServiceMock.requestPersistentStorage).not.toHaveBeenCalled();
            expect($scope.models).toEqual([ { classifierid : 'm1', status : 'Training', updated : jasmine.any(Date) } ]);
            expect($scope.submittingTrainingRequest).toBe(false);
        });

        it('clears any previous test output immediately', function () {
            var project = cloudTextProject();
            var vm = readyController(project);
            $scope.testoutput = 'old result';
            $scope.testoutput_explanation = 'with 90% confidence';
            trainingServiceMock.newModel.and.returnValue($q.defer().promise);

            vm.createModel({}, project, false);

            expect($scope.testoutput).toBeUndefined();
            expect($scope.testoutput_explanation).toBeUndefined();
        });

        it('shows an error alert when training fails for a reason unrelated to bad training data', function () {
            var project = cloudTextProject();
            var vm = readyController(project);
            trainingServiceMock.newModel.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            vm.createModel({}, project, false);
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect($scope.submittingTrainingRequest).toBe(false);
            expect($mdDialogMock.show).not.toHaveBeenCalled();
        });

        it('shows the model as failed AND raises an error alert when the new model itself reports an error', function () {
            var project = cloudTextProject();
            var vm = readyController(project);
            var failedModel = { classifierid : 'm1', status : 'Failed', updated : new Date(), error : { status : 500, data : { error : 'training failed' } } };
            trainingServiceMock.newModel.and.returnValue($q.resolve(failedModel));

            vm.createModel({}, project, false);
            $rootScope.$digest();

            expect($scope.models).toEqual([ failedModel ]);
            expect(vm.errors.length).toBe(1);
        });

        it('offers to delete the offending training item when training fails because of a bad download', function () {
            var project = cloudTextProject();
            var vm = readyController(project);
            var downloadFailErr = {
                status : 409,
                data : {
                    code : 'MLMOD12',
                    error : 'could not download image',
                    location : { imageid : 'img1', url : 'http://example.com/img.jpg', type : 'download' }
                }
            };
            trainingServiceMock.newModel.and.returnValue($q.reject(downloadFailErr));

            vm.createModel({}, project, false);
            $rootScope.$digest();

            expect(vm.errors.length).toBe(0);
            expect($mdDialogMock.show).toHaveBeenCalledWith(jasmine.objectContaining({
                templateUrl : 'static/components/models/downloadfail.tmpl.html'
            }));
        });

        it('populates the download-fail dialog with a Google-specific message when the URL is a Google Files URL', function () {
            var project = cloudTextProject();
            var vm = readyController(project);
            var downloadFailErr = {
                status : 409,
                data : {
                    code : 'MLMOD13',
                    location : { imageid : 'img1', url : 'https://drive.google.com/img.jpg', type : 'download' }
                }
            };
            utilServiceMock.isGoogleFilesUrl.and.returnValue(true);
            trainingServiceMock.newModel.and.returnValue($q.reject(downloadFailErr));

            vm.createModel({}, project, false);
            $rootScope.$digest();

            var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
            var dialogScope = {};
            dialogOptions.controller(dialogScope);

            expect(utilServiceMock.isGoogleFilesUrl).toHaveBeenCalledWith('https://drive.google.com/img.jpg');
            expect(dialogScope.errordetails).toContain('Google has removed access');
        });

        it('deletes the offending training item and reloads the page when the user confirms', function () {
            var project = cloudTextProject();
            var vm = readyController(project);
            var location = { imageid : 'img1', url : 'http://example.com/img.jpg', type : 'download' };
            trainingServiceMock.newModel.and.returnValue($q.reject({
                status : 409,
                data : { code : 'MLMOD12', location : location }
            }));
            $mdDialogMock.show.and.returnValue($q.resolve(location));
            trainingServiceMock.deleteTrainingData.and.returnValue($q.resolve());

            vm.createModel({}, project, false);
            $rootScope.$digest();

            expect(trainingServiceMock.deleteTrainingData).toHaveBeenCalledWith('proj1', 'user1', 'class1', 'img1');
            expect($stateMock.reload).toHaveBeenCalled();
        });

        it('does not delete anything if the user cancels the download-fail dialog', function () {
            var project = cloudTextProject();
            var vm = readyController(project);
            trainingServiceMock.newModel.and.returnValue($q.reject({
                status : 409,
                data : { code : 'MLMOD12', location : { imageid : 'img1', url : 'http://x', type : 'download' } }
            }));
            $mdDialogMock.show.and.returnValue($q.reject());

            vm.createModel({}, project, false);
            $rootScope.$digest();

            expect(trainingServiceMock.deleteTrainingData).not.toHaveBeenCalled();
        });

        it('shows an error alert if deleting the offending training item fails', function () {
            var project = cloudTextProject();
            var vm = readyController(project);
            var location = { imageid : 'img1', url : 'http://x', type : 'download' };
            trainingServiceMock.newModel.and.returnValue($q.reject({
                status : 409,
                data : { code : 'MLMOD12', location : location }
            }));
            $mdDialogMock.show.and.returnValue($q.resolve(location));
            trainingServiceMock.deleteTrainingData.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            vm.createModel({}, project, false);
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect($stateMock.reload).not.toHaveBeenCalled();
        });

    });


    describe('creating a model - local storage', function () {

        it('reuses the existing cloud shadow project when one is already linked', function () {
            var project = localTextProject({ cloudid : 'cloud1' });
            var vm = readyController(project);
            trainingServiceMock.newLocalProjectTextModel.and.returnValue($q.resolve({ classifierid : 'm1', status : 'Training', updated : new Date() }));

            vm.createModel({}, project, false);
            $rootScope.$digest();

            expect(trainingServiceMock.newLocalProjectTextModel).toHaveBeenCalledWith(project);
            expect(projectsServiceMock.createLocalProject).not.toHaveBeenCalled();
            expect(browserStorageServiceMock.requestPersistentStorage).toHaveBeenCalled();
        });

        it('creates a cloud shadow project first when none is linked yet, and starts using it', function () {
            var project = localTextProject();
            delete project.cloudid;
            var vm = readyController(project);
            var cloudproject = angular.extend({}, project, { cloudid : 'newcloud1' });
            projectsServiceMock.createLocalProject.and.returnValue($q.resolve(cloudproject));
            trainingServiceMock.newLocalProjectTextModel.and.returnValue($q.resolve({ classifierid : 'm1', status : 'Training', updated : new Date() }));

            vm.createModel({}, project, false);
            $rootScope.$digest();

            expect(projectsServiceMock.createLocalProject).toHaveBeenCalledWith(project, 'user1', 'class1');
            expect(trainingServiceMock.newLocalProjectTextModel).toHaveBeenCalledWith(cloudproject);
            expect($scope.project).toEqual(cloudproject);
        });

    });


    describe('deleting a model', function () {

        var project, model;

        beforeEach(function () {
            project = cloudTextProject();
            model = { classifierid : 'm1', credentialsid : 'creds1', status : 'Available' };
        });

        it('deletes the model using its classifierid and stops refreshing (nothing left to poll)', function () {
            var vm = readyController(project);
            $scope.models = [ model ];
            trainingServiceMock.deleteModel.and.returnValue($q.resolve());

            vm.deleteModel({}, project, model);
            $rootScope.$digest();

            expect(trainingServiceMock.deleteModel).toHaveBeenCalledWith(project, 'user1', 'class1', 'm1');
            expect($scope.models).toEqual([]);
            expect($scope.status).toBe('idle');
            expect($scope.submittingDeleteRequest).toBe(false);

            // no model left to poll for - confirm no further getModels calls happen
            trainingServiceMock.getModels.calls.reset();
            $interval.flush(20000);
            expect(trainingServiceMock.getModels).not.toHaveBeenCalled();
        });

        it('shows an error alert when deletion fails', function () {
            var vm = readyController(project);
            $scope.models = [ model ];
            trainingServiceMock.deleteModel.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            vm.deleteModel({}, project, model);
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect($scope.submittingDeleteRequest).toBe(false);
        });

        it('reloads the page instead of showing an alert when the model was already gone (404)', function () {
            var vm = readyController(project);
            $scope.models = [ model ];
            trainingServiceMock.deleteModel.and.returnValue($q.reject({ status : 404, data : { error : 'Not found' } }));

            vm.deleteModel({}, project, model);
            $rootScope.$digest();

            expect($stateMock.reload).toHaveBeenCalled();
            expect(vm.errors.length).toBe(0);
        });

    });


    describe('testing a model', function () {

        var project, model;

        beforeEach(function () {
            project = cloudTextProject();
            model = { classifierid : 'm1', credentialsid : 'creds1', status : 'Available' };
        });

        it('submits the entered text and displays the recognised class with confidence', function () {
            var vm = readyController(project);
            $scope.models = [ model ];
            $scope.testformData.testquestion = 'hello there';
            trainingServiceMock.testModel.and.returnValue($q.resolve([ { class_name : 'cat', confidence : 87.4 } ]));

            vm.testModel({}, {}, project);
            $rootScope.$digest();
            $timeout.flush();

            expect(trainingServiceMock.testModel).toHaveBeenCalledWith(
                project, 'user1', 'class1', 'm1', 'creds1', { type : 'text', text : 'hello there' }
            );
            expect($scope.testoutput).toBe('cat');
            expect($scope.testoutput_explanation).toBe('with 87% confidence');
        });

        it('shows an error alert when the test request fails', function () {
            var vm = readyController(project);
            $scope.models = [ model ];
            $scope.testformData.testquestion = 'hello there';
            trainingServiceMock.testModel.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            vm.testModel({}, {}, project);
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect($scope.testoutput).toBeUndefined();
        });

        it('reports an unrecognised result when the model returns no matches', function () {
            var vm = readyController(project);
            $scope.models = [ model ];
            $scope.testformData.testquestion = 'hello there';
            trainingServiceMock.testModel.and.returnValue($q.resolve([]));

            vm.testModel({}, {}, project);
            $rootScope.$digest();
            $timeout.flush();

            expect($scope.testoutput).toBe('Unknown');
        });

    });


    describe('status polling', function () {

        it('polls every 20 seconds while training, and stops once the model is no longer training', function () {
            var project = cloudTextProject();
            var vm = readyController(project);
            trainingServiceMock.newModel.and.returnValue($q.resolve({ classifierid : 'm1', status : 'Training', updated : new Date() }));

            vm.createModel({}, project, false);
            $rootScope.$digest();

            trainingServiceMock.getModels.calls.reset();
            trainingServiceMock.getModels.and.returnValue($q.resolve([ { classifierid : 'm1', status : 'Training', updated : new Date() } ]));

            $interval.flush(19999);
            $rootScope.$digest();
            expect(trainingServiceMock.getModels).not.toHaveBeenCalled();

            $interval.flush(1);
            $rootScope.$digest();
            expect(trainingServiceMock.getModels).toHaveBeenCalledTimes(1);

            $interval.flush(20000);
            $rootScope.$digest();
            expect(trainingServiceMock.getModels).toHaveBeenCalledTimes(2);

            trainingServiceMock.getModels.and.returnValue($q.resolve([ { classifierid : 'm1', status : 'Available', updated : new Date() } ]));
            $interval.flush(20000);
            $rootScope.$digest();
            expect(trainingServiceMock.getModels).toHaveBeenCalledTimes(3);

            $interval.flush(20000);
            $rootScope.$digest();
            expect(trainingServiceMock.getModels).toHaveBeenCalledTimes(3);
        });

    });


    describe('page cleanup ($destroy)', function () {

        it('does not call any of the browser-training reset functions for a text project', function () {
            var project = cloudTextProject();
            readyController(project);

            $scope.$destroy();

            expect(soundTrainingServiceMock.reset).not.toHaveBeenCalled();
            expect(imageTrainingServiceMock.reset).not.toHaveBeenCalled();
            expect(regressionTrainingServiceMock.reset).not.toHaveBeenCalled();
        });

    });

});
