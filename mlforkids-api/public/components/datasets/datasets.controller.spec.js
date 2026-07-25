describe('DatasetsController', function () {

    var $controller;
    var $q;
    var $rootScope;

    var authServiceMock, projectsServiceMock, datasetsServiceMock, loggerServiceMock,
        trainingServiceMock, storageServiceMock, browserStorageServiceMock,
        $stateMock, $translateMock, $mdDialogMock;

    var profile;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
    }));

    beforeEach(function () {
        profile = { user_id : 'user1', tenant : 'class1', role : 'student' };

        authServiceMock = {
            getProfileDeferred : jasmine.createSpy('getProfileDeferred').and.returnValue($q.resolve(profile))
        };

        projectsServiceMock = jasmine.createSpyObj('projectsService', ['createProject']);
        datasetsServiceMock = jasmine.createSpyObj('datasetsService', ['getDataset']);
        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error']);
        trainingServiceMock = jasmine.createSpyObj('trainingService', ['bulkAddTrainingData']);
        storageServiceMock = jasmine.createSpyObj('storageService', ['setItem']);
        browserStorageServiceMock = jasmine.createSpyObj('browserStorageService', ['isSupported']);
        browserStorageServiceMock.isSupported.and.returnValue($q.resolve(1));

        $stateMock = jasmine.createSpyObj('$state', ['go']);

        // echoes each requested translation key back as its own value, so
        // tests can assert against the known key strings rather than needing
        // real translation files loaded
        $translateMock = jasmine.createSpy('$translate').and.callFake(function (keys) {
            var result = {};
            keys.forEach(function (key) {
                result[key] = key;
            });
            return $q.resolve(result);
        });

        $mdDialogMock = jasmine.createSpyObj('$mdDialog', ['show', 'hide', 'cancel']);
    });

    function createController() {
        return $controller('DatasetsController', {
            authService : authServiceMock,
            projectsService : projectsServiceMock,
            datasetsService : datasetsServiceMock,
            loggerService : loggerServiceMock,
            trainingService : trainingServiceMock,
            storageService : storageServiceMock,
            browserStorageService : browserStorageServiceMock,
            $state : $stateMock,
            $translate : $translateMock,
            $mdDialog : $mdDialogMock,
            $q : $q
        });
    }

    function createReadyController() {
        var vm = createController();
        $rootScope.$digest();
        return vm;
    }


    describe('initialisation', function () {

        it('loads the profile and populates the dataset list', function () {
            var vm = createReadyController();

            expect(vm.profile).toEqual(profile);
            expect(vm.loading).toBe(false);
            expect(vm.datasets.length).toBe(16);

            var titanic = vm.datasets.find(function (d) { return d.id === 'titanic'; });
            expect(titanic.type).toBe('numbers');
            expect(titanic.title).toBe('DATASETS.DATA.TITANIC.TITLE');

            var catsanddogs = vm.datasets.find(function (d) { return d.id === 'cats-and-dogs'; });
            expect(catsanddogs.type).toBe('imgtfjs');

            var headlines = vm.datasets.find(function (d) { return d.id === 'uk-newspaper-headlines'; });
            expect(headlines.type).toBe('text');
        });

        it('records an error alert if fetching the profile fails', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.reject({ status : 401, data : { error : 'not authorised' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].status).toBe(401);
            expect(vm.errors[0].message).toBe('not authorised');
        });

        it('uses a fallback message if the error has no data', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.reject({ status : 500 }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors[0].message).toBe('Unknown error');
        });

    });


    describe('dismissAlert', function () {

        it('removes the alert at the given index', function () {
            var vm = createController();
            vm.errors = [ { alertid : 1 }, { alertid : 2 } ];

            vm.dismissAlert('errors', 0);

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].alertid).toBe(2);
        });

    });


    describe('local storage support', function () {

        it('offers the local storage option when browser storage is supported', function () {
            browserStorageServiceMock.isSupported.and.returnValue($q.resolve(1));
            var vm = createReadyController();
            $mdDialogMock.show.and.returnValue($q.reject());

            vm.displayDataset({}, { id : 'titanic' });

            var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
            expect(dialogOptions.locals.localStorageSupported).toBe(true);
        });

        it('does not offer the local storage option when browser storage is not supported', function () {
            // -1 means IndexedDB failed the startup check (e.g. private
            // browsing mode, or the browser doesn't support it at all)
            browserStorageServiceMock.isSupported.and.returnValue($q.resolve(-1));
            var vm = createReadyController();
            $mdDialogMock.show.and.returnValue($q.reject());

            vm.displayDataset({}, { id : 'titanic' });

            var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
            expect(dialogOptions.locals.localStorageSupported).toBe(false);
        });

        it('does not offer the local storage option while support is still being determined', function () {
            // 0 is the "not yet known" state - browserStorageService hasn't
            // resolved the check yet
            browserStorageServiceMock.isSupported.and.returnValue($q.resolve(0));
            var vm = createReadyController();
            $mdDialogMock.show.and.returnValue($q.reject());

            vm.displayDataset({}, { id : 'titanic' });

            var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
            expect(dialogOptions.locals.localStorageSupported).toBe(false);
        });

    });


    describe('displayDataset', function () {

        it('does nothing if a project is already being created', function () {
            var vm = createReadyController();
            vm.creating = true;

            vm.displayDataset({}, { id : 'titanic' });

            expect($mdDialogMock.show).not.toHaveBeenCalled();
        });

        it('shows a dialog with the dataset and default testratio', function () {
            var vm = createReadyController();
            $mdDialogMock.show.and.returnValue($q.reject());

            var dataset = { id : 'titanic' };
            vm.displayDataset({}, dataset);

            var dialogOptions = $mdDialogMock.show.calls.mostRecent().args[0];
            expect(dialogOptions.templateUrl).toBe('static/components/datasets/dataset.tmpl.html');
            expect(dialogOptions.locals.dataset).toBe(dataset);
            expect(dialogOptions.locals.testratio).toBe(0);
            expect(dialogOptions.locals.localStorageSupported).toBe(true);
        });

        it('imports the dataset chosen from the dialog', function () {
            var vm = createReadyController();
            var dataset = { id : 'titanic', type : 'numbers', title : 'Titanic', storage : 'cloud' };
            $mdDialogMock.show.and.returnValue($q.resolve(dataset));
            projectsServiceMock.createProject.and.returnValue($q.resolve({ id : 'newproject' }));

            vm.displayDataset({}, dataset);
            $rootScope.$digest();

            expect(projectsServiceMock.createProject).toHaveBeenCalled();
            expect($stateMock.go).toHaveBeenCalledWith('projects', { id : 'newproject' });
        });

        it('does not import anything if the dialog is cancelled', function () {
            var vm = createReadyController();
            $mdDialogMock.show.and.returnValue($q.reject());

            vm.displayDataset({}, { id : 'titanic' });
            $rootScope.$digest();

            expect(projectsServiceMock.createProject).not.toHaveBeenCalled();
        });

        describe('inner dialog controller', function () {

            function getDialogInnerController() {
                var vm = createReadyController();
                $mdDialogMock.show.and.returnValue($q.reject());
                vm.displayDataset({}, { id : 'titanic' });
                return $mdDialogMock.show.calls.mostRecent().args[0].controller;
            }

            it('initialises scope from the locals', function () {
                var innerController = getDialogInnerController();
                var scope = {};
                var dataset = { id : 'titanic' };

                innerController(scope, { dataset : dataset, testratio : 0.3, localStorageSupported : true });

                expect(scope.dataset).toBe(dataset);
                expect(scope.testratio).toBe(0.3);
                expect(scope.localStorageSupported).toBe(true);
            });

            it('hide() hides the dialog', function () {
                var innerController = getDialogInnerController();
                var scope = {};
                innerController(scope, { dataset : {}, testratio : 0, localStorageSupported : false });

                scope.hide();

                expect($mdDialogMock.hide).toHaveBeenCalledWith();
            });

            it('cancel() cancels the dialog', function () {
                var innerController = getDialogInnerController();
                var scope = {};
                innerController(scope, { dataset : {}, testratio : 0, localStorageSupported : false });

                scope.cancel();

                expect($mdDialogMock.cancel).toHaveBeenCalled();
            });

            it('confirm(location) stores the storage location and testratio, then hides with the dataset', function () {
                var innerController = getDialogInnerController();
                var scope = {};
                var dataset = { id : 'titanic' };
                innerController(scope, { dataset : dataset, testratio : 0.5, localStorageSupported : true });

                scope.confirm('local');

                expect(dataset.storage).toBe('local');
                expect(dataset.testratio).toBe(0.5);
                expect($mdDialogMock.hide).toHaveBeenCalledWith(dataset);
            });

        });

    });


    describe('importProject', function () {

        it('does nothing if a project is already being created', function () {
            var vm = createReadyController();
            vm.creating = true;

            vm.importProject({ id : 'titanic', storage : 'cloud' });

            expect(projectsServiceMock.createProject).not.toHaveBeenCalled();
        });

        describe('cloud import', function () {

            it('creates the project and navigates to it', function () {
                var vm = createReadyController();
                projectsServiceMock.createProject.and.returnValue($q.resolve({ id : 'newproject' }));

                vm.importProject({ id : 'titanic', type : 'numbers', title : 'Titanic', storage : 'cloud' });
                $rootScope.$digest();

                expect(projectsServiceMock.createProject).toHaveBeenCalledWith(
                    jasmine.objectContaining({ type : 'numbers', dataset : 'titanic', storage : 'cloud', name : 'Titanic' }),
                    'user1', 'class1'
                );
                expect($stateMock.go).toHaveBeenCalledWith('projects', { id : 'newproject' });
                expect(vm.creating).toBe(true);
            });

            it('stores test data as csv when the created project has testdata', function () {
                var vm = createReadyController();
                var created = {
                    id : 'newproject',
                    testdata : [ [ 'a "quoted" value', 2 ], [ 'plain', 3 ] ]
                };
                projectsServiceMock.createProject.and.returnValue($q.resolve(created));

                vm.importProject({ id : 'titanic', type : 'numbers', title : 'Titanic', storage : 'cloud' });
                $rootScope.$digest();

                expect(storageServiceMock.setItem).toHaveBeenCalledWith(
                    'testdata://newproject',
                    '"a ""quoted"" value",2\r\n"plain",3'
                );
            });

            it('logs but does not block navigation if storing test data locally fails (storage denied/unsupported)', function () {
                var vm = createReadyController();
                var created = { id : 'newproject', testdata : [ [ 'a', 1 ] ] };
                projectsServiceMock.createProject.and.returnValue($q.resolve(created));
                storageServiceMock.setItem.and.throwError('QuotaExceededError');

                vm.importProject({ id : 'titanic', type : 'numbers', title : 'Titanic', storage : 'cloud' });
                $rootScope.$digest();

                expect(loggerServiceMock.error).toHaveBeenCalledWith(
                    '[ml4kds] Failed to store test data in local storage', jasmine.any(Error)
                );
                // the failure is silent to the user - no alert is raised, and
                // the project is still opened even though its test data wasn't saved
                expect(vm.errors.length).toBe(0);
                expect($stateMock.go).toHaveBeenCalledWith('projects', { id : 'newproject' });
            });

            it('records an error alert and resets creating on failure', function () {
                var vm = createReadyController();
                projectsServiceMock.createProject.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

                vm.importProject({ id : 'titanic', type : 'numbers', title : 'Titanic', storage : 'cloud' });
                $rootScope.$digest();

                expect(vm.errors.length).toBe(1);
                expect(vm.errors[0].message).toBe('server error');
                expect(vm.creating).toBe(false);
            });

            it('parses a JSON string error body', function () {
                var vm = createReadyController();
                projectsServiceMock.createProject.and.returnValue($q.reject({ status : 500, data : '{"error":"bad request"}' }));

                vm.importProject({ id : 'titanic', type : 'numbers', title : 'Titanic', storage : 'cloud' });
                $rootScope.$digest();

                expect(vm.errors[0].message).toBe('bad request');
            });

            it('parses a JSON ArrayBuffer error body', function () {
                var vm = createReadyController();
                var json = JSON.stringify({ error : 'binary error' });
                var buffer = new TextEncoder().encode(json).buffer;
                projectsServiceMock.createProject.and.returnValue($q.reject({ status : 500, data : buffer }));

                vm.importProject({ id : 'titanic', type : 'numbers', title : 'Titanic', storage : 'cloud' });
                $rootScope.$digest();

                expect(vm.errors[0].message).toBe('binary error');
            });

            it('falls back to the raw error data if it cannot be parsed', function () {
                var vm = createReadyController();
                projectsServiceMock.createProject.and.returnValue($q.reject({ status : 500, data : { notjson : true } }));

                vm.importProject({ id : 'titanic', type : 'numbers', title : 'Titanic', storage : 'cloud' });
                $rootScope.$digest();

                expect(vm.errors.length).toBe(1);
                expect(vm.errors[0].message).toBe('Unknown error');
            });

        });

        describe('local import', function () {

            it('bulk-adds training data per label for numbers datasets', function () {
                var vm = createReadyController();
                var localDataset = {
                    trainingdata : [
                        { label : 'a', numbers : [ { x : 1 } ] },
                        { label : 'b', numbers : [ { x : 2 } ] }
                    ],
                    language : 'en',
                    labels : [ 'a', 'b' ],
                    fields : []
                };
                datasetsServiceMock.getDataset.and.returnValue($q.resolve(localDataset));
                var project = { id : 'localproject1', type : 'numbers' };
                projectsServiceMock.createProject.and.returnValue($q.resolve(project));
                trainingServiceMock.bulkAddTrainingData.and.returnValue($q.resolve());

                vm.importProject({ id : 'titanic', type : 'numbers', title : 'Titanic', storage : 'local' });
                $rootScope.$digest();

                expect(datasetsServiceMock.getDataset).toHaveBeenCalledWith('numbers', 'titanic');
                expect(trainingServiceMock.bulkAddTrainingData.calls.count()).toBe(2);
                expect(trainingServiceMock.bulkAddTrainingData).toHaveBeenCalledWith(project, localDataset.trainingdata[0]);
                expect(trainingServiceMock.bulkAddTrainingData).toHaveBeenCalledWith(project, localDataset.trainingdata[1]);
                expect($stateMock.go).toHaveBeenCalledWith('projects', { id : 'localproject1' });
            });

            it('bulk-adds all training data in one call for non-numbers datasets', function () {
                var vm = createReadyController();
                var localDataset = { trainingdata : [ { textdata : 'hi', label : 'a' } ], language : 'en', labels : [ 'a' ] };
                datasetsServiceMock.getDataset.and.returnValue($q.resolve(localDataset));
                var project = { id : 'localproject2', type : 'text' };
                projectsServiceMock.createProject.and.returnValue($q.resolve(project));
                trainingServiceMock.bulkAddTrainingData.and.returnValue($q.resolve());

                vm.importProject({ id : 'uk-newspaper-headlines', type : 'text', title : 'Headlines', storage : 'local' });
                $rootScope.$digest();

                expect(trainingServiceMock.bulkAddTrainingData).toHaveBeenCalledWith(
                    project, localDataset.trainingdata, 'user1', 'class1'
                );
                expect($stateMock.go).toHaveBeenCalledWith('projects', { id : 'localproject2' });
            });

            it('records an error alert and resets creating/loading if fetching the local dataset fails', function () {
                var vm = createReadyController();
                datasetsServiceMock.getDataset.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

                vm.importProject({ id : 'titanic', type : 'numbers', title : 'Titanic', storage : 'local' });
                $rootScope.$digest();

                expect(vm.errors.length).toBe(1);
                expect(vm.creating).toBe(false);
                expect(vm.loading).toBe(false);
                expect(projectsServiceMock.createProject).not.toHaveBeenCalled();
            });

            it('records an error alert if creating the local project fails', function () {
                var vm = createReadyController();
                datasetsServiceMock.getDataset.and.returnValue($q.resolve({ trainingdata : [], language : 'en', labels : [] }));
                projectsServiceMock.createProject.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

                vm.importProject({ id : 'titanic', type : 'numbers', title : 'Titanic', storage : 'local' });
                $rootScope.$digest();

                expect(vm.errors.length).toBe(1);
                expect(vm.creating).toBe(false);
                expect(vm.loading).toBe(false);
            });

        });

    });

});
