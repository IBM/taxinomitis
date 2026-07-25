// Tests specific to 'imgtfjs' (image) projects: image projects train a
// classifier locally in the browser using TensorFlow.js. Shared
// init/error-alert/quiz/download behaviour is covered in
// models.controller.common.spec.js - this file only covers what's different
// for image projects.
describe('ModelsController (image projects)', function () {

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
            'getModels', 'newModel', 'testModel', 'testModelPrep', 'deleteModel', 'deleteTrainingData'
        ]);
        trainingServiceMock.getModels.and.returnValue($q.resolve([]));

        quizServiceMock = jasmine.createSpyObj('quizService', ['getQuestion', 'restoreQuestion']);
        soundTrainingServiceMock = jasmine.createSpyObj('soundTrainingService', [
            'initSoundSupport', 'getModels', 'newModel', 'deleteModel', 'startTest', 'stopTest', 'reset'
        ]);
        imageTrainingServiceMock = jasmine.createSpyObj('imageTrainingService', [
            'initImageSupport', 'getModels', 'newModel', 'deleteModel', 'testCanvas', 'testBase64ImageData', 'reset'
        ]);
        imageTrainingServiceMock.initImageSupport.and.returnValue($q.resolve(false));
        imageTrainingServiceMock.getModels.and.returnValue($q.resolve([]));
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
        utilServiceMock.loadImageProjectSupport.and.returnValue($q.resolve());
        utilServiceMock.isGoogleFilesUrl.and.returnValue(false);
        storageServiceMock = jasmine.createSpyObj('storageService', ['getItem', 'setItem', 'removeItem']);
        downloadServiceMock = jasmine.createSpyObj('downloadService', ['downloadFile']);
        browserStorageServiceMock = jasmine.createSpyObj('browserStorageService', [
            'requestPersistentStorage', 'idIsLocal'
        ]);
        imageToolsServiceMock = jasmine.createSpyObj('imageToolsService', ['resizeImageElement', 'getDataFromFile']);
        webcamsServiceMock = jasmine.createSpyObj('webcamsService', ['getDevices']);
        webcamsServiceMock.getDevices.and.returnValue($q.resolve([]));
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

    function imagesProject(overrides) {
        return angular.extend({
            id : 'proj1', userid : 'user1', type : 'imgtfjs', storage : 'cloud', labels : [ 'cat', 'dog' ]
        }, overrides || {});
    }

    function readyController(project) {
        projectsServiceMock.getProject.and.returnValue($q.resolve(project));
        var vm = createController();
        $rootScope.$digest();
        return vm;
    }


    describe('initialisation', function () {

        it('initialises image support with the project labels', function () {
            var project = imagesProject();
            readyController(project);

            expect(imageTrainingServiceMock.initImageSupport).toHaveBeenCalledWith('proj1', [ 'cat', 'dog' ]);
            expect(utilServiceMock.loadImageProjectSupport).toHaveBeenCalled();
        });

        it('fetches the latest model status when a model was loaded', function () {
            imageTrainingServiceMock.initImageSupport.and.returnValue($q.resolve(true));
            imageTrainingServiceMock.getModels.and.returnValue($q.resolve([ { classifierid : 'proj1', status : 'Available' } ]));

            readyController(imagesProject());

            expect(imageTrainingServiceMock.getModels).toHaveBeenCalled();
            expect($scope.models).toEqual([ { classifierid : 'proj1', status : 'Available' } ]);
        });

        it('loads normally (no error) when the project has no labels yet', function () {
            // setupImagesProject() used to only return a promise when there were
            // labels; with zero labels it implicitly returned undefined, and the
            // caller immediately did .then() on that, throwing a TypeError that
            // surfaced as a generic "Unknown error" alert. Fixed so a fresh image
            // project with no labels just loads normally into the idle state,
            // same as the other project types.
            var project = imagesProject({ labels : [] });

            var vm = readyController(project);

            expect(vm.errors).toEqual([]);
            expect($scope.loading).toBe(false);
            expect($scope.status).toBe('idle');
        });

        it('sets constrainedDevice from the URL when the "simplified" query param is present', function () {
            $locationMock.search.and.returnValue({ simplified : true });
            gpuDetectionServiceMock.isConstrained.and.returnValue(false);

            readyController(imagesProject());

            expect($scope.constrainedDevice).toBe(true);
        });

        it('falls back to GPU detection for constrainedDevice when there is no URL override', function () {
            $locationMock.search.and.returnValue({});
            gpuDetectionServiceMock.isConstrained.and.returnValue(true);

            readyController(imagesProject());

            expect($scope.constrainedDevice).toBe(true);
        });

    });


    describe('creating a model', function () {

        it('creates a new model via imageTrainingService with the requested simplified flag', function () {
            var project = imagesProject();
            var vm = readyController(project);
            imageTrainingServiceMock.newModel.and.returnValue($q.resolve({ classifierid : 'proj1', status : 'Training', updated : new Date() }));

            vm.createModel({}, project, true);
            $rootScope.$digest();

            expect(imageTrainingServiceMock.newModel).toHaveBeenCalledWith('proj1', 'user1', 'class1', true);
        });

        it('requests persistent browser storage for a local image project', function () {
            var project = imagesProject({ storage : 'local' });
            var vm = readyController(project);
            imageTrainingServiceMock.newModel.and.returnValue($q.defer().promise);

            vm.createModel({}, project, false);

            expect(browserStorageServiceMock.requestPersistentStorage).toHaveBeenCalled();
        });

        it('offers to delete the offending training item when training fails because of a bad image download', function () {
            var project = imagesProject();
            var vm = readyController(project);
            imageTrainingServiceMock.newModel.and.returnValue($q.reject({
                status : 409,
                data : { code : 'MLMOD14', location : { imageid : 'img1', url : 'http://example.com/img.jpg', type : 'download' } }
            }));

            vm.createModel({}, project, false);
            $rootScope.$digest();

            expect(vm.errors.length).toBe(0);
            expect($mdDialogMock.show).toHaveBeenCalledWith(jasmine.objectContaining({
                templateUrl : 'static/components/models/downloadfail.tmpl.html'
            }));
        });

        it('sets constrainedDevice when a training failure reports a resource limit error', function () {
            var project = imagesProject();
            var vm = readyController(project);
            imageTrainingServiceMock.newModel.and.returnValue($q.reject({ status : 500, data : { error : 'boom' } }));

            vm.createModel({}, project, false);
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
        });

    });


    describe('deleting a model', function () {

        it('deletes the model via imageTrainingService using the project id', function () {
            var project = imagesProject();
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', status : 'Available' } ];
            imageTrainingServiceMock.deleteModel.and.returnValue($q.resolve());

            vm.deleteModel({}, project, { classifierid : 'proj1' });
            $rootScope.$digest();

            expect(imageTrainingServiceMock.deleteModel).toHaveBeenCalledWith('proj1');
            expect($scope.models).toEqual([]);
        });

        it('does not resume polling after a successful delete, since there is nothing left to check', function () {
            // see the equivalent test in models.controller.numbers.spec.js for
            // the full explanation - this is the same fix, applying to
            // images/sounds/regression too
            var project = imagesProject();
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', status : 'Available' } ];
            imageTrainingServiceMock.deleteModel.and.returnValue($q.resolve());

            vm.deleteModel({}, project, { classifierid : 'proj1' });
            $rootScope.$digest();

            imageTrainingServiceMock.getModels.calls.reset();
            $interval.flush(2000);
            expect(imageTrainingServiceMock.getModels).not.toHaveBeenCalled();
        });

    });


    describe('testing a model with a URL', function () {

        var project;

        beforeEach(function () {
            project = imagesProject();
        });

        it('rejects a data: URL with an error, and does not submit it', function () {
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', credentialsid : 'creds1', status : 'Available' } ];
            $scope.testformData.testimageurl = 'data:image/png;base64,abc123';

            vm.testModel({}, {}, project);

            expect(vm.errors.length).toBe(1);
            expect(trainingServiceMock.testModelPrep).not.toHaveBeenCalled();
        });

        it('rejects a blob: URL with an error, and does not submit it', function () {
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', credentialsid : 'creds1', status : 'Available' } ];
            $scope.testformData.testimageurl = 'blob:http://localhost/abc123';

            vm.testModel({}, {}, project);

            expect(vm.errors.length).toBe(1);
            expect(trainingServiceMock.testModelPrep).not.toHaveBeenCalled();
        });

        it('escapes a valid web URL before submitting it', function () {
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', credentialsid : 'creds1', status : 'Available' } ];
            $scope.testformData.testimageurl = 'http://example.com/a picture.jpg';
            trainingServiceMock.testModelPrep.and.returnValue($q.resolve(new ArrayBuffer(4)));
            imageTrainingServiceMock.testBase64ImageData.and.returnValue($q.resolve([ { class_name : 'cat', confidence : 80 } ]));

            vm.testModel({}, {}, project);
            $rootScope.$digest();
            $timeout.flush();

            expect(trainingServiceMock.testModelPrep).toHaveBeenCalledWith(
                'proj1', 'user1', 'class1', 'proj1', { type : 'imgtfjs', image : 'http://example.com/a%20picture.jpg' }
            );
            expect($scope.testoutput).toBe('cat');
        });

        it('still submits the raw string if the URL cannot be parsed/escaped', function () {
            var vm = readyController(project);
            $scope.models = [ { classifierid : 'proj1', credentialsid : 'creds1', status : 'Available' } ];
            $scope.testformData.testimageurl = 'not a valid url';
            trainingServiceMock.testModelPrep.and.returnValue($q.resolve(new ArrayBuffer(4)));
            imageTrainingServiceMock.testBase64ImageData.and.returnValue($q.resolve([]));

            vm.testModel({}, {}, project);
            $rootScope.$digest();

            expect(trainingServiceMock.testModelPrep).toHaveBeenCalledWith(
                'proj1', 'user1', 'class1', 'proj1', { type : 'imgtfjs', image : 'not a valid url' }
            );
        });

    });


    describe('testUsingCanvas', function () {

        it('resets the test form and shows the drawing dialog', function () {
            var project = imagesProject();
            var vm = readyController(project);
            $scope.testformData.testimageurl = 'http://old-url';

            vm.testUsingCanvas({});

            expect($scope.testformData.testimageurl).toBe('');
            expect($scope.testoutput).toBe('please wait...');
            expect($mdDialogMock.show).toHaveBeenCalledWith(jasmine.objectContaining({
                templateUrl : 'static/components/models/canvas.tmpl.html'
            }));
        });

        it('tests the drawn canvas image and displays the result on confirm', function () {
            var project = imagesProject();
            var vm = readyController(project);
            var resizedImage = { fake : 'canvasdata' };
            $mdDialogMock.show.and.returnValue($q.resolve(resizedImage));
            imageTrainingServiceMock.testCanvas.and.returnValue($q.resolve([ { class_name : 'dog', confidence : 55 } ]));

            vm.testUsingCanvas({});
            $rootScope.$digest();
            $timeout.flush();

            expect(imageTrainingServiceMock.testCanvas).toHaveBeenCalledWith(resizedImage);
            expect($scope.testoutput).toBe('dog');
        });

        it('clears the test output if the drawing dialog is cancelled', function () {
            var project = imagesProject();
            var vm = readyController(project);
            $scope.testoutput = 'please wait...';
            $mdDialogMock.show.and.returnValue($q.reject());

            vm.testUsingCanvas({});
            $rootScope.$digest();

            expect($scope.testoutput).toBeUndefined();
        });

    });


    describe('testUsingWebcam dialog', function () {

        var vm, dialogScope, dialogMdDialog;

        function openWebcamDialog() {
            var project = imagesProject();
            vm = readyController(project);
            $mdDialogMock.show.and.returnValue($q.defer().promise); // leave the outer dialog open - we only test its controller here
            vm.testUsingWebcam({});
            var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
            dialogScope = { $applyAsync : function (fn) { fn(); }, $broadcast : jasmine.createSpy('$broadcast') };
            dialogMdDialog = jasmine.createSpyObj('dialogMdDialog', ['hide', 'cancel']);
            dialogOptions.controller(dialogScope, dialogMdDialog);
        }

        it('shows the drawing dialog with the requested template', function () {
            openWebcamDialog();
            expect($mdDialogMock.show).toHaveBeenCalledWith(jasmine.objectContaining({
                templateUrl : 'static/components/models/webcam.tmpl.html'
            }));
        });

        it('selects the first available webcam device', function () {
            webcamsServiceMock.getDevices.and.returnValue($q.resolve([ { deviceId : 'cam1' }, { deviceId : 'cam2' } ]));

            openWebcamDialog();
            $rootScope.$digest();

            expect(dialogScope.channel.videoOptions).toEqual({ deviceId : 'cam1' });
            expect(dialogScope.multipleWebcams).toBe(true);
        });

        it('reports an error when no webcam devices are available', function () {
            webcamsServiceMock.getDevices.and.returnValue($q.resolve([]));

            openWebcamDialog();
            $rootScope.$digest();

            expect(dialogScope.webcamInitComplete).toBe(true);
            expect(dialogScope.webcamerror).toBeTruthy();
        });

        it('shows a specific message for a camera permissions error', function () {
            webcamsServiceMock.getDevices.and.returnValue($q.resolve([ { deviceId : 'cam1' } ]));
            openWebcamDialog();
            $rootScope.$digest();

            var permissionErr = new Error('nope');
            permissionErr.name = 'NotAllowedError';
            dialogScope.onWebcamError(permissionErr);

            expect(dialogScope.webcamerrordetail).toBe('Not allowed to use the web-cam');
        });

        it('falls back to the next webcam device when one fails', function () {
            webcamsServiceMock.getDevices.and.returnValue($q.resolve([ { deviceId : 'cam1' }, { deviceId : 'cam2' } ]));
            openWebcamDialog();
            $rootScope.$digest();

            dialogScope.onWebcamError(new Error('camera failed'));

            expect(dialogScope.channel.videoOptions).toEqual({ deviceId : 'cam2' });
            expect(dialogScope.webcamerror).toBe(false);
            expect(dialogScope.multipleWebcams).toBe(false);
        });

        it('switches to the next webcam and wraps around back to the first', function () {
            webcamsServiceMock.getDevices.and.returnValue($q.resolve([ { deviceId : 'cam1' }, { deviceId : 'cam2' } ]));
            openWebcamDialog();
            $rootScope.$digest();

            dialogScope.switchWebcam();
            expect(dialogScope.channel.videoOptions).toEqual({ deviceId : 'cam2' });

            dialogScope.switchWebcam();
            expect(dialogScope.channel.videoOptions).toEqual({ deviceId : 'cam1' });
        });

        it('tests the captured webcam image and displays the result on confirm', function () {
            var project = imagesProject();
            var vmLocal = readyController(project);
            var resizedImage = { fake : 'webcamdata' };
            $mdDialogMock.show.and.returnValue($q.resolve(resizedImage));
            imageTrainingServiceMock.testCanvas.and.returnValue($q.resolve([ { class_name : 'cat', confidence : 70 } ]));

            vmLocal.testUsingWebcam({});
            $rootScope.$digest();
            $timeout.flush();

            expect(imageTrainingServiceMock.testCanvas).toHaveBeenCalledWith(resizedImage);
            expect($scope.testoutput).toBe('cat');
        });

    });


    describe('testUsingFile / addImageFile', function () {

        it('tests an uploaded file and displays the result', function () {
            var project = imagesProject();
            var vm = readyController(project);
            var file = { name : 'test.jpg' };
            imageToolsServiceMock.getDataFromFile.and.returnValue($q.resolve('imagedata'));
            imageTrainingServiceMock.testBase64ImageData.and.returnValue($q.resolve([ { class_name : 'dog', confidence : 65 } ]));

            $scope.testUsingFile({ currentTarget : { files : [ file ] } });
            $rootScope.$digest();
            $timeout.flush();

            expect(imageToolsServiceMock.getDataFromFile).toHaveBeenCalledWith(file);
            expect($scope.testoutput).toBe('dog');
        });

        it('does nothing when no file was selected', function () {
            readyController(imagesProject());

            $scope.testUsingFile({ currentTarget : { files : [] } });

            expect(imageToolsServiceMock.getDataFromFile).not.toHaveBeenCalled();
        });

    });


    describe('addConfirmedTrainingData', function () {

        it('sets the test image URL from a dropped confirmed training item', function () {
            var vm = readyController(imagesProject());

            vm.addConfirmedTrainingData('http://example.com/dropped.jpg');

            expect($scope.testformData.testimageurl).toBe('http://example.com/dropped.jpg');
        });

    });


    describe('status polling', function () {

        it('polls every 2 seconds while training', function () {
            var project = imagesProject();
            var vm = readyController(project);
            imageTrainingServiceMock.newModel.and.returnValue($q.resolve({ classifierid : 'proj1', status : 'Training', updated : new Date() }));

            vm.createModel({}, project, false);
            $rootScope.$digest();

            imageTrainingServiceMock.getModels.calls.reset();
            imageTrainingServiceMock.getModels.and.returnValue($q.resolve([ { classifierid : 'proj1', status : 'Training', updated : new Date() } ]));

            $interval.flush(1999);
            $rootScope.$digest();
            expect(imageTrainingServiceMock.getModels).not.toHaveBeenCalled();

            $interval.flush(1);
            $rootScope.$digest();
            expect(imageTrainingServiceMock.getModels).toHaveBeenCalledTimes(1);
        });

    });


    describe('page cleanup ($destroy)', function () {

        it('resets the image training service and no others', function () {
            readyController(imagesProject());

            $scope.$destroy();

            expect(imageTrainingServiceMock.reset).toHaveBeenCalled();
            expect(soundTrainingServiceMock.reset).not.toHaveBeenCalled();
            expect(regressionTrainingServiceMock.reset).not.toHaveBeenCalled();
        });

    });

});
