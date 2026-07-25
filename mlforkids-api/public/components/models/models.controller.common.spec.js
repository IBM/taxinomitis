// Tests for the parts of ModelsController that are NOT specific to a
// single project type: the init sequence up to computing status/summary,
// the shared error-alert system (displayAlert / checkForRepeatedErrors /
// dismissAlert), the quiz flow, and downloadTestData.
//
// These are driven using a 'text' project with cloud storage, because that
// is the one project type with no extra setup*Project() branch at the end
// of the init chain - so it exercises exactly the shared code path with no
// type-specific mocking required. Project-type-specific behaviour (including
// text's own local/cloud branching) is covered in the per-type spec files.
describe('ModelsController (common/shared behaviour)', function () {

    var $controller;
    var $q;
    var $rootScope;
    var $scope;
    var $timeout;

    var authServiceMock, projectsServiceMock, trainingServiceMock, quizServiceMock;
    var soundTrainingServiceMock, imageTrainingServiceMock, regressionTrainingServiceMock, numberTrainingServiceMock;
    var modelServiceMock, utilServiceMock, storageServiceMock, downloadServiceMock, browserStorageServiceMock;
    var imageToolsServiceMock, webcamsServiceMock, gpuDetectionServiceMock;
    var scrollServiceMock, loggerServiceMock;
    var $stateParamsMock, $locationMock, $mdDialogMock, $stateMock;

    var profile;
    var project;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_, _$timeout_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
        $timeout = _$timeout_;
        $scope = $rootScope.$new();
    }));

    beforeEach(function () {
        profile = { user_id : 'user1', tenant : 'class1' };
        project = {
            id : 'proj1',
            userid : 'user1',
            type : 'text',
            storage : 'cloud',
            labels : [ 'cat', 'dog' ]
        };

        authServiceMock = {
            getProfileDeferred : jasmine.createSpy('getProfileDeferred').and.returnValue($q.resolve(profile))
        };
        projectsServiceMock = jasmine.createSpyObj('projectsService', [
            'getProject', 'getLabels', 'getFields', 'createLocalProject'
        ]);
        projectsServiceMock.getProject.and.returnValue($q.resolve(project));
        projectsServiceMock.getLabels.and.returnValue($q.resolve({ cat : 3, dog : 4 }));

        trainingServiceMock = jasmine.createSpyObj('trainingService', [
            'getModels', 'newModel', 'newLocalProjectTextModel', 'testModel', 'testModelPrep', 'deleteModel', 'deleteTrainingData'
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
        modelServiceMock.reviewTrainingData.and.returnValue({ counts : [ { label : 'cat', count : 3 }, { label : 'dog', count : 4 } ], status : 'data' });
        modelServiceMock.getStatus.and.returnValue('idle');

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
            $state : $stateMock
        });
    }


    describe('initialisation', function () {

        it('loads the profile, project, labels and models, and computes derived state', function () {
            var vm = createController();
            $rootScope.$digest();

            expect(vm.profile).toEqual(profile);
            expect(projectsServiceMock.getProject).toHaveBeenCalledWith('proj1', 'user1', 'class1');
            expect(projectsServiceMock.getLabels).toHaveBeenCalledWith(project, 'user1', 'class1');
            expect(trainingServiceMock.getModels).toHaveBeenCalledWith(project, 'user1', 'class1');

            expect($scope.project).toEqual(project);
            expect($scope.models).toEqual([]);
            expect($scope.owner).toBe(true);
            expect($scope.projecturls.train).toBe('/#!/mlproject/user1/proj1/training');

            expect(modelServiceMock.generateProjectSummary).toHaveBeenCalledWith(project.labels, ' or ');
            expect($scope.projectSummary).toBe('cat or dog');

            expect(modelServiceMock.reviewTrainingData).toHaveBeenCalledWith({ cat : 3, dog : 4 }, 'text');
            expect($scope.trainingcounts).toEqual([ { label : 'cat', count : 3 }, { label : 'dog', count : 4 } ]);
            expect($scope.trainingdatastatus).toBe('data');

            expect(modelServiceMock.getStatus).toHaveBeenCalledWith([]);
            expect($scope.status).toBe('idle');

            expect($scope.loading).toBe(false);
        });

        it('sets owner to false when the profile does not match the project owner', function () {
            project.userid = 'someoneelse';

            createController();
            $rootScope.$digest();

            expect($scope.owner).toBe(false);
        });

        it('keeps minimumExamples at "five" for a text project', function () {
            createController();
            $rootScope.$digest();

            expect($scope.minimumExamples).toBe('five');
        });

        it('sets hasTestData when previously saved test data exists in storage', function () {
            storageServiceMock.getItem.and.callFake(function (key) {
                if (key === 'testdata://proj1') {
                    return 'somecsvdata';
                }
            });

            createController();
            $rootScope.$digest();

            expect($scope.project.hasTestData).toBe(true);
        });

        it('does not set hasTestData when there is no saved test data', function () {
            storageServiceMock.getItem.and.returnValue(null);

            createController();
            $rootScope.$digest();

            expect($scope.project.hasTestData).toBeUndefined();
        });

    });


    describe('initialisation error handling', function () {

        it('records an error alert if fetching the profile fails', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.reject({ status : 401, data : { error : 'not authorised' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].status).toBe(401);
            expect(vm.errors[0].message).toBe('not authorised');
            expect(scrollServiceMock.scrollToNewItem).toHaveBeenCalledWith('errors' + vm.errors[0].alertid);
        });

        it('records an error alert if fetching the project fails', function () {
            projectsServiceMock.getProject.and.returnValue($q.reject({ status : 404, data : { error : 'not found' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
        });

        it('records an error alert if fetching labels fails', function () {
            projectsServiceMock.getLabels.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
        });

        it('records an error alert if fetching models fails', function () {
            trainingServiceMock.getModels.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
        });

        it('does not crash when an error alert is raised with a 500 status (Sentry reporting path)', function () {
            authServiceMock.getProfileDeferred.and.returnValue($q.reject({ status : 500, data : { error : 'server error' } }));

            expect(function () {
                createController();
                $rootScope.$digest();
            }).not.toThrow();
        });

    });


    describe('dismissAlert', function () {

        it('removes the alert at the given index', function () {
            var vm = createController();
            $rootScope.$digest();
            vm.errors = [ { alertid : 1 }, { alertid : 2 } ];

            vm.dismissAlert('errors', 0);

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].alertid).toBe(2);
        });

    });


    describe('repeated error detection', function () {

        // drive displayAlert repeatedly via testModel's failure path, since
        // there's no method that exposes displayAlert directly
        function failTestWithError(errData) {
            trainingServiceMock.testModel.and.returnValue($q.reject({ status : 500, data : errData }));
            $scope.testformData.testquestion = 'hello';
            vm.testModel({}, {}, project);
            $rootScope.$digest();
        }

        var vm;

        beforeEach(function () {
            // testModel needs an existing model to test against
            trainingServiceMock.getModels.and.returnValue($q.resolve([
                { classifierid : 'model1', credentialsid : 'creds1', status : 'Available' }
            ]));
            vm = createController();
            $rootScope.$digest();
            vm.errors = [];
        });

        it('shows a help dialog after the same error code repeats more than 3 times within 3 minutes', function () {
            failTestWithError({ code : 'MLMOD01', error : 'boom' });
            failTestWithError({ code : 'MLMOD01', error : 'boom' });
            failTestWithError({ code : 'MLMOD01', error : 'boom' });
            expect($mdDialogMock.show).not.toHaveBeenCalledWith(jasmine.objectContaining({
                templateUrl : 'static/components/models/errordetail.tmpl.html'
            }));

            failTestWithError({ code : 'MLMOD01', error : 'boom' });

            expect($mdDialogMock.show).toHaveBeenCalledWith(jasmine.objectContaining({
                templateUrl : 'static/components/models/errordetail.tmpl.html'
            }));
        });

        it('does not show the help dialog when errors have different codes', function () {
            failTestWithError({ code : 'MLMOD01', error : 'boom' });
            failTestWithError({ code : 'MLMOD02', error : 'boom' });
            failTestWithError({ code : 'MLMOD01', error : 'boom' });
            failTestWithError({ code : 'MLMOD02', error : 'boom' });

            expect($mdDialogMock.show).not.toHaveBeenCalledWith(jasmine.objectContaining({
                templateUrl : 'static/components/models/errordetail.tmpl.html'
            }));
        });

        it('does not count errors that happened more than 3 minutes apart', function () {
            jasmine.clock().install();
            try {
                jasmine.clock().mockDate(new Date());

                failTestWithError({ code : 'MLMOD01', error : 'boom' });
                jasmine.clock().tick(4 * 60 * 1000);
                failTestWithError({ code : 'MLMOD01', error : 'boom' });
                jasmine.clock().tick(4 * 60 * 1000);
                failTestWithError({ code : 'MLMOD01', error : 'boom' });
                jasmine.clock().tick(4 * 60 * 1000);
                failTestWithError({ code : 'MLMOD01', error : 'boom' });

                expect($mdDialogMock.show).not.toHaveBeenCalledWith(jasmine.objectContaining({
                    templateUrl : 'static/components/models/errordetail.tmpl.html'
                }));
            }
            finally {
                jasmine.clock().uninstall();
            }
        });

        it('resets the counter after showing the help dialog, so a 5th repeat does not immediately reshow it', function () {
            failTestWithError({ code : 'MLMOD01', error : 'boom' });
            failTestWithError({ code : 'MLMOD01', error : 'boom' });
            failTestWithError({ code : 'MLMOD01', error : 'boom' });
            failTestWithError({ code : 'MLMOD01', error : 'boom' });
            $mdDialogMock.show.calls.reset();

            failTestWithError({ code : 'MLMOD01', error : 'boom' });

            expect($mdDialogMock.show).not.toHaveBeenCalledWith(jasmine.objectContaining({
                templateUrl : 'static/components/models/errordetail.tmpl.html'
            }));
        });

    });


    describe('quiz flow', function () {

        var vm;

        beforeEach(function () {
            vm = createController();
            $rootScope.$digest();
        });

        it('marks a fully correct answer as correct, without changing selections', function () {
            var question = {
                answers : [
                    { text : 'a', correct : true, selected : true },
                    { text : 'b', correct : false, selected : false }
                ]
            };

            vm.checkQuizAnswers(question);
            $timeout.flush();

            expect($scope.answered).toBe(true);
            expect($scope.answerCorrect).toBe(true);
            expect(question.answers[0].selected).toBe(true);
            expect(question.answers[1].selected).toBe(false);
        });

        it('marks an incorrect answer as incorrect, and reveals the correct answers', function () {
            var question = {
                answers : [
                    { text : 'a', correct : true, selected : false },
                    { text : 'b', correct : false, selected : true }
                ]
            };

            vm.checkQuizAnswers(question);
            $timeout.flush();

            expect($scope.answerCorrect).toBe(false);
            expect(question.answers[0].selected).toBe(true);
            expect(question.answers[1].selected).toBe(false);
        });

        it('fetches a new question and does not restore the old one when the last answer was correct', function () {
            $scope.quizQuestion = { id : 'q1' };
            $scope.answerCorrect = true;
            quizServiceMock.getQuestion.and.returnValue({ id : 'q2' });

            vm.nextQuizQuestion();

            expect($scope.answered).toBe(false);
            expect($scope.quizQuestion).toEqual({ id : 'q2' });
            expect(quizServiceMock.restoreQuestion).not.toHaveBeenCalled();
        });

        it('restores the old question to the pool when the last answer was incorrect', function () {
            var lastQuestion = { id : 'q1' };
            $scope.quizQuestion = lastQuestion;
            $scope.answerCorrect = false;
            quizServiceMock.getQuestion.and.returnValue({ id : 'q2' });

            vm.nextQuizQuestion();

            expect(quizServiceMock.restoreQuestion).toHaveBeenCalledWith(lastQuestion);
        });

    });


    describe('downloadTestData', function () {

        it('downloads the saved test data as a CSV file', function () {
            storageServiceMock.getItem.and.returnValue('col1,col2\nval1,val2');

            var vm = createController();
            $rootScope.$digest();

            var ev = jasmine.createSpyObj('event', ['stopPropagation', 'preventDefault']);
            vm.downloadTestData(ev);

            expect(ev.stopPropagation).toHaveBeenCalled();
            expect(ev.preventDefault).toHaveBeenCalled();
            expect(storageServiceMock.getItem).toHaveBeenCalledWith('testdata://proj1');
            expect(downloadServiceMock.downloadFile).toHaveBeenCalledWith(
                jasmine.any(Array), 'text/csv', 'testdata-proj1.csv'
            );
        });

    });

});
