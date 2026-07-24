describe('TrainingController - text projects', function () {

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

    // production loads Sentry via a <script> tag (see public/index.html) - it's
    // a bare global, so any test that triggers a status-500 alert needs it stubbed
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
            type : 'text',
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
        trainingServiceMock.deleteTrainingData.and.returnValue($q.resolve());
        trainingServiceMock.bulkAddTrainingData.and.returnValue($q.resolve([]));

        modelServiceMock = jasmine.createSpyObj('modelService', ['generateProjectSummary', 'deleteModel']);
        modelServiceMock.generateProjectSummary.and.returnValue('cat or dog');

        soundTrainingServiceMock = jasmine.createSpyObj('soundTrainingService', [
            'initSoundSupport', 'getModelInfo', 'collectExample', 'reset'
        ]);
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

        it('does not fetch fields, sound support, or image support for a text project', function () {
            createController();
            $rootScope.$digest();

            expect(projectsServiceMock.getFields).not.toHaveBeenCalled();
            expect(soundTrainingServiceMock.initSoundSupport).not.toHaveBeenCalled();
            expect(utilServiceMock.loadImageProjectSupport).not.toHaveBeenCalled();
        });

        it('creates an empty bucket for every project label', function () {
            createController();
            $rootScope.$digest();

            expect($scope.training.cat).toEqual([]);
            expect($scope.training.dog).toEqual([]);
        });

        it('sorts fetched training data into the bucket matching its label', function () {
            trainingServiceMock.getTraining.and.returnValue($q.resolve([
                { id : 'a', label : 'cat', textdata : 'meow' },
                { id : 'b', label : 'dog', textdata : 'woof' },
                { id : 'c', label : 'cat', textdata : 'purr' }
            ]));

            createController();
            $rootScope.$digest();

            expect($scope.training.cat.map(i => i.textdata)).toEqual([ 'meow', 'purr' ]);
            expect($scope.training.dog.map(i => i.textdata)).toEqual([ 'woof' ]);
            expect($scope.loadingtraining).toBe(false);
        });

        it('creates a new bucket on the fly for training data with a label the project does not know about', function () {
            trainingServiceMock.getTraining.and.returnValue($q.resolve([
                { id : 'x', label : 'bird', textdata : 'tweet' }
            ]));

            createController();
            $rootScope.$digest();

            expect($scope.training.bird.map(i => i.textdata)).toEqual([ 'tweet' ]);
        });

        it('sets the labels summary from modelService', function () {
            createController();
            $rootScope.$digest();

            expect(modelServiceMock.generateProjectSummary).toHaveBeenCalledWith([ 'cat', 'dog' ], ' or ');
            expect($scope.project.labelsSummary).toBe('cat or dog');
        });

        it('marks the project as crowd-sourced only when it is shared and not owned by the current user', function () {
            project.isCrowdSourced = true;
            project.userid = 'someone-else';

            createController();
            $rootScope.$digest();

            expect($scope.crowdSourced).toBe(true);
        });

        it('does not mark an owned project as crowd-sourced, even if isCrowdSourced is set', function () {
            project.isCrowdSourced = true;
            project.userid = 'user1'; // matches profile.user_id

            createController();
            $rootScope.$digest();

            expect($scope.crowdSourced).toBe(false);
        });

        it('surfaces an error alert if fetching the project fails', function () {
            projectsServiceMock.getProject.and.returnValue($q.reject({ status : 404, data : { error : 'Not found' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].status).toBe(404);
        });

    });


    describe('addTrainingData / addConfirmedTrainingData', function () {

        it('replaces each carriage return, newline and tab with a space before storing it', function () {
            var vm = createController();
            $rootScope.$digest();

            // \r\n is two separate matches of the [\r\n\t] pattern, so it becomes two spaces
            $mdDialogMock.show.and.returnValue($q.resolve('line one\r\nline\ttwo'));
            vm.addTrainingData({}, 'cat');
            $rootScope.$digest();

            expect($scope.training.cat[0].textdata).toBe('line one  line two');
            expect(trainingServiceMock.newTrainingData).toHaveBeenCalledWith(
                'project1', 'user1', 'class1', 'text', 'cloud', 'line one  line two', 'cat');
        });

        it('does nothing when the dialog is cancelled', function () {
            var vm = createController();
            $rootScope.$digest();

            $mdDialogMock.show.and.returnValue($q.reject());
            vm.addTrainingData({}, 'cat');
            $rootScope.$digest();

            expect($scope.training.cat.length).toBe(0);
            expect(trainingServiceMock.newTrainingData).not.toHaveBeenCalled();
        });

        it('adds a placeholder immediately, then replaces it with the server id once storage succeeds', function () {
            var vm = createController();
            $rootScope.$digest();

            var deferred = $q.defer();
            trainingServiceMock.newTrainingData.and.returnValue(deferred.promise);

            vm.addConfirmedTrainingData('hello', 'cat');

            expect($scope.training.cat.length).toBe(1);
            expect($scope.training.cat[0].isPlaceholder).toBe(true);
            expect($scope.training.cat[0].id).toMatch(/^placeholder_/);

            deferred.resolve({ id : 'server-99' });
            $rootScope.$digest();

            expect($scope.training.cat[0].isPlaceholder).toBe(false);
            expect($scope.training.cat[0].id).toBe('server-99');
            expect(scrollServiceMock.scrollToNewItem).toHaveBeenCalledWith('server-99', jasmine.objectContaining({ useParentScroll : true }));
        });

        it('rejects a duplicate example (case-insensitive) without calling the training service', function () {
            var vm = createController();
            $rootScope.$digest();
            vm.addConfirmedTrainingData('Hello There', 'cat');
            $rootScope.$digest();
            trainingServiceMock.newTrainingData.calls.reset();

            vm.addConfirmedTrainingData('hello there', 'cat');

            expect($scope.training.cat.length).toBe(1);
            expect(trainingServiceMock.newTrainingData).not.toHaveBeenCalled();
            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toBe('That is already in your training data');
        });

        it('rejects an example for a label the project does not have', function () {
            var vm = createController();
            $rootScope.$digest();

            vm.addConfirmedTrainingData('hello', 'not-a-real-label');

            expect(trainingServiceMock.newTrainingData).not.toHaveBeenCalled();
            expect(vm.errors[0].message).toBe('Project does not appear to have the label not-a-real-label');
        });

        it('shows an alert and removes the placeholder when storage fails for a reason other than project deletion', function () {
            var vm = createController();
            $rootScope.$digest();

            trainingServiceMock.newTrainingData.and.returnValue($q.reject({ status : 400, data : { message : 'nope' } }));
            vm.addConfirmedTrainingData('hello', 'cat');
            $rootScope.$digest();

            expect($scope.training.cat.length).toBe(0);
            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].status).toBe(400);
        });

        it('redirects to the projects list instead of showing an alert when storage fails because the project was deleted', function () {
            var vm = createController();
            $rootScope.$digest();

            trainingServiceMock.newTrainingData.and.returnValue($q.reject({ status : 404, data : { error : 'Not found' } }));
            vm.addConfirmedTrainingData('hello', 'cat');
            $rootScope.$digest();

            expect($stateMock.go).toHaveBeenCalledWith('projects');
            expect(vm.errors.length).toBe(0);
        });

        it('rejects an empty/blank example, even when called directly (bypassing the dialog form validation)', function () {
            var vm = createController();
            $rootScope.$digest();

            vm.addConfirmedTrainingData('', 'cat');

            expect($scope.training.cat.length).toBe(0);
            expect(trainingServiceMock.newTrainingData).not.toHaveBeenCalled();
        });

    });


    describe('deleteText', function () {

        it('removes the item immediately and calls the training service', function () {
            var vm = createController();
            $rootScope.$digest();
            $scope.training.cat = [ { id : 'item1', textdata : 'meow' } ];

            vm.deleteText('cat', { id : 'item1' }, 0);

            expect($scope.training.cat.length).toBe(0);
            expect(trainingServiceMock.deleteTrainingData).toHaveBeenCalledWith('project1', 'user1', 'class1', 'item1');
        });

        it('leaves the item removed and shows an alert if the server delete fails (no rollback)', function () {
            var vm = createController();
            $rootScope.$digest();
            $scope.training.cat = [ { id : 'item1', textdata : 'meow' } ];
            trainingServiceMock.deleteTrainingData.and.returnValue($q.reject({ status : 500, data : { message : 'server error' } }));

            vm.deleteText('cat', { id : 'item1' }, 0);
            $rootScope.$digest();

            expect($scope.training.cat.length).toBe(0);
            expect(vm.errors.length).toBe(1);
        });

    });


    describe('addLabel', function () {

        it('adds the new label bucket and refreshes the summary when storage is cloud', function () {
            var vm = createController();
            $rootScope.$digest();

            $mdDialogMock.show.and.returnValue($q.resolve('bird'));
            projectsServiceMock.addLabelToProject.and.returnValue($q.resolve([ 'cat', 'dog', 'bird' ]));
            spyOn($scope, '$applyAsync');

            vm.addLabel({});
            $rootScope.$digest();

            expect($scope.project.labels).toEqual([ 'cat', 'dog', 'bird' ]);
            expect($scope.training.bird).toEqual([]);
            expect($scope.project.labelsSummary).toBeDefined();
            expect($scope.$applyAsync).not.toHaveBeenCalled();
        });

        it('triggers an $applyAsync digest when storage is local', function () {
            project.storage = 'local';
            var vm = createController();
            $rootScope.$digest();

            $mdDialogMock.show.and.returnValue($q.resolve('bird'));
            projectsServiceMock.addLabelToProject.and.returnValue($q.resolve([ 'cat', 'dog', 'bird' ]));
            spyOn($scope, '$applyAsync');

            vm.addLabel({});
            $rootScope.$digest();

            expect($scope.$applyAsync).toHaveBeenCalled();
        });

        it('does nothing when the dialog is cancelled', function () {
            var vm = createController();
            $rootScope.$digest();

            $mdDialogMock.show.and.returnValue($q.reject());
            vm.addLabel({});
            $rootScope.$digest();

            expect(projectsServiceMock.addLabelToProject).not.toHaveBeenCalled();
        });

        it('shows an alert if adding the label fails', function () {
            var vm = createController();
            $rootScope.$digest();

            $mdDialogMock.show.and.returnValue($q.resolve('bird'));
            projectsServiceMock.addLabelToProject.and.returnValue($q.reject({ status : 500, data : { message : 'failed' } }));

            vm.addLabel({});
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
        });

    });


    describe('deleteLabel', function () {

        function confirmDialogMock() {
            return {
                title : function () { return this; },
                textContent : function () { return this; },
                ariaLabel : function () { return this; },
                targetEvent : function () { return this; },
                ok : function () { return this; },
                cancel : function () { return this; }
            };
        }

        it('removes the bucket and label, and tells the server, when the user confirms', function () {
            var vm = createController();
            $rootScope.$digest();

            $mdDialogMock.confirm.and.returnValue(confirmDialogMock());
            $mdDialogMock.show.and.returnValue($q.resolve());
            projectsServiceMock.removeLabelFromProject.and.returnValue($q.resolve());

            vm.deleteLabel({}, 'cat', 0);
            $rootScope.$digest();

            expect($scope.training.cat).toBeUndefined();
            expect($scope.project.labels).toEqual([ 'dog' ]);
            expect(projectsServiceMock.removeLabelFromProject).toHaveBeenCalledWith(
                $scope.project, 'user1', 'class1', 'cat');
        });

        it('leaves everything unchanged when the user cancels', function () {
            var vm = createController();
            $rootScope.$digest();

            $mdDialogMock.confirm.and.returnValue(confirmDialogMock());
            $mdDialogMock.show.and.returnValue($q.reject());

            vm.deleteLabel({}, 'cat', 0);
            $rootScope.$digest();

            expect($scope.training.cat).toEqual([]);
            expect($scope.project.labels).toEqual([ 'cat', 'dog' ]);
            expect(projectsServiceMock.removeLabelFromProject).not.toHaveBeenCalled();
        });

    });


    describe('downloadTrainingData', function () {

        it('downloads a text file with one line per training example', function () {
            var vm = createController();
            $rootScope.$digest();
            $scope.training.cat = [ { textdata : 'meow' }, { textdata : 'purr' } ];

            $scope.downloadTrainingData({}, 'cat');

            expect(downloadServiceMock.downloadFile).toHaveBeenCalledWith(
                [ 'meow\n', 'purr\n' ], 'text/plain', 'cat.txt');
        });

    });


    describe('uploadTrainingData (bulk text file upload)', function () {

        var fileReaderMock;

        beforeEach(function () {
            fileReaderMock = {
                readAsText : jasmine.createSpy('readAsText')
            };
            readersServiceMock.createFileReader.and.returnValue(fileReaderMock);
        });

        function uploadEvent(file) {
            return { currentTarget : { files : [ file ] } };
        }

        it('splits the file into lines, trims them, drops blanks, and dedupes within the file', function () {
            var vm = createController();
            $rootScope.$digest();

            var elem = { dataset : { label : 'cat' } };
            $scope.uploadTrainingData(uploadEvent({}), elem);

            fileReaderMock.result = 'meow \r\n\r\nmeow\npurr\n   \nhiss';
            fileReaderMock.onload();
            $rootScope.$digest();

            expect(trainingServiceMock.bulkAddTrainingData).toHaveBeenCalledWith($scope.project, [
                { label : 'cat', textdata : 'meow' },
                { label : 'cat', textdata : 'purr' },
                { label : 'cat', textdata : 'hiss' }
            ]);
        });

        it('truncates lines longer than 1024 characters', function () {
            var vm = createController();
            $rootScope.$digest();

            var longLine = 'x'.repeat(1100);
            var elem = { dataset : { label : 'cat' } };
            $scope.uploadTrainingData(uploadEvent({}), elem);

            fileReaderMock.result = longLine;
            fileReaderMock.onload();
            $rootScope.$digest();

            var sentItems = trainingServiceMock.bulkAddTrainingData.calls.mostRecent().args[1];
            expect(sentItems[0].textdata.length).toBe(1024);
        });

        it('appends the newly stored items to the bucket', function () {
            var vm = createController();
            $rootScope.$digest();
            $scope.training.cat = [ { id : 'existing', textdata : 'already here' } ];

            trainingServiceMock.bulkAddTrainingData.and.returnValue($q.resolve([
                { id : 'new1', textdata : 'meow' }
            ]));

            var elem = { dataset : { label : 'cat' } };
            $scope.uploadTrainingData(uploadEvent({}), elem);
            fileReaderMock.result = 'meow';
            fileReaderMock.onload();
            // 1st digest resolves the bulkAddTrainingData promise, which itself
            // schedules an $applyAsync - that only gets flushed by a later digest
            $rootScope.$digest();
            $rootScope.$digest();

            expect($scope.training.cat.map(i => i.id)).toEqual([ 'existing', 'new1' ]);
        });

        it('shows an alert if the file cannot be read', function () {
            var vm = createController();
            $rootScope.$digest();

            var elem = { dataset : { label : 'cat' } };
            $scope.uploadTrainingData(uploadEvent({}), elem);

            fileReaderMock.error = { message : 'could not read file' };
            fileReaderMock.onerror();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
        });

        it('shows an alert if bulk storage fails', function () {
            var vm = createController();
            $rootScope.$digest();

            trainingServiceMock.bulkAddTrainingData.and.returnValue($q.reject({ status : 500, data : { message : 'failed' } }));

            var elem = { dataset : { label : 'cat' } };
            $scope.uploadTrainingData(uploadEvent({}), elem);
            fileReaderMock.result = 'meow';
            fileReaderMock.onload();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
        });

        it('does not re-add a line that already exists in the bucket (case-insensitive), even though it dedupes within the file', function () {
            var vm = createController();
            $rootScope.$digest();
            $scope.training.cat = [ { id : 'existing', textdata : 'meow' } ];

            var elem = { dataset : { label : 'cat' } };
            $scope.uploadTrainingData(uploadEvent({}), elem);
            fileReaderMock.result = 'meow\npurr';
            fileReaderMock.onload();
            $rootScope.$digest();

            var sentItems = trainingServiceMock.bulkAddTrainingData.calls.mostRecent().args[1];
            expect(sentItems).toEqual([
                { label : 'cat', textdata : 'purr' }
            ]);
        });

    });

});
