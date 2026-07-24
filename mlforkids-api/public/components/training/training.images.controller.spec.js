describe('TrainingController - image projects', function () {

    var $controller;
    var $q;
    var $rootScope;
    var $scope;
    var $timeout;
    var $interval;

    var authServiceMock, projectsServiceMock, trainingServiceMock, modelServiceMock,
        soundTrainingServiceMock, utilServiceMock, csvServiceMock, downloadServiceMock,
        imageToolsServiceMock, webcamsServiceMock, scrollServiceMock, loggerServiceMock,
        readersServiceMock;
    var $stateParamsMock, $mdDialogMock, $stateMock;

    var profile = { user_id : 'user1', tenant : 'class1' };
    var project;

    var originalSentry;
    beforeEach(function () {
        originalSentry = window.Sentry;
        window.Sentry = { captureException : jasmine.createSpy('captureException') };
    });
    afterEach(function () {
        window.Sentry = originalSentry;
    });

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_, _$timeout_, _$interval_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
        $scope = $rootScope.$new();
        $timeout = _$timeout_;
        $interval = _$interval_;
    }));

    beforeEach(function () {
        project = {
            id : 'project1',
            type : 'imgtfjs',
            storage : 'cloud',
            userid : 'user1',
            isCrowdSourced : false,
            labels : [ 'cat', 'dog' ]
        };

        authServiceMock = {
            getProfileDeferred : jasmine.createSpy('getProfileDeferred').and.returnValue($q.resolve(profile))
        };

        projectsServiceMock = jasmine.createSpyObj('projectsService', [
            'getProject', 'getFields', 'addLabelToProject', 'removeLabelFromProject', 'addMetadataToProject'
        ]);
        projectsServiceMock.getProject.and.returnValue($q.resolve(project));

        trainingServiceMock = jasmine.createSpyObj('trainingService', [
            'getTraining', 'getSoundData', 'newTrainingData', 'uploadSound', 'uploadImage',
            'deleteTrainingData', 'clearTrainingData', 'bulkAddTrainingData'
        ]);
        trainingServiceMock.getTraining.and.returnValue($q.resolve([]));
        trainingServiceMock.newTrainingData.and.returnValue($q.resolve({ id : 'server1' }));
        trainingServiceMock.uploadImage.and.returnValue($q.resolve({ id : 'server1' }));
        trainingServiceMock.deleteTrainingData.and.returnValue($q.resolve());

        modelServiceMock = jasmine.createSpyObj('modelService', ['generateProjectSummary', 'deleteModel']);
        modelServiceMock.generateProjectSummary.and.returnValue('cat or dog');

        soundTrainingServiceMock = jasmine.createSpyObj('soundTrainingService', [
            'initSoundSupport', 'getModelInfo', 'collectExample', 'reset'
        ]);
        utilServiceMock = jasmine.createSpyObj('utilService', ['loadImageProjectSupport', 'isGoogleFilesUrl']);
        utilServiceMock.loadImageProjectSupport.and.returnValue($q.resolve());
        utilServiceMock.isGoogleFilesUrl.and.returnValue(false);
        csvServiceMock = jasmine.createSpyObj('csvService', ['exportFile', 'parseFile']);
        downloadServiceMock = jasmine.createSpyObj('downloadService', ['downloadFile']);
        imageToolsServiceMock = jasmine.createSpyObj('imageToolsService', ['getDataFromFile', 'getDataFromImageSource']);
        webcamsServiceMock = jasmine.createSpyObj('webcamsService', ['getDevices']);
        webcamsServiceMock.getDevices.and.returnValue($q.resolve([]));
        scrollServiceMock = jasmine.createSpyObj('scrollService', ['scrollToNewItem']);
        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error', 'warn']);
        readersServiceMock = jasmine.createSpyObj('readersService', ['createFileReader']);

        $stateParamsMock = { projectId : 'project1', userId : 'user1', review : undefined };
        $mdDialogMock = jasmine.createSpyObj('$mdDialog', ['show', 'confirm']);
        $stateMock = jasmine.createSpyObj('$state', ['go']);

        spyOn(window.URL, 'createObjectURL').and.returnValue('blob:fake-object-url');
        spyOn(window.URL, 'revokeObjectURL');
    });

    function createController() {
        return $controller('TrainingController', {
            authService : authServiceMock,
            projectsService : projectsServiceMock,
            trainingService : trainingServiceMock,
            modelService : modelServiceMock,
            soundTrainingService : soundTrainingServiceMock,
            utilService : utilServiceMock,
            csvService : csvServiceMock,
            downloadService : downloadServiceMock,
            imageToolsService : imageToolsServiceMock,
            webcamsService : webcamsServiceMock,
            scrollService : scrollServiceMock,
            loggerService : loggerServiceMock,
            readersService : readersServiceMock,
            $stateParams : $stateParamsMock,
            $scope : $scope,
            $mdDialog : $mdDialogMock,
            $state : $stateMock,
            $timeout : $timeout,
            $interval : $interval
        });
    }


    describe('initial load', function () {

        it('loads the image project support libraries', function () {
            createController();
            $rootScope.$digest();

            expect(utilServiceMock.loadImageProjectSupport).toHaveBeenCalled();
        });

        it('sorts fetched training data into the bucket matching its label', function () {
            trainingServiceMock.getTraining.and.returnValue($q.resolve([
                { id : 'a', label : 'cat', imageurl : 'https://example.com/cat.jpg' },
                { id : 'b', label : 'dog', imageurl : 'https://example.com/dog.jpg' }
            ]));

            createController();
            $rootScope.$digest();

            expect($scope.training.cat.map(i => i.imageurl)).toEqual([ 'https://example.com/cat.jpg' ]);
            expect($scope.training.dog.map(i => i.imageurl)).toEqual([ 'https://example.com/dog.jpg' ]);
        });

    });


    describe('addTrainingData / addConfirmedTrainingData (typed-in URL)', function () {

        it('normalizes the URL before storing it', function () {
            var vm = createController();
            $rootScope.$digest();

            $mdDialogMock.show.and.returnValue($q.resolve('https://example.com/a b.jpg'));
            vm.addTrainingData({}, 'cat');
            $rootScope.$digest();

            expect($scope.training.cat[0].imageurl).toBe('https://example.com/a%20b.jpg');
        });

        it('falls back to the raw string when the URL cannot be parsed', function () {
            var vm = createController();
            $rootScope.$digest();

            $mdDialogMock.show.and.returnValue($q.resolve('not-a-valid-url'));
            vm.addTrainingData({}, 'cat');
            $rootScope.$digest();

            expect($scope.training.cat[0].imageurl).toBe('not-a-valid-url');
        });

        it('rejects a duplicate image URL without calling the training service', function () {
            var vm = createController();
            $rootScope.$digest();
            vm.addConfirmedTrainingData('https://example.com/cat.jpg', 'cat');
            $rootScope.$digest();
            trainingServiceMock.newTrainingData.calls.reset();

            vm.addConfirmedTrainingData('https://example.com/cat.jpg', 'cat');

            expect($scope.training.cat.length).toBe(1);
            expect(trainingServiceMock.newTrainingData).not.toHaveBeenCalled();
            expect(vm.errors[0].message).toBe('That is already in your training data');
        });

        it('warns that Google-hosted images often stop working, after a successful add', function () {
            utilServiceMock.isGoogleFilesUrl.and.returnValue(true);
            var vm = createController();
            $rootScope.$digest();

            vm.addConfirmedTrainingData('https://lh3.google.com/photo.jpg', 'cat');
            $rootScope.$digest();

            expect(vm.warnings.length).toBe(1);
            expect(vm.warnings[0].message).toContain('Google often removes access');
        });

        it('does not warn about images hosted somewhere other than Google', function () {
            utilServiceMock.isGoogleFilesUrl.and.returnValue(false);
            var vm = createController();
            $rootScope.$digest();

            vm.addConfirmedTrainingData('https://example.com/cat.jpg', 'cat');
            $rootScope.$digest();

            expect(vm.warnings.length).toBe(0);
        });

        it('shows an alert and removes the placeholder if storage fails', function () {
            var vm = createController();
            $rootScope.$digest();

            trainingServiceMock.newTrainingData.and.returnValue($q.reject({ status : 400, data : { message : 'bad image' } }));
            vm.addConfirmedTrainingData('https://example.com/cat.jpg', 'cat');
            $rootScope.$digest();

            expect($scope.training.cat.length).toBe(0);
            expect(vm.errors.length).toBe(1);
        });

        it('redirects to the projects list instead of showing an alert when the project has been deleted', function () {
            var vm = createController();
            $rootScope.$digest();

            trainingServiceMock.newTrainingData.and.returnValue($q.reject({ status : 404, data : { error : 'Not found' } }));
            vm.addConfirmedTrainingData('https://example.com/cat.jpg', 'cat');
            $rootScope.$digest();

            expect($stateMock.go).toHaveBeenCalledWith('projects');
        });

        it('rejects an empty/blank image URL, even when called directly (bypassing the dialog form validation)', function () {
            var vm = createController();
            $rootScope.$digest();

            vm.addConfirmedTrainingData('', 'cat');

            expect($scope.training.cat.length).toBe(0);
            expect(trainingServiceMock.newTrainingData).not.toHaveBeenCalled();
        });

    });


    describe('addImageFile / addImageData (file upload, webcam, drawing)', function () {

        it('uploads the file and swaps the placeholder for the server id', function () {
            var vm = createController();
            $rootScope.$digest();

            var fakeFile = {};
            imageToolsServiceMock.getDataFromFile.and.returnValue($q.resolve('imagedata-blob'));
            trainingServiceMock.uploadImage.and.returnValue($q.resolve({ id : 'server-1' }));

            vm.addImageFile(fakeFile, 'cat', true);
            $rootScope.$digest();

            expect($scope.training.cat[0].isPlaceholder).toBe(false);
            expect($scope.training.cat[0].id).toBe('server-1');
            expect(trainingServiceMock.uploadImage).toHaveBeenCalledWith(
                $scope.project, 'user1', 'class1', 'imagedata-blob', 'cat');
            expect(scrollServiceMock.scrollToNewItem).toHaveBeenCalledWith('server-1', jasmine.any(Object));
        });

        it('does not scroll to the new item when scrollto is false', function () {
            var vm = createController();
            $rootScope.$digest();

            imageToolsServiceMock.getDataFromFile.and.returnValue($q.resolve('imagedata-blob'));

            vm.addImageFile({}, 'cat', false);
            $rootScope.$digest();

            expect(scrollServiceMock.scrollToNewItem).not.toHaveBeenCalled();
        });

        it('shows an alert if the file cannot be read', function () {
            var vm = createController();
            $rootScope.$digest();

            imageToolsServiceMock.getDataFromFile.and.returnValue($q.reject({ message : 'unreadable file' }));

            vm.addImageFile({}, 'cat', true);
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
        });

        it('does NOT reject a file upload that duplicates one already in the bucket (confirmed: no dedup for file uploads)', function () {
            var vm = createController();
            $rootScope.$digest();

            imageToolsServiceMock.getDataFromFile.and.returnValue($q.resolve('same-image-data'));

            vm.addImageFile({}, 'cat', false);
            $rootScope.$digest();
            vm.addImageFile({}, 'cat', false);
            $rootScope.$digest();

            expect($scope.training.cat.length).toBe(2);
            expect(vm.errors.length).toBe(0);
        });

        it('revokes the placeholder object URL 10 seconds after a successful upload', function () {
            var vm = createController();
            $rootScope.$digest();

            imageToolsServiceMock.getDataFromFile.and.returnValue($q.resolve('imagedata-blob'));
            vm.addImageFile({}, 'cat', false);
            $rootScope.$digest();

            expect(window.URL.revokeObjectURL).not.toHaveBeenCalled();
            $timeout.flush(10000);
            expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-object-url');
        });

        it('shows an alert and removes the placeholder if the upload fails', function () {
            var vm = createController();
            $rootScope.$digest();

            imageToolsServiceMock.getDataFromFile.and.returnValue($q.resolve('imagedata-blob'));
            trainingServiceMock.uploadImage.and.returnValue($q.reject({ status : 400, data : { message : 'upload failed' } }));

            vm.addImageFile({}, 'cat', false);
            $rootScope.$digest();

            expect($scope.training.cat.length).toBe(0);
            expect(vm.errors.length).toBe(1);
        });

    });


    describe('uploadTrainingData (bulk file picker / drag-and-drop multiple files)', function () {

        it('adds every selected file, only marking the last one to scroll to', function () {
            var vm = createController();
            $rootScope.$digest();
            spyOn(vm, 'addImageFile');

            var file1 = {}, file2 = {}, file3 = {};
            var ev = { currentTarget : { files : [ file1, file2, file3 ] } };
            var elem = { dataset : { label : 'cat' } };

            $scope.uploadTrainingData(ev, elem);

            expect(vm.addImageFile).toHaveBeenCalledTimes(3);
            expect(vm.addImageFile).toHaveBeenCalledWith(file1, 'cat', false);
            expect(vm.addImageFile).toHaveBeenCalledWith(file2, 'cat', false);
            expect(vm.addImageFile).toHaveBeenCalledWith(file3, 'cat', true);
        });

    });


    describe('downloadTrainingData', function () {

        it('does nothing for image projects (only text/numbers/regression support download)', function () {
            var vm = createController();
            $rootScope.$digest();

            $scope.downloadTrainingData({}, 'cat');

            expect(downloadServiceMock.downloadFile).not.toHaveBeenCalled();
        });

    });


    describe('useCanvas', function () {

        it('captures a drawing and adds it as a new image, scrolling to it', function () {
            var vm = createController();
            $rootScope.$digest();
            spyOn(vm, 'addImageData');

            $mdDialogMock.show.and.returnValue($q.resolve('drawing-blob'));
            vm.useCanvas({}, 'cat');
            $rootScope.$digest();

            expect(vm.addImageData).toHaveBeenCalledWith('drawing-blob', 'cat', true);
        });

        it('does nothing when cancelled', function () {
            var vm = createController();
            $rootScope.$digest();
            spyOn(vm, 'addImageData');

            $mdDialogMock.show.and.returnValue($q.reject());
            vm.useCanvas({}, 'cat');
            $rootScope.$digest();

            expect(vm.addImageData).not.toHaveBeenCalled();
        });

    });


    describe('useWebcam', function () {

        function openWebcamDialog(vm, dialogLabel) {
            dialogLabel = dialogLabel || 'cat';
            $mdDialogMock.show.and.returnValue($q.defer().promise); // never resolves - we only care about the nested controller here
            vm.useWebcam({}, dialogLabel);
            var options = $mdDialogMock.show.calls.mostRecent().args[0];
            var dialogScope = $rootScope.$new();
            options.controller(dialogScope, { label : dialogLabel, project : $scope.project });
            return dialogScope;
        }

        it('adds the captured frame as a new image when confirmed', function () {
            var vm = createController();
            $rootScope.$digest();
            spyOn(vm, 'addImageData');

            $mdDialogMock.show.and.returnValue($q.resolve('webcam-frame-blob'));
            vm.useWebcam({}, 'cat');
            $rootScope.$digest();

            expect(vm.addImageData).toHaveBeenCalledWith('webcam-frame-blob', 'cat', true);
        });

        it('selects the first available webcam and flags multipleWebcams when more than one device is found', function () {
            var vm = createController();
            $rootScope.$digest();

            webcamsServiceMock.getDevices.and.returnValue($q.resolve([ 'device-a', 'device-b' ]));
            var dialogScope = openWebcamDialog(vm);
            $rootScope.$digest();

            expect(dialogScope.channel.videoOptions).toBe('device-a');
            expect(dialogScope.multipleWebcams).toBe(true);
        });

        it('does not flag multipleWebcams when there is only one device', function () {
            var vm = createController();
            $rootScope.$digest();

            webcamsServiceMock.getDevices.and.returnValue($q.resolve([ 'only-device' ]));
            var dialogScope = openWebcamDialog(vm);
            $rootScope.$digest();

            expect(dialogScope.multipleWebcams).toBe(false);
        });

        it('reports an error immediately when there are no webcams at all', function () {
            var vm = createController();
            $rootScope.$digest();

            webcamsServiceMock.getDevices.and.returnValue($q.resolve([]));
            var dialogScope = openWebcamDialog(vm);
            $rootScope.$digest();
            $rootScope.$digest(); // flush the $applyAsync inside onWebcamError

            expect(dialogScope.webcamInitComplete).toBe(true);
            expect(dialogScope.webcamerrordetail).toBe('No webcams available');
        });

        it('falls back to the next webcam when the current one errors, and does not give up', function () {
            var vm = createController();
            $rootScope.$digest();

            webcamsServiceMock.getDevices.and.returnValue($q.resolve([ 'device-a', 'device-b' ]));
            var dialogScope = openWebcamDialog(vm);
            $rootScope.$digest();
            spyOn(dialogScope, '$broadcast');

            dialogScope.onWebcamError(new Error('device-a failed'));
            $rootScope.$digest();
            $rootScope.$digest();

            expect(dialogScope.channel.videoOptions).toBe('device-b');
            expect(dialogScope.multipleWebcams).toBe(false); // only 1 left
            expect(dialogScope.webcamerror).toBeFalsy(); // we haven't given up - no error shown
            expect(dialogScope.$broadcast).toHaveBeenCalledWith('STOP_WEBCAM');
            expect(dialogScope.$broadcast).toHaveBeenCalledWith('START_WEBCAM');
        });

        it('shows an error once every webcam has failed', function () {
            var vm = createController();
            $rootScope.$digest();

            webcamsServiceMock.getDevices.and.returnValue($q.resolve([ 'only-device' ]));
            var dialogScope = openWebcamDialog(vm);
            $rootScope.$digest();

            dialogScope.onWebcamError(new Error('only-device failed'));
            $rootScope.$digest();
            $rootScope.$digest();

            expect(dialogScope.webcamInitComplete).toBe(true);
            expect(dialogScope.webcamerrordetail).toBe('only-device failed');
        });

        it('shows a specific message for a NotAllowedError (permission denied) without logging it as unexpected', function () {
            var vm = createController();
            $rootScope.$digest();

            webcamsServiceMock.getDevices.and.returnValue($q.resolve([ 'only-device' ]));
            var dialogScope = openWebcamDialog(vm);
            $rootScope.$digest();

            var permissionErr = new Error('denied');
            permissionErr.name = 'NotAllowedError';
            dialogScope.onWebcamError(permissionErr);
            $rootScope.$digest();
            $rootScope.$digest();

            expect(dialogScope.webcamerrordetail).toBe('Not allowed to use the web-cam');
            expect(loggerServiceMock.error).not.toHaveBeenCalled();
        });

        it('logs unexpected (non-permission) webcam errors', function () {
            var vm = createController();
            $rootScope.$digest();

            webcamsServiceMock.getDevices.and.returnValue($q.resolve([ 'only-device' ]));
            var dialogScope = openWebcamDialog(vm);
            $rootScope.$digest();

            dialogScope.onWebcamError(new Error('something unexpected'));
            $rootScope.$digest();
            $rootScope.$digest();

            expect(loggerServiceMock.error).toHaveBeenCalled();
        });

        it('switchWebcam cycles forward through the available devices and wraps back to the first', function () {
            var vm = createController();
            $rootScope.$digest();

            webcamsServiceMock.getDevices.and.returnValue($q.resolve([ 'device-a', 'device-b' ]));
            var dialogScope = openWebcamDialog(vm);
            $rootScope.$digest();

            expect(dialogScope.channel.videoOptions).toBe('device-a');

            dialogScope.switchWebcam();
            $rootScope.$digest();
            expect(dialogScope.channel.videoOptions).toBe('device-b');

            dialogScope.switchWebcam();
            $rootScope.$digest();
            expect(dialogScope.channel.videoOptions).toBe('device-a');
        });

        // currentWebcamIdx deliberately persists across dialog opens (so the
        // last-used camera is remembered within a page session), but must be
        // clamped if the device list is shorter next time round.
        it('safely falls back to a valid webcam if the device list shrinks between dialog opens', function () {
            var vm = createController();
            $rootScope.$digest();

            // first open: 3 devices, switch twice so currentWebcamIdx lands on index 2
            webcamsServiceMock.getDevices.and.returnValue($q.resolve([ 'device-a', 'device-b', 'device-c' ]));
            var firstDialogScope = openWebcamDialog(vm);
            $rootScope.$digest();
            firstDialogScope.switchWebcam();
            $rootScope.$digest();
            firstDialogScope.switchWebcam();
            $rootScope.$digest();
            expect(firstDialogScope.channel.videoOptions).toBe('device-c');

            // dialog is closed and reopened, but the device list has since
            // shrunk to a single device - currentWebcamIdx is still 2
            webcamsServiceMock.getDevices.and.returnValue($q.resolve([ 'only-device' ]));
            var secondDialogScope = openWebcamDialog(vm);
            $rootScope.$digest();

            expect(secondDialogScope.channel.videoOptions).toBe('only-device');
        });

    });

});
