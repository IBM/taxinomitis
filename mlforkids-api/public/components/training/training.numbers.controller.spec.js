describe('TrainingController - numbers projects', function () {

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
    var fields;

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
            type : 'numbers',
            storage : 'cloud',
            userid : 'user1',
            isCrowdSourced : false,
            labels : [ 'cat', 'dog' ]
        };

        fields = [
            { name : 'height', type : 'number' },
            { name : 'color', type : 'multichoice', choices : [ 'black', 'white', 'ginger' ] }
        ];

        authServiceMock = {
            getProfileDeferred : jasmine.createSpy('getProfileDeferred').and.returnValue($q.resolve(profile))
        };

        projectsServiceMock = jasmine.createSpyObj('projectsService', [
            'getProject', 'getFields', 'addLabelToProject', 'removeLabelFromProject', 'addMetadataToProject'
        ]);
        projectsServiceMock.getProject.and.returnValue($q.resolve(project));
        projectsServiceMock.getFields.and.returnValue($q.resolve(fields));

        trainingServiceMock = jasmine.createSpyObj('trainingService', [
            'getTraining', 'getSoundData', 'newTrainingData', 'uploadSound', 'uploadImage',
            'deleteTrainingData', 'clearTrainingData', 'bulkAddTrainingData'
        ]);
        trainingServiceMock.getTraining.and.returnValue($q.resolve([]));
        trainingServiceMock.newTrainingData.and.returnValue($q.resolve({ id : 'server1' }));
        trainingServiceMock.deleteTrainingData.and.returnValue($q.resolve());

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

        it('fetches the project fields and derives the field name list', function () {
            createController();
            $rootScope.$digest();

            expect(projectsServiceMock.getFields).toHaveBeenCalledWith(project, 'user1', 'class1');
            expect($scope.project.fields).toEqual(fields);
            expect($scope.projectfieldnames).toEqual([ 'height', 'color' ]);
        });

        it('sorts fetched training data into the bucket matching its label', function () {
            trainingServiceMock.getTraining.and.returnValue($q.resolve([
                { id : 'a', label : 'cat', numberdata : [ 10, 1 ] },
                { id : 'b', label : 'dog', numberdata : [ 20, 0 ] }
            ]));

            createController();
            $rootScope.$digest();

            expect($scope.training.cat.map(i => i.numberdata)).toEqual([ [ 10, 1 ] ]);
            expect($scope.training.dog.map(i => i.numberdata)).toEqual([ [ 20, 0 ] ]);
        });

        it('surfaces an error alert if fetching the fields fails', function () {
            projectsServiceMock.getFields.and.returnValue($q.reject({ status : 500, data : { message : 'fields unavailable' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
        });

    });


    describe('addConfirmedTrainingData (numbers)', function () {

        it('converts field values to an array in project-field order, parsing decimals with a "." as floats', function () {
            var vm = createController();
            $rootScope.$digest();

            // keys deliberately out of field order, to prove the array is built
            // from $scope.projectfieldnames order, not object key order
            vm.addConfirmedTrainingData({ color : '2', height : '10.5' }, 'cat');

            expect($scope.training.cat[0].numberdata).toEqual([ 10.5, 2 ]);
        });

        it('parses whole numbers (no ".") as integers', function () {
            var vm = createController();
            $rootScope.$digest();

            vm.addConfirmedTrainingData({ height : '10', color : '0' }, 'cat');

            expect($scope.training.cat[0].numberdata).toEqual([ 10, 0 ]);
        });

        it('stores via newTrainingData (not uploadSound/uploadImage)', function () {
            var vm = createController();
            $rootScope.$digest();

            vm.addConfirmedTrainingData({ height : '10', color : '0' }, 'cat');

            expect(trainingServiceMock.newTrainingData).toHaveBeenCalledWith(
                'project1', 'user1', 'class1', 'numbers', 'cloud', [ 10, 0 ], 'cat');
        });

        it('confirmed: does not dedupe numbers examples - two identical rows are both added', function () {
            var vm = createController();
            $rootScope.$digest();

            vm.addConfirmedTrainingData({ height : '10', color : '0' }, 'cat');
            vm.addConfirmedTrainingData({ height : '10', color : '0' }, 'cat');

            expect($scope.training.cat.length).toBe(2);
            expect(vm.errors.length).toBe(0);
        });

        it('shows an alert and removes the placeholder if storage fails', function () {
            var vm = createController();
            $rootScope.$digest();

            trainingServiceMock.newTrainingData.and.returnValue($q.reject({ status : 400, data : { message : 'failed' } }));
            vm.addConfirmedTrainingData({ height : '10', color : '0' }, 'cat');
            $rootScope.$digest();

            expect($scope.training.cat.length).toBe(0);
            expect(vm.errors.length).toBe(1);
        });

        it('rejects an example where a field value cannot be parsed as a number (e.g. NaN from an empty field)', function () {
            var vm = createController();
            $rootScope.$digest();

            vm.addConfirmedTrainingData({ height : '', color : '0' }, 'cat');

            expect($scope.training.cat.length).toBe(0);
            expect(trainingServiceMock.newTrainingData).not.toHaveBeenCalled();
        });

    });


    describe('downloadTrainingData', function () {

        it('exports a CSV with multichoice indexes converted back to their text values', function () {
            var vm = createController();
            $rootScope.$digest();
            $scope.training.cat = [
                { numberdata : [ 10, 1 ] },  // color index 1 -> 'white'
                { numberdata : [ 20, 2 ] }   // color index 2 -> 'ginger'
            ];
            csvServiceMock.exportFile.and.returnValue($q.resolve('csv,contents'));

            $scope.downloadTrainingData({}, 'cat');
            $rootScope.$digest();

            expect(csvServiceMock.exportFile).toHaveBeenCalledWith([
                { height : 10, color : 'white' },
                { height : 20, color : 'ginger' }
            ], [ 'height', 'color' ]);
            expect(downloadServiceMock.downloadFile).toHaveBeenCalledWith([ 'csv,contents' ], 'text/csv', 'cat.csv');
        });

        it('shows an alert if the export fails', function () {
            var vm = createController();
            $rootScope.$digest();
            $scope.training.cat = [ { numberdata : [ 10, 1 ] } ];
            csvServiceMock.exportFile.and.returnValue($q.reject({ message : 'export failed' }));

            $scope.downloadTrainingData({}, 'cat');
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
        });

    });


    describe('uploadTrainingData (bulk CSV upload)', function () {

        function uploadEvent(file) {
            return { currentTarget : { files : [ file ] } };
        }

        it('rejects a CSV whose columns do not match the project fields', function () {
            var vm = createController();
            $rootScope.$digest();

            csvServiceMock.parseFile.and.returnValue($q.resolve({
                meta : { fields : [ 'height', 'weight' ] }, // 'weight' is not a real field
                data : []
            }));

            var elem = { dataset : { label : 'cat' } };
            $scope.uploadTrainingData(uploadEvent({}), elem);
            $rootScope.$digest();

            expect(trainingServiceMock.bulkAddTrainingData).not.toHaveBeenCalled();
            expect(vm.errors.length).toBe(1);
        });

        it('bulk-adds rows matching the columns, and appends the stored items to the bucket', function () {
            var vm = createController();
            $rootScope.$digest();
            $scope.training.cat = [];

            var rows = [ { height : '10', color : 'white' } ];
            csvServiceMock.parseFile.and.returnValue($q.resolve({
                meta : { fields : [ 'height', 'color' ] },
                data : rows
            }));
            trainingServiceMock.bulkAddTrainingData.and.returnValue($q.resolve([
                { id : 'new1', numberdata : [ 10, 1 ] }
            ]));

            var elem = { dataset : { label : 'cat' } };
            $scope.uploadTrainingData(uploadEvent({}), elem);
            $rootScope.$digest();

            expect(trainingServiceMock.bulkAddTrainingData).toHaveBeenCalledWith($scope.project, { label : 'cat', numbers : rows });
            expect($scope.training.cat.map(i => i.id)).toEqual([ 'new1' ]);
        });

        it('shows an alert if the bulk upload fails', function () {
            var vm = createController();
            $rootScope.$digest();

            csvServiceMock.parseFile.and.returnValue($q.resolve({
                meta : { fields : [ 'height', 'color' ] },
                data : [ { height : '10', color : 'white' } ]
            }));
            trainingServiceMock.bulkAddTrainingData.and.returnValue($q.reject({ status : 400, data : { message : 'failed' } }));

            var elem = { dataset : { label : 'cat' } };
            $scope.uploadTrainingData(uploadEvent({}), elem);
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
        });

    });

});
