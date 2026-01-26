(function () {

    angular
        .module('app')
        .controller('ModelsController', ModelsController);

    ModelsController.$inject = [
        'authService',
        'projectsService', 'trainingService', 'quizService',
        'soundTrainingService', 'imageTrainingService', 'regressionTrainingService', 'numberTrainingService',
        'modelService', 'utilService', 'storageService', 'downloadService',
        'imageToolsService', 'webcamsService', 'gpuDetectionService',
        '$stateParams',
        '$scope',
        '$mdDialog', '$timeout', '$interval', '$q', '$document', '$state', 'loggerService'
    ];

    function ModelsController(authService,
        projectsService, trainingService, quizService,
        soundTrainingService, imageTrainingService, regressionTrainingService, numberTrainingService,
        modelService, utilService, storageService, downloadService,
        imageToolsService, webcamsService, gpuDetectionService,
        $stateParams,
        $scope,
        $mdDialog, $timeout, $interval, $q, $document, $state, loggerService)
    {

        var vm = this;
        vm.authService = authService;

        // -------------------------------------------------
        //  error handling
        // -------------------------------------------------
        var THREE_MINUTES = 3 * 60 * 1000;

        var lastAlert = {
            code : 'ERR',
            message : 'Something went wrong',
            incidences : 0,
            firstseen : new Date().getTime()
        };

        function reset() {
            lastAlert = {
                code : 'ERR',
                message : 'Something went wrong',
                incidences : 0,
                firstseen : new Date().getTime()
            };
        }
        function checkForRepeatedErrors(newAlert) {
            var threeMinutesAgo = new Date().getTime() - THREE_MINUTES;

            var hasMatchingCode = newAlert.code ? (newAlert.code === lastAlert.code) : false;
            var hasMatchingMessage = newAlert.code ? false : (newAlert.message === lastAlert.message);
            var isRecent = (lastAlert.firstseen > threeMinutesAgo);


            if ((hasMatchingCode || hasMatchingMessage) && isRecent)
            {
                // we've seen this error before within the last few minutes!
                lastAlert.incidences += 1;
            }
            else {
                // this is different to the last error, so reset the count
                lastAlert = {
                    code : newAlert.code,
                    message : newAlert.message,
                    incidences : 1,
                    firstseen : new Date().getTime()
                };
            }

            // should we give the user some extra help?
            if (lastAlert.incidences > 3){
                var errCode = lastAlert.code;

                $mdDialog.show({
                    controller : function ($scope) {
                        $scope.code = errCode;

                        $scope.hide = function() {
                            $mdDialog.hide();
                        };
                    },
                    templateUrl : 'static/components/models/errordetail.tmpl.html'
                })
                .then(
                    function () {
                        // informational only. do nothing
                    },
                    function() {
                        // cancelled. do nothing
                    }
                );

                reset();
            }
        }


        var alertId = 1;
        vm.errors = [];
        vm.warnings = [];
        vm.dismissAlert = function (type, errIdx) {
            vm[type].splice(errIdx, 1);
        };
        function displayAlert(type, status, errObj) {
            loggerService.error('[ml4kmodels] displaying alert', errObj);

            if (!errObj) {
                errObj = {};
            }
            else {
                // record the error
                loggerService.error(errObj);
                if (status === 500 && Sentry && Sentry.captureException) {
                    Sentry.captureException({
                        error : errObj,
                        errortype : typeof (errObj),
                        projectid : $scope.projectId
                    });
                }
            }

            // create alert and display it
            var newId = alertId++;
            var newAlert = {
                code : errObj.code,
                alertid : newId,
                message : (errObj.data ? errObj.data.error : undefined) || errObj.message || errObj.error || 'Unknown error',
                status : status
            };
            vm[type].push(newAlert);

            // check if we're seeing this alert a lot
            checkForRepeatedErrors(newAlert);

            return newId;
        }
        // -------------------------------------------------



        $scope.loading = true;
        $scope.status = 'unknown';
        $scope.projectId = $stateParams.projectId;
        $scope.userId = $stateParams.userId;

        $scope.projecturls = {
            train : '/#!/mlproject/' + $stateParams.userId + '/' + $stateParams.projectId + '/training'
        };

        $scope.owner = true;

        $scope.minimumExamples = 'five';
        $scope.testformData = {};

        var webcams;
        var currentWebcamIdx = 0;



        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;
                return projectsService.getProject($scope.projectId, $scope.userId, vm.profile.tenant);
            })
            .then(function (project) {
                $scope.project = project;

                return $q.all({
                    labels : projectsService.getLabels($scope.project, $scope.userId, vm.profile.tenant),
                    models : trainingService.getModels(project, $scope.userId, vm.profile.tenant)
                });
            })
            .then(function (values) {
                $scope.owner = (vm.profile.user_id === $scope.project.userid);

                $scope.projecturls.train = '/#!/mlproject/' + $scope.project.userid + '/' + $scope.project.id + '/training';

                if ($scope.project.type === 'sounds') {
                    $scope.minimumExamples = 'eight';
                }
                $scope.models = values.models;
                if ($scope.project.type === 'regression') {
                    $scope.minimumExamples = 'ten';

                    var projectColumns = $scope.project.columns || [ { label : 'something', output : true } ];
                    var outputColNames = projectColumns
                        .filter(c => c.output)
                        .map(c => c.label);
                    if (outputColNames.length === 0) {
                        $scope.projectSummary = 'something';
                    }
                    else {
                        $scope.projectSummary = modelService.generateProjectSummary(outputColNames, ' and ');
                    }
                }
                else {
                    $scope.projectSummary = modelService.generateProjectSummary($scope.project.labels, ' or ');
                }

                var trainingReview = modelService.reviewTrainingData(values.labels, $scope.project.type);
                $scope.trainingcounts = trainingReview.counts;
                $scope.trainingdatastatus = trainingReview.status;

                $scope.status = modelService.getStatus($scope.models);
                loggerService.debug('[ml4kmodels] project status', $scope.status);

                if ($scope.project.type === 'numbers') {
                    return setupNumberProject();
                }
                else if ($scope.project.type === 'sounds') {
                    return setupSoundsProject()
                        .then(function () {
                            $scope.constrainedDevice = gpuDetectionService.isConstrained();
                        });
                }
                else if ($scope.project.type === 'imgtfjs') {
                    return setupImagesProject()
                        .then(function () {
                            $scope.constrainedDevice = gpuDetectionService.isConstrained();
                        });
                }
                else if ($scope.project.type === 'regression') {
                    return setupRegressionProject();
                }
            })
            .then(function () {
                if (storageService.getItem('testdata://' + $scope.project.id)) {
                    $scope.project.hasTestData = true;
                }

                $scope.loading = false;
            })
            .catch(function (err) {
                var errId = displayAlert('errors', err.status, err.data ? err.data : err);
                scrollToNewItem('errors' + errId);
            });


        function setupNumberProject () {
            return projectsService.getFields($scope.project, $scope.userId, vm.profile.tenant)
                .then(function (fields) {
                    $scope.project.fields = fields;

                    let serverModelInfo = undefined;
                    if ($scope.models && $scope.models.length > 0) {
                        serverModelInfo = $scope.models[0];
                    }
                    return numberTrainingService.initNumberSupport($scope.project, serverModelInfo);
                })
                .then(function (loaded) {
                    if (loaded) {
                        fetchModels();
                    }
                });
        }
        function setupImagesProject () {
            if ($scope.project.labels.length > 0) {
                return imageTrainingService.initImageSupport($scope.project.id, $scope.project.labels)
                    .then(function (loaded) {
                        if (loaded) {
                            fetchModels();
                        }
                        // for image projects, we need to inject the dependencies for the
                        //  webcam and canvas controls
                        loggerService.debug('[ml4kmodels] fetching image project dependencies');
                        return utilService.loadImageProjectSupport();
                    });
            }
        }
        function setupSoundsProject () {
            $scope.listening = false;
            var loadSavedModel = true;
            return soundTrainingService.initSoundSupport($scope.project.id, $scope.project.labels, loadSavedModel)
                .then(function (outcome) {
                    if (outcome) {
                        if (outcome.loaded) {
                            fetchModels();
                        }
                        if (outcome.warning) {
                            displayAlert('warnings', 500, outcome.warning);
                        }
                    }
                });
        }
        function setupRegressionProject () {
            $scope.project.labels = [ 'input', 'output' ];
            return regressionTrainingService.initRegressionSupport($scope.project)
                .then(function (loaded) {
                    if (loaded) {
                        fetchModels();
                    }
                });
        }


        var timer = null;

        function stopRefreshing() {
            loggerService.debug('[ml4kmodels] stop refreshing models');
            if (timer) {
                $interval.cancel(timer);
                timer = null;
            }
        }

        function getRefreshInterval() {
            if ($scope.project.type === 'sounds' || $scope.project.type === 'imgtfjs' || $scope.project.type === 'regression') {
                return 2000;
            }
            if ($scope.project.type === 'text') {
                return 20000;
            }
            if ($scope.project.type === 'numbers') {
                return 8000;
            }
            loggerService.error('[ml4kmodels] Unexpected project type');
            return 60000;
        }

        function refreshModels () {
            loggerService.debug('[ml4kmodels] refresh models');
            if (!timer) {
                timer = $interval(function () {
                    fetchModels()
                        .then(function () {
                            if ($scope.status !== 'training') {
                                stopRefreshing();
                            }
                        });
                }, getRefreshInterval());
            }
        }

        function allAnswersAreCorrect (answers) {
            return !(answers.some(function (answer) { return answer.selected !== answer.correct; }));
        }

        vm.checkQuizAnswers = function (quizQuestion) {
            // timeout is to allow the ng-model to update to reflect the
            //  user's click before evaluating the answer based on the model
            $timeout(function () {
                $scope.answered = true;
                $scope.answerCorrect = allAnswersAreCorrect(quizQuestion.answers);

                if ($scope.answerCorrect === false) {
                    quizQuestion.answers.forEach(function (answer) {
                        answer.selected = answer.correct;
                    });
                }
            }, 0);
        };
        vm.nextQuizQuestion = function () {
            $scope.answered = false;
            var lastQuestion = $scope.quizQuestion;
            $scope.quizQuestion = quizService.getQuestion();

            if ($scope.answerCorrect === false) {
                quizService.restoreQuestion(lastQuestion);
            }
        };


        function fetchModels() {
            loggerService.debug('[ml4kmodels] fetching model info');

            var modelFnPromise;
            if ($scope.project.type === 'imgtfjs') {
                modelFnPromise = imageTrainingService.getModels();
            }
            else if ($scope.project.type === 'sounds') {
                modelFnPromise = soundTrainingService.getModels();
            }
            else if ($scope.project.type === 'regression') {
                modelFnPromise = regressionTrainingService.getModels();
            }
            else if ($scope.project.type === 'numbers') {
                modelFnPromise = numberTrainingService.getModels();
            }
            else {
                modelFnPromise = trainingService.getModels($scope.project, $scope.userId, vm.profile.tenant);
            }
            return modelFnPromise.then(function (models) {
                loggerService.debug('[ml4kmodels] models info', models);

                $scope.models = models;
                $scope.status = modelService.getStatus($scope.models);

                if (models && models.length > 0) {
                    if (models[0].status === 'Training') {
                        refreshModels();
                    }
                    else if (models[0].error) {
                        // if we already have a generic placeholder error message, remove it now we
                        //  have a specific message to display
                        vm.errors = vm.errors.filter(function (e) { return e.message !== 'Unknown error'; });

                        var errId = displayAlert('errors', models[0].error, models[0].error);
                        scrollToNewItem('errors' + errId);
                    }
                }

                loggerService.debug('[ml4kmodels] model status', $scope.status);
            });
        }


        function trainTextProject (project) {
            if (project.storage === 'local') {
                if (project.cloudid) {
                    return trainingService.newLocalProjectTextModel(project);
                }
                else {
                    return projectsService.createLocalProject(project, $scope.userId, vm.profile.tenant)
                        .then(function (cloudproject) {
                            $scope.project = cloudproject;
                            return trainingService.newLocalProjectTextModel(cloudproject);
                        });
                }
            }
            else {
                return trainingService.newModel(project.id, $scope.userId, vm.profile.tenant);
            }
        }


        vm.createModel = function (ev, project, simplified) {
            loggerService.debug('[ml4kmodels] creating model');

            // prepare the first question for displaying while
            //  the training is running
            $scope.quizQuestion = quizService.getQuestion();

            $scope.submittingTrainingRequest = true;
            clearTestOutput();

            var modelFnPromise;
            if ($scope.project.type === 'imgtfjs') {
                modelFnPromise = imageTrainingService.newModel(project.id, $scope.userId, vm.profile.tenant, simplified);
            }
            else if ($scope.project.type === 'sounds') {
                modelFnPromise = soundTrainingService.newModel(project.id, $scope.userId, vm.profile.tenant, simplified);
            }
            else if ($scope.project.type === 'numbers') {
                modelFnPromise = numberTrainingService.newModel(project, $scope.userId, vm.profile.tenant);
            }
            else if ($scope.project.type === 'text') {
                modelFnPromise = trainTextProject(project);
            }
            else { // $scope.project.type === 'regression') {
                modelFnPromise = regressionTrainingService.newModel(project);
            }

            modelFnPromise.then(function (newmodel) {
                    loggerService.debug('[ml4kmodels] model training', newmodel);

                    $scope.models = [ newmodel ];
                    $scope.status = modelService.getStatus($scope.models);
                    loggerService.debug('[ml4kmodels] initial status', $scope.status);

                    refreshModels();

                    $scope.submittingTrainingRequest = false;

                    if (newmodel.error) {
                        throw newmodel.error;
                    }
                })
                .catch(function (err) {
                    loggerService.error('[ml4kmodels] model training failed', err);
                    $scope.submittingTrainingRequest = false;

                    if (createModelFailedDueToDownloadFail(err)) {
                        // training error that is because of bad training data
                        allowUserToDeleteTrainingItemThatCausedTrainingFail(err);
                    }
                    else {
                        // general training error
                        var errId = displayAlert('errors', err.status, err.data);
                        scrollToNewItem('errors' + errId);
                    }
                });
        };


        function createModelFailedDueToDownloadFail(err) {
            return err &&
                   err.status === 409 &&
                   err.data && err.data.code &&
                   (err.data.code === 'MLMOD12' || err.data.code === 'MLMOD13' || err.data.code === 'MLMOD14') &&
                   err.data.location && err.data.location.imageid && err.data.location.url &&
                   err.data.location.type === 'download';
        }


        /**
         * @param err - error that impacted training
         */
        function allowUserToDeleteTrainingItemThatCausedTrainingFail(err) {
            return $mdDialog.show({
                controller : function ($scope) {
                    $scope.location = err.data.location;

                    if (utilService.isGoogleFilesUrl(err.data.location.url)) {
                        $scope.errordetails = 'Google has removed access to this image at this URL.';
                        $scope.recommendation = 'You should delete this image from your training.';
                    }
                    else {
                        $scope.errordetails = 'This might be a temporary problem, so you could try again if you like.';
                        $scope.recommendation = 'But if it keeps happening, and is stopping you from training a machine ' +
                                                'learning model, you could delete this image from your training data and ' +
                                                'carry on without it.';
                    }

                    $scope.hide = function() {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function() {
                        $mdDialog.hide(err.data.location);
                    };
                },
                templateUrl : 'static/components/models/downloadfail.tmpl.html'
            })
            .then(
                function (location) {
                    if (location) {
                        trainingService.deleteTrainingData($scope.project.id, $scope.userId, vm.profile.tenant, location.imageid)
                            .then(function() {
                                $state.reload();
                            })
                            .catch(function (e) {
                                var errId = displayAlert('errors', e.status, e.data);
                                scrollToNewItem('errors' + errId);
                            });
                    }
                },
                function() {
                    // cancelled. do nothing
                }
            );
        }


        function clearTestOutput() {
            delete $scope.testoutput;
            delete $scope.testoutput_explanation;
        }


        vm.testModel = function (ev, form, project) {
            loggerService.debug('[ml4kmodels] testing model');
            var testdata = { type : project.type };

            if (project.type === 'text') {
                testdata.text = $scope.testformData.testquestion;
            }
            else if (project.type === 'imgtfjs') {
                testdata.image = $scope.testformData.testimageurl;

                if (testdata.image &&
                    (testdata.image.substring(0, 10) === 'data:image' ||
                     testdata.image.substring(0, 5) === 'blob:'))
                {
                    var errId = displayAlert('errors', 400, {
                        message : 'Invalid URL. Please enter the web address for a picture that you want to test your machine learning model on'
                    });
                    return scrollToNewItem('errors' + errId);
                }

                try {
                    // do this to encode any URL characters that might need it
                    testdata.image = new URL(testdata.image).toString();
                }
                catch (err) {
                    loggerService.debug('[ml4kmodels] unable to escape URL characters, using raw string', err);
                }
            }
            else if (project.type === 'numbers') {
                project.fields.map(function (field) {
                    if (field.type === 'number') {
                        const val = $scope.testformData[field.name];
                        if (typeof val === 'number') {
                            $scope.testformData[field.name] = val;
                        }
                        else if (val.includes('.')) {
                            $scope.testformData[field.name] = parseFloat(val);
                        }
                        else {
                            $scope.testformData[field.name] = parseInt(val);
                        }
                    }
                });
            }
            else if (project.type === 'regression') {
                testdata.regression = {};
                project.columns
                    .filter(function (col) { return !col.output; })
                    .forEach(function (col) {
                        if (col.type === 'number') {
                            testdata.regression[col.label] = parseFloat($scope.testformData[col.label]);
                        }
                        // else {
                        //     // TODO other types
                        // }
                    });
            }
            else if (project.type === 'sounds') {
                return;
            }

            $scope.testoutput = "please wait...";
            $scope.testoutput_explanation = "";

            loggerService.debug('[ml4kmodels] submitting model test', testdata);

            var testFnPromise;
            if (project.type === 'imgtfjs') {
                testFnPromise = trainingService.testModelPrep(project.id,
                    $scope.userId, vm.profile.tenant,
                    $scope.models[0].classifierid,
                    testdata)
                    .then(function (imgdata) {
                        return imageTrainingService.testBase64ImageData(imgdata);
                    });
            }
            else if (project.type === 'regression') {
                testFnPromise = regressionTrainingService.testModel(project, testdata.regression);
            }
            else if (project.type === 'numbers') {
                testFnPromise = numberTrainingService.testModel(project, $scope.testformData);
            }
            else {
                testFnPromise = trainingService.testModel(project,
                    $scope.userId, vm.profile.tenant,
                    $scope.models[0].classifierid, $scope.models[0].credentialsid,
                    testdata);
            }

            testFnPromise
                .then(displayTestResult)
                .catch(displayTestError);
        };




        vm.deleteModel = function (ev, project, model) {
            loggerService.debug('[ml4kmodels] deleting model');
            $scope.submittingDeleteRequest = true;
            clearTestOutput();

            var modelFnPromise;
            if (project.type === 'imgtfjs') {
                modelFnPromise = imageTrainingService.deleteModel(project.id);
            }
            else if (project.type === 'sounds') {
                modelFnPromise = soundTrainingService.deleteModel(project.id);
            }
            else if (project.type === 'regression') {
                modelFnPromise = regressionTrainingService.deleteModel(project.id);
            }
            else if (project.type === 'numbers') {
                modelFnPromise = numberTrainingService.deleteModel(project.id);

                if (project.storage !== 'local') {
                    trainingService.deleteModel(project, $scope.userId, vm.profile.tenant, project.id);
                }
            }
            else if (model) {
                var classifierid = model.classifierid;
                modelFnPromise = trainingService.deleteModel(project, $scope.userId, vm.profile.tenant, classifierid);
            }

            modelFnPromise.then(function () {
                    $scope.models = [];
                    $scope.status = modelService.getStatus($scope.models);

                    if ($scope.status === 'training' || project.type === 'numbers' || project.type === 'imgtfjs' || project.type === 'sounds' || project.type === 'regression') {
                        refreshModels();
                    }
                    else {
                        stopRefreshing();
                    }

                    $scope.submittingDeleteRequest = false;
                })
                .catch(function (err) {
                    loggerService.error('[ml4kmodels] failed to delete model', err);
                    $scope.submittingDeleteRequest = false;

                    if (err.status === 404 && err.data && err.data.error === 'Not found') {
                        return $state.reload();
                    }

                    var errId = displayAlert('errors', err.status, err.data);
                    scrollToNewItem('errors' + errId);
                });
        };





        vm.testUsingCanvas = function (ev) {
            loggerService.debug('[ml4kmodels] testUsingCanvas');

            $scope.testformData.testimageurl = '';

            $scope.testoutput = "please wait...";
            $scope.testoutput_explanation = "";

            $mdDialog.show({
                controller : function ($scope) {
                    $scope.hide = function() {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function() {
                        $mdDialog.hide(imageToolsService.resizeImageElement($scope.canvas));
                    };
                },
                templateUrl : 'static/components/models/canvas.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (canvasimagedata) {
                    $scope.testoutput = "please wait...";
                    $scope.testoutput_explanation = "";

                    imageTrainingService.testCanvas(canvasimagedata)
                        .then(displayTestResult)
                        .catch(displayTestError);
                },
                function() {
                    // cancelled. do nothing
                    clearTestOutput();
                }
            );
        };

        vm.testUsingWebcam = function (ev) {
            loggerService.debug('[ml4kmodels] testUsingWebcam');

            $scope.testformData.testimageurl = '';

            $mdDialog.show({
                controller : function ($scope) {
                    $scope.channel = {};
                    $scope.webcamerror = false;
                    $scope.webcamInitComplete = false;
                    $scope.multipleWebcams = false;

                    webcamsService.getDevices()
                        .then((devices) => {
                            if (devices.length > 0) {
                                webcams = devices;
                                $scope.channel.videoOptions = webcams[currentWebcamIdx];
                                $scope.multipleWebcams = webcams.length > 1;
                                loggerService.debug('[ml4kmodels] webcam config', $scope.channel.videoOptions);
                            }
                            else {
                                $scope.onWebcamError(new Error('No webcams available'));
                            }
                        });

                    $scope.webcamCanvas = null;

                    $scope.hide = function() {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function() {
                        $mdDialog.hide(imageToolsService.resizeImageElement($scope.channel.video));
                    };

                    $scope.onWebcamSuccess = function () {
                        $scope.$apply(function() {
                            $scope.webcamInitComplete = true;
                        });
                    };

                    function displayWebcamError(err) {
                        loggerService.debug('[ml4kmodels] display webcam error', err);

                        $scope.webcamerror = err;
                        if (err && err.message) {
                            if (err.name === 'NotAllowedError') {
                                $scope.webcamerrordetail = 'Not allowed to use the web-cam';
                                return;
                            }
                            else {
                                $scope.webcamerrordetail = err.message;
                            }
                        }

                        loggerService.error('[ml4kmodels] unexpected webcam error', err);
                    }

                    function changeWebcamDevice () {
                        loggerService.debug('[ml4kmodels] changing webcam device');
                        $scope.$applyAsync(() => {
                            $scope.webcamInitComplete = false;
                            $scope.channel.videoOptions = webcams[currentWebcamIdx];
                            $scope.$broadcast('STOP_WEBCAM');
                            $scope.$broadcast('START_WEBCAM');
                            loggerService.debug('[ml4kmodels] new webcam', webcams[currentWebcamIdx]);
                        });
                    }

                    $scope.switchWebcam = function () {
                        loggerService.debug('[ml4kmodels] switching webcam');
                        if (webcams.length > 0) {
                            currentWebcamIdx += 1;
                            if (currentWebcamIdx >= webcams.length) {
                                currentWebcamIdx = 0;
                            }
                            changeWebcamDevice();
                        }
                    };

                    $scope.onWebcamError = function(err) {
                        loggerService.warn('[ml4kmodels] webcam error', err);

                        if (webcams) {
                            // failed to use the webcam - we won't try this one again
                            webcams.splice(currentWebcamIdx, 1);
                            $scope.multipleWebcams = webcams.length > 1;
                            currentWebcamIdx = 0;

                            if (webcams.length > 0) {
                                // there are other webcams we haven't tried yet
                                return changeWebcamDevice();
                            }
                        }

                        // there are no other webcams left to try
                        //   so we'll display the error
                        $scope.webcamInitComplete = true;

                        try {
                            $scope.$apply(
                                function() {
                                    displayWebcamError(err);
                                }
                            );
                        }
                        catch (applyErr) {
                            $timeout(function () {
                                displayWebcamError(err);
                            }, 0, false);
                        }
                    };
                },
                templateUrl : 'static/components/models/webcam.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (webcamimagecanvas) {
                    $scope.testoutput = "please wait...";
                    $scope.testoutput_explanation = "";

                    imageTrainingService.testCanvas(webcamimagecanvas)
                        .then(displayTestResult)
                        .catch(displayTestError);
                },
                function() {
                    // cancelled. do nothing
                    clearTestOutput();
                }
            );
        };


        $scope.testUsingFile = function (ev) {
            loggerService.debug('[ml4kmodels] testUsingFile');
            var files = ev.currentTarget.files;
            if (files && files.length > 0) {
                var file = ev.currentTarget.files[0];
                vm.addImageFile(file);
            }
        };


        function displayTestResult(resp) {
            loggerService.debug('[ml4kmodels] prediction', resp);
            $timeout(function () {
                if (resp && resp.length > 0) {
                    if ($scope.project.type === 'regression') {
                        $scope.testoutput = resp[0];
                    }
                    else {
                        $scope.testoutput = resp[0].class_name;
                        $scope.testoutput_explanation = "with " + Math.round(resp[0].confidence) + "% confidence";
                    }
                }
                else {
                    $scope.testoutput = 'Unknown';
                    $scope.testoutput_explanation = "Test value could not be recognised";
                }
            }, 0);
        }
        function displayTestError(err) {
            loggerService.error('[ml4kmodels] model test failed', err);
            delete $scope.testoutput;

            var errId = displayAlert('errors', err.status, err.data);
            scrollToNewItem('errors' + errId);
        }


        vm.startListening = function () {
            loggerService.debug('[ml4kmodels] start listening');
            if (!$scope.listening) {
                $scope.listening = true;
                soundTrainingService.startTest(function (resp) {
                    loggerService.debug('[ml4kmodels] sound test callback', resp);
                    $scope.$apply(
                        function() {
                            $scope.testoutput = resp[0].class_name;
                            $scope.testoutput_explanation = "with " + Math.round(resp[0].confidence) + "% confidence";
                        });
                });
            }
        };
        vm.stopListening = function () {
            loggerService.debug('[ml4kmodels] stop listening');
            if ($scope.listening) {
                $scope.listening = false;
                soundTrainingService.stopTest()
                    .then(function () {
                        loggerService.debug('[ml4kmodels] stop test callback');
                        $scope.$apply(clearTestOutput);
                    })
                    .catch(function (err) {
                        loggerService.error('[ml4kmodels] Failed to stop listening', err);
                    });
            }
        };



        // an image has been dropped onto the test textbox for images
        vm.addConfirmedTrainingData = function (urlToTest) {
            $scope.testformData.testimageurl = urlToTest;
        };

        // a file has been dropped onto the test textbox for images
        vm.addImageFile = function (file) {
            imageToolsService.getDataFromFile(file)
                .then(imageTrainingService.testBase64ImageData)
                .then(displayTestResult)
                .catch(displayTestError);
        };


        function convertStringToArrayBuffer(str) {
            var buf = new Uint8Array(str.length);
            for (var i = 0; i < str.length; i++) {
                buf[i] = str.charCodeAt(i);
            }
            return buf.buffer;
        }

        vm.downloadTestData = function (ev) {
            ev.stopPropagation();
            ev.preventDefault();

            var dataToExportStr = storageService.getItem('testdata://' + $scope.project.id);
            downloadService.downloadFile([ convertStringToArrayBuffer(dataToExportStr) ], 'text/csv', 'testdata-' + $scope.project.id + '.csv');
        };




        $scope.$on("$destroy", function () {
            loggerService.debug('[ml4kmodels] handling page change');

            stopRefreshing();

            if ($scope.project) {
                if ($scope.project.type === 'sounds'){
                    if ($scope.listening) {
                        soundTrainingService.stopTest()
                            .catch(function (err) {
                                loggerService.debug('[ml4kmodels] Failed to stop listening when cleaning up the page', err);
                            });
                    }
                    soundTrainingService.reset();
                }
                else if ($scope.project.type === 'imgtfjs'){
                    imageTrainingService.reset();
                }
                else if ($scope.project.type === 'regression'){
                    regressionTrainingService.reset();
                }
            }
        });


        function scrollToNewItem(itemId) {
            $timeout(function () {
                var newItem = document.getElementById(itemId);
                $document.duScrollToElementAnimated(angular.element(newItem));
            }, 0);
        }


        function scrollToNewItem(itemId, retried) {
            $scope.$applyAsync(function () {
                var newItem = document.getElementById(itemId.toString());
                if (newItem) {
                    var itemContainer = newItem.parentElement;
                    angular.element(itemContainer).duScrollToElementAnimated(angular.element(newItem));
                }
                else if (!retried) {
                    $timeout(function () {
                        scrollToNewItem(itemId, true);
                    }, 0);
                }
                else {
                    loggerService.error('[ml4kmodels] unable to scroll to new item', itemId);
                }
            });
        }



        $scope.getController = function() {
            return vm;
        };
    }
}());
