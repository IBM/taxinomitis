describe('TrainingController - regression projects', function () {

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
            type : 'regression',
            storage : 'cloud',
            userid : 'user1',
            isCrowdSourced : false,
            labels : [], // regression projects use columns, not labels - but the field must exist
            columns : [
                { label : 'height', output : false, type : 'number' },
                { label : 'weight', output : true, type : 'number' }
            ]
        };

        authServiceMock = {
            getProfileDeferred : jasmine.createSpy('getProfileDeferred').and.returnValue($q.resolve(profile))
        };

        projectsServiceMock = jasmine.createSpyObj('projectsService', [
            'getProject', 'getFields', 'addLabelToProject', 'removeLabelFromProject', 'addMetadataToProject'
        ]);
        projectsServiceMock.getProject.and.returnValue($q.resolve(project));
        projectsServiceMock.addMetadataToProject.and.returnValue($q.resolve());

        trainingServiceMock = jasmine.createSpyObj('trainingService', [
            'getTraining', 'getSoundData', 'newTrainingData', 'uploadSound', 'uploadImage',
            'deleteTrainingData', 'clearTrainingData', 'bulkAddTrainingData'
        ]);
        trainingServiceMock.getTraining.and.returnValue($q.resolve([]));
        trainingServiceMock.deleteTrainingData.and.returnValue($q.resolve());
        trainingServiceMock.clearTrainingData.and.returnValue($q.resolve());

        modelServiceMock = jasmine.createSpyObj('modelService', ['generateProjectSummary', 'deleteModel']);
        modelServiceMock.generateProjectSummary.and.returnValue('weight');
        modelServiceMock.deleteModel.and.returnValue($q.resolve());

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


    describe('initial load', function () {

        it('does not fetch fields, sound support, or image support for a regression project', function () {
            createController();
            $rootScope.$digest();

            expect(projectsServiceMock.getFields).not.toHaveBeenCalled();
            expect(soundTrainingServiceMock.initSoundSupport).not.toHaveBeenCalled();
            expect(utilServiceMock.loadImageProjectSupport).not.toHaveBeenCalled();
        });

        it('replaces $scope.training with the fetched row array directly (no per-label buckets)', function () {
            var rows = [
                { id : 'r1', height : 10, weight : 20 },
                { id : 'r2', height : 11, weight : 22 }
            ];
            trainingServiceMock.getTraining.and.returnValue($q.resolve(rows));

            createController();
            $rootScope.$digest();

            expect($scope.training).toEqual(rows);
            expect($scope.regressionmode).toBe('init');
        });

        it('summarises the output columns, joined with "and"', function () {
            createController();
            $rootScope.$digest();

            expect(modelServiceMock.generateProjectSummary).toHaveBeenCalledWith([ 'weight' ], ' and ');
            expect($scope.project.labelsSummary).toBe('weight');
        });

        it('describes how many input columns feed the output', function () {
            createController();
            $rootScope.$digest();

            expect($scope.columnsSummary).toBe(' from 1 input values');
        });

        it('falls back to "something" when generateProjectSummary returns nothing', function () {
            modelServiceMock.generateProjectSummary.and.returnValue(undefined);

            createController();
            $rootScope.$digest();

            expect($scope.project.labelsSummary).toBe('something');
        });

        it('does not set a columnsSummary when every column is an output', function () {
            project.columns = [ { label : 'weight', output : true, type : 'number' } ];

            createController();
            $rootScope.$digest();

            expect($scope.columnsSummary).toBeUndefined();
        });

        it('handles a project with no columns yet', function () {
            project.columns = undefined;
            // with no columns, generateProjectSummary is called with an empty array,
            // which a real modelService would summarise as falsy
            modelServiceMock.generateProjectSummary.and.returnValue(undefined);

            createController();
            $rootScope.$digest();

            expect(modelServiceMock.generateProjectSummary).toHaveBeenCalledWith([], ' and ');
            expect($scope.project.labelsSummary).toBe('something');
            expect($scope.columnsSummary).toBeUndefined();
        });

    });


    describe('addRegressionColumn', function () {

        it('adds a new input column and reports the change', function () {
            var vm = createController();
            $rootScope.$digest();
            spyOn(vm, 'onColumnsChanged');

            $mdDialogMock.show.and.returnValue($q.resolve('length'));
            vm.addRegressionColumn({});
            $rootScope.$digest();

            expect($scope.project.columns[2]).toEqual({ label : 'length', output : false, type : 'number' });
            expect(vm.onColumnsChanged).toHaveBeenCalled();
        });

        it('creates the columns array if the project does not have one yet', function () {
            project.columns = undefined;
            var vm = createController();
            $rootScope.$digest();

            $mdDialogMock.show.and.returnValue($q.resolve('length'));
            vm.addRegressionColumn({});
            $rootScope.$digest();

            expect($scope.project.columns).toEqual([ { label : 'length', output : false, type : 'number' } ]);
        });

        it('does nothing when cancelled', function () {
            var vm = createController();
            $rootScope.$digest();
            spyOn(vm, 'onColumnsChanged');

            $mdDialogMock.show.and.returnValue($q.reject());
            vm.addRegressionColumn({});
            $rootScope.$digest();

            expect($scope.project.columns.length).toBe(2);
            expect(vm.onColumnsChanged).not.toHaveBeenCalled();
        });

    });


    describe('onColumnsChanged', function () {

        it('refreshes the summary and saves the columns as project metadata', function () {
            var vm = createController();
            $rootScope.$digest();

            vm.onColumnsChanged();
            $rootScope.$digest();

            expect(projectsServiceMock.addMetadataToProject).toHaveBeenCalledWith($scope.project, 'columns', $scope.project.columns);
        });

        it('deletes any existing trained model, since it is now out of date', function () {
            var vm = createController();
            $rootScope.$digest();

            vm.onColumnsChanged();
            $rootScope.$digest();

            expect(modelServiceMock.deleteModel).toHaveBeenCalledWith('regression', 'project1');
        });

        it('shows an alert if saving the columns fails', function () {
            var vm = createController();
            $rootScope.$digest();
            projectsServiceMock.addMetadataToProject.and.returnValue($q.reject({ status : 500, data : { message : 'save failed' } }));

            vm.onColumnsChanged();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
        });

        it('does not show a user-facing alert if deleting the stale model fails (only logs it)', function () {
            var vm = createController();
            $rootScope.$digest();
            modelServiceMock.deleteModel.and.returnValue($q.reject({ status : 500, data : { message : 'delete failed' } }));

            vm.onColumnsChanged();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(0);
            expect(loggerServiceMock.error).toHaveBeenCalled();
        });

    });


    describe('deleteRegressionItem', function () {

        it('removes the row immediately and calls the training service', function () {
            var vm = createController();
            $rootScope.$digest();
            var row1 = { id : 'r1' };
            var row2 = { id : 'r2' };
            $scope.training = [ row1, row2 ];

            vm.deleteRegressionItem(row1);

            expect($scope.training).toEqual([ row2 ]);
            expect(trainingServiceMock.deleteTrainingData).toHaveBeenCalledWith('project1', 'user1', 'class1', 'r1');
        });

        it('does nothing if the row is not found in the training array', function () {
            var vm = createController();
            $rootScope.$digest();
            var row1 = { id : 'r1' };
            $scope.training = [ row1 ];

            vm.deleteRegressionItem({ id : 'not-in-the-list' });

            expect($scope.training).toEqual([ row1 ]);
            expect(trainingServiceMock.deleteTrainingData).not.toHaveBeenCalled();
        });

        it('leaves the row removed and shows an alert if the server delete fails (no rollback)', function () {
            var vm = createController();
            $rootScope.$digest();
            var row1 = { id : 'r1' };
            $scope.training = [ row1 ];
            trainingServiceMock.deleteTrainingData.and.returnValue($q.reject({ status : 500, data : { message : 'failed' } }));

            vm.deleteRegressionItem(row1);
            $rootScope.$digest();

            expect($scope.training).toEqual([]);
            expect(vm.errors.length).toBe(1);
        });

    });


    describe('setRegressionMode', function () {

        it('sets $scope.regressionmode', function () {
            var vm = createController();
            $rootScope.$digest();

            vm.setRegressionMode('selectcolumns');

            expect($scope.regressionmode).toBe('selectcolumns');
        });

    });


    describe('deleteAllRegression', function () {

        it('clears all training data, and tells the server, once the user confirms', function () {
            var vm = createController();
            $rootScope.$digest();
            $scope.training = [ { id : 'r1' }, { id : 'r2' } ];

            $mdDialogMock.confirm.and.returnValue(confirmDialogMock());
            $mdDialogMock.show.and.returnValue($q.resolve());

            vm.deleteAllRegression({});
            $rootScope.$digest();

            expect($mdDialogMock.confirm).toHaveBeenCalled();
            expect($scope.training).toEqual([]);
            expect(trainingServiceMock.clearTrainingData).toHaveBeenCalledWith($scope.project);
        });

        it('leaves the training data untouched if the user cancels', function () {
            var vm = createController();
            $rootScope.$digest();
            $scope.training = [ { id : 'r1' }, { id : 'r2' } ];

            $mdDialogMock.confirm.and.returnValue(confirmDialogMock());
            $mdDialogMock.show.and.returnValue($q.reject());

            vm.deleteAllRegression({});
            $rootScope.$digest();

            expect($scope.training.length).toBe(2);
            expect(trainingServiceMock.clearTrainingData).not.toHaveBeenCalled();
        });

    });


    describe('downloadTrainingData', function () {

        it('exports every row as a CSV, using the column labels as headers', function () {
            var vm = createController();
            $rootScope.$digest();
            $scope.training = [ { height : 10, weight : 20 } ];
            csvServiceMock.exportFile.and.returnValue($q.resolve('csv,contents'));

            $scope.downloadTrainingData({});
            $rootScope.$digest();

            expect(csvServiceMock.exportFile).toHaveBeenCalledWith($scope.training, [ 'height', 'weight' ]);
            expect(downloadServiceMock.downloadFile).toHaveBeenCalledWith([ 'csv,contents' ], 'text/csv', 'training-project1.csv');
        });

        it('shows an alert if the export fails', function () {
            var vm = createController();
            $rootScope.$digest();
            $scope.training = [ { height : 10, weight : 20 } ];
            csvServiceMock.exportFile.and.returnValue($q.reject({ message : 'export failed' }));

            $scope.downloadTrainingData({});
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
        });

    });


    describe('uploadTrainingData (bulk CSV upload)', function () {

        function uploadEvent(file) {
            return { currentTarget : { files : [ file ] } };
        }

        it('infers columns from the CSV header when the project has none yet', function () {
            project.columns = [];
            var vm = createController();
            $rootScope.$digest();
            spyOn(vm, 'onColumnsChanged');

            csvServiceMock.parseFile.and.returnValue($q.resolve({
                meta : { fields : [ 'length', 'width' ] },
                data : [ { length : 5, width : 2 } ]
            }));
            trainingServiceMock.bulkAddTrainingData.and.returnValue($q.resolve([]));

            $scope.uploadTrainingData(uploadEvent({}), {});
            $rootScope.$digest();

            expect($scope.project.columns).toEqual([
                { label : 'length', output : false, type : 'number' },
                { label : 'width', output : false, type : 'number' }
            ]);
            expect(vm.onColumnsChanged).toHaveBeenCalled();
        });

        it('defaults an inferred column type to "unknown" when the CSV has no data rows', function () {
            project.columns = [];
            createController();
            $rootScope.$digest();

            csvServiceMock.parseFile.and.returnValue($q.resolve({
                meta : { fields : [ 'length' ] },
                data : []
            }));
            trainingServiceMock.bulkAddTrainingData.and.returnValue($q.resolve([]));

            $scope.uploadTrainingData(uploadEvent({}), {});
            $rootScope.$digest();

            expect($scope.project.columns).toEqual([ { label : 'length', output : false, type : 'unknown' } ]);
        });

        it('rejects a CSV whose columns do not match the existing project columns', function () {
            var vm = createController();
            $rootScope.$digest();

            csvServiceMock.parseFile.and.returnValue($q.resolve({
                meta : { fields : [ 'weight', 'height' ] }, // same columns, wrong order
                data : [ { weight : 20, height : 10 } ]
            }));

            $scope.uploadTrainingData(uploadEvent({}), {});
            $rootScope.$digest();

            expect(trainingServiceMock.bulkAddTrainingData).not.toHaveBeenCalled();
            expect(vm.errors.length).toBe(1);
            expect($scope.loadingtraining).toBe(false);
        });

        it('accepts a CSV matching the existing columns, and appends the stored rows', function () {
            var vm = createController();
            $rootScope.$digest();
            $scope.training = [ { id : 'existing' } ];

            csvServiceMock.parseFile.and.returnValue($q.resolve({
                meta : { fields : [ 'height', 'weight' ] },
                data : [ { height : 10, weight : 20 } ]
            }));
            trainingServiceMock.bulkAddTrainingData.and.returnValue($q.resolve([ { id : 'new1', height : 10, weight : 20 } ]));

            $scope.uploadTrainingData(uploadEvent({}), {});
            $rootScope.$digest();

            expect($scope.training.map(r => r.id)).toEqual([ 'existing', 'new1' ]);
            expect($scope.loadingtraining).toBe(false);
        });

        it('shows an alert and resets loadingtraining if the bulk upload fails', function () {
            var vm = createController();
            $rootScope.$digest();

            csvServiceMock.parseFile.and.returnValue($q.resolve({
                meta : { fields : [ 'height', 'weight' ] },
                data : [ { height : 10, weight : 20 } ]
            }));
            trainingServiceMock.bulkAddTrainingData.and.returnValue($q.reject({ status : 400, data : { message : 'failed' } }));

            $scope.uploadTrainingData(uploadEvent({}), {});
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect($scope.loadingtraining).toBe(false);
        });

    });

});
