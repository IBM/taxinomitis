describe('TrainingController - sound projects', function () {

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
            type : 'sounds',
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
        trainingServiceMock.getSoundData.and.returnValue($q.resolve());
        trainingServiceMock.uploadSound.and.returnValue($q.resolve({ id : 'server1' }));
        trainingServiceMock.deleteTrainingData.and.returnValue($q.resolve());

        modelServiceMock = jasmine.createSpyObj('modelService', ['generateProjectSummary', 'deleteModel']);
        modelServiceMock.generateProjectSummary.and.returnValue('cat or dog');

        soundTrainingServiceMock = jasmine.createSpyObj('soundTrainingService', [
            'initSoundSupport', 'getModelInfo', 'collectExample', 'reset'
        ]);
        soundTrainingServiceMock.initSoundSupport.and.returnValue($q.resolve());
        soundTrainingServiceMock.getModelInfo.and.returnValue({ modelinfo : 'fake' });

        utilServiceMock = jasmine.createSpyObj('utilService', ['loadImageProjectSupport', 'isGoogleFilesUrl']);
        csvServiceMock = jasmine.createSpyObj('csvService', ['exportFile', 'parseFile']);
        downloadServiceMock = jasmine.createSpyObj('downloadService', ['downloadFile']);
        imageToolsServiceMock = jasmine.createSpyObj('imageToolsService', ['getDataFromFile', 'getDataFromImageSource']);
        webcamsServiceMock = jasmine.createSpyObj('webcamsService', ['getDevices']);
        scrollServiceMock = jasmine.createSpyObj('scrollService', ['scrollToNewItem']);
        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error', 'warn']);
        readersServiceMock = jasmine.createSpyObj('readersService', ['createFileReader']);

        $stateParamsMock = { projectId : 'project1', userId : 'user1', review : undefined };
        $mdDialogMock = jasmine.createSpyObj('$mdDialog', ['show', 'confirm']);
        $stateMock = jasmine.createSpyObj('$state', ['go']);
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

        it('initialises sound support with the project id and labels', function () {
            createController();
            $rootScope.$digest();

            expect(soundTrainingServiceMock.initSoundSupport).toHaveBeenCalledWith('project1', [ 'cat', 'dog' ], false);
            expect($scope.soundModelInfo).toEqual({ modelinfo : 'fake' });
        });

        it('surfaces a warning returned by initSoundSupport', function () {
            // matches the real shape returned by soundTrainingService (soundtraining.service.js) - always an
            // object with a .message, e.g. the Firefox compatibility warning - never a bare string
            soundTrainingServiceMock.initSoundSupport.and.returnValue($q.resolve({ warning : { message : 'model is a bit old' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.warnings.length).toBe(1);
            expect(vm.warnings[0].message).toBe('model is a bit old');
        });

        it('does not warn when initSoundSupport succeeds with no warning', function () {
            var vm = createController();
            $rootScope.$digest();

            expect(vm.warnings.length).toBe(0);
        });

        it('sorts fetched training data into the bucket matching its label, and fetches the sound data for each item', function () {
            var item1 = { id : 'a', label : 'cat' };
            var item2 = { id : 'b', label : 'dog' };
            trainingServiceMock.getTraining.and.returnValue($q.resolve([ item1, item2 ]));

            createController();
            $rootScope.$digest();

            expect($scope.training.cat).toEqual([ item1 ]);
            expect($scope.training.dog).toEqual([ item2 ]);
            expect(trainingServiceMock.getSoundData).toHaveBeenCalledWith(item1);
            expect(trainingServiceMock.getSoundData).toHaveBeenCalledWith(item2);
        });

        it('surfaces an error alert if initSoundSupport itself fails', function () {
            soundTrainingServiceMock.initSoundSupport.and.returnValue($q.reject({ status : 500, data : { message : 'tfjs failed to load' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toBe('tfjs failed to load');
        });

    });


    describe('addConfirmedTrainingData (sounds)', function () {

        it('converts the Float32Array spectrogram data to a plain array and uploads it via uploadSound (not newTrainingData)', function () {
            var vm = createController();
            $rootScope.$digest();

            // Float32Array values are only approximations of the literals used to
            // create them (e.g. 0.1 -> 0.10000000149011612), so compare against
            // Array.from() of the same typed array rather than fresh literals
            var spectrogram = new Float32Array([ 0.1, 0.2, 0.3 ]);
            var expectedData = Array.from(spectrogram);
            vm.addConfirmedTrainingData(spectrogram, 'cat');

            expect($scope.training.cat[0].audiodata).toEqual(expectedData);
            expect(trainingServiceMock.uploadSound).toHaveBeenCalledWith(
                'project1', 'user1', 'class1', 'sounds', 'cloud', expectedData, 'cat');
            expect(trainingServiceMock.newTrainingData).not.toHaveBeenCalled();
        });

        it('does not dedupe sound examples - two identical recordings are both added', function () {
            var vm = createController();
            $rootScope.$digest();

            var spectrogram = new Float32Array([ 0.1, 0.2 ]);
            vm.addConfirmedTrainingData(spectrogram, 'cat');
            vm.addConfirmedTrainingData(spectrogram, 'cat');

            expect($scope.training.cat.length).toBe(2);
            expect(vm.errors.length).toBe(0);
        });

        it('replaces the placeholder with the server id once uploaded', function () {
            var vm = createController();
            $rootScope.$digest();

            var deferred = $q.defer();
            trainingServiceMock.uploadSound.and.returnValue(deferred.promise);

            vm.addConfirmedTrainingData(new Float32Array([ 0.1 ]), 'cat');
            expect($scope.training.cat[0].isPlaceholder).toBe(true);

            deferred.resolve({ id : 'server-42' });
            $rootScope.$digest();

            expect($scope.training.cat[0].isPlaceholder).toBe(false);
            expect($scope.training.cat[0].id).toBe('server-42');
        });

        it('shows an alert and removes the placeholder if the upload fails', function () {
            var vm = createController();
            $rootScope.$digest();

            trainingServiceMock.uploadSound.and.returnValue($q.reject({ status : 400, data : { message : 'upload failed' } }));
            vm.addConfirmedTrainingData(new Float32Array([ 0.1 ]), 'cat');
            $rootScope.$digest();

            expect($scope.training.cat.length).toBe(0);
            expect(vm.errors.length).toBe(1);
        });

        // recordSound() (below) already guards against empty audio data for
        // the normal "record in the dialog" flow, but addConfirmedTrainingData
        // is a public vm method, so it needs its own guard too
        it('rejects empty audio data, even when called directly (bypassing recordSound\'s own guard)', function () {
            var vm = createController();
            $rootScope.$digest();

            vm.addConfirmedTrainingData(new Float32Array([]), 'cat');

            expect($scope.training.cat.length).toBe(0);
            expect(trainingServiceMock.uploadSound).not.toHaveBeenCalled();
        });

    });


    describe('useMicrophone', function () {

        function openMicrophoneDialog(vm, label) {
            label = label || 'cat';
            $mdDialogMock.show.and.returnValue($q.defer().promise); // never resolves - we only care about the nested controller here
            vm.useMicrophone({}, label);
            var options = $mdDialogMock.show.calls.mostRecent().args[0];
            var dialogScope = $rootScope.$new();
            options.controller(dialogScope, {
                label : label,
                project : $scope.project,
                soundModelInfo : soundTrainingServiceMock.getModelInfo()
            });
            return dialogScope;
        }

        it('adds the confirmed recording as a new training example', function () {
            var vm = createController();
            $rootScope.$digest();
            spyOn(vm, 'addConfirmedTrainingData');

            var spectrogramData = [ 0.1, 0.2 ];
            $mdDialogMock.show.and.returnValue($q.resolve(spectrogramData));
            vm.useMicrophone({}, 'cat');
            $rootScope.$digest();

            expect(vm.addConfirmedTrainingData).toHaveBeenCalledWith(spectrogramData, 'cat');
        });

        it('does nothing when the dialog is cancelled', function () {
            var vm = createController();
            $rootScope.$digest();
            spyOn(vm, 'addConfirmedTrainingData');

            $mdDialogMock.show.and.returnValue($q.reject());
            vm.useMicrophone({}, 'cat');
            $rootScope.$digest();

            expect(vm.addConfirmedTrainingData).not.toHaveBeenCalled();
        });

        describe('recordSound (nested dialog controller)', function () {

            it('increases recordingprogress by 10 every 100ms while recording', function () {
                var vm = createController();
                $rootScope.$digest();
                var dialogScope = openMicrophoneDialog(vm);

                soundTrainingServiceMock.collectExample.and.returnValue($q.defer().promise);
                dialogScope.recordSound('cat');

                expect(dialogScope.recording).toBe(true);
                expect(dialogScope.recordingprogress).toBe(0);

                $interval.flush(100);
                expect(dialogScope.recordingprogress).toBe(10);

                $interval.flush(200);
                expect(dialogScope.recordingprogress).toBe(30);
            });

            it('on success, stores the spectrogram as the example and stops recording', function () {
                var vm = createController();
                $rootScope.$digest();
                var dialogScope = openMicrophoneDialog(vm);

                var deferred = $q.defer();
                soundTrainingServiceMock.collectExample.and.returnValue(deferred.promise);
                dialogScope.recordSound('cat');

                deferred.resolve({ data : [ 0.5, 0.6, 0.7 ] });
                $rootScope.$digest();
                $rootScope.$digest();

                expect(dialogScope.example).toEqual([ 0.5, 0.6, 0.7 ]);
                expect(dialogScope.recording).toBe(false);
                expect(dialogScope.recordingprogress).toBe(100);
            });

            it('does not set an example when the spectrogram data is empty', function () {
                var vm = createController();
                $rootScope.$digest();
                var dialogScope = openMicrophoneDialog(vm);

                var deferred = $q.defer();
                soundTrainingServiceMock.collectExample.and.returnValue(deferred.promise);
                dialogScope.recordSound('cat');

                deferred.resolve({ data : [] });
                $rootScope.$digest();
                $rootScope.$digest();

                expect(dialogScope.example).toBeUndefined();
                expect(dialogScope.recording).toBe(false);
            });

            it('on failure, stops recording and shows an alert', function () {
                var vm = createController();
                $rootScope.$digest();
                var dialogScope = openMicrophoneDialog(vm);

                var deferred = $q.defer();
                soundTrainingServiceMock.collectExample.and.returnValue(deferred.promise);
                dialogScope.recordSound('cat');

                deferred.reject({ message : 'microphone access denied' });
                $rootScope.$digest();
                $rootScope.$digest();

                expect(dialogScope.recording).toBe(false);
                expect(vm.errors.length).toBe(1);
            });

            it('stops the progress interval once recording finishes', function () {
                var vm = createController();
                $rootScope.$digest();
                var dialogScope = openMicrophoneDialog(vm);

                var deferred = $q.defer();
                soundTrainingServiceMock.collectExample.and.returnValue(deferred.promise);
                dialogScope.recordSound('cat');

                $interval.flush(300);
                expect(dialogScope.recordingprogress).toBe(30);

                deferred.resolve({ data : [ 0.1 ] });
                $rootScope.$digest();
                $rootScope.$digest();
                expect(dialogScope.recordingprogress).toBe(100);

                // if the interval had really been cancelled, more time passing
                // would not change recordingprogress any further
                $interval.flush(300);
                expect(dialogScope.recordingprogress).toBe(100);
            });

        });

    });

});
