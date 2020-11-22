(function () {

    angular
        .module('app')
        .controller('ModelsController', ModelsController);

    ModelsController.$inject = [
        'authService',
        'projectsService', 'trainingService', 'quizService',
        'soundTrainingService', 'imageTrainingService',
        'modelService',
        '$stateParams',
        '$scope',
        '$mdDialog', '$timeout', '$interval', '$q', '$document', '$state', 'loggerService'
    ];

    function ModelsController(authService, projectsService, trainingService, quizService, soundTrainingService, imageTrainingService, modelService, $stateParams, $scope, $mdDialog, $timeout, $interval, $q, $document, $state, loggerService) {

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
                    templateUrl : 'static/components-' + $stateParams.VERSION + '/models/errordetail.tmpl.html'
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
                message : errObj.message || errObj.error || 'Unknown error',
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


        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                return $q.all({
                    project : projectsService.getProject($scope.projectId, $scope.userId, vm.profile.tenant),
                    labels : projectsService.getLabels($scope.projectId, $scope.userId, vm.profile.tenant),
                    models : trainingService.getModels($scope.projectId, $scope.userId, vm.profile.tenant)
                });
            })
            .then(function (values) {
                $scope.project = values.project;

                $scope.owner = (vm.profile.user_id === $scope.project.userid);

                $scope.projecturls.train = '/#!/mlproject/' + $scope.project.userid + '/' + $scope.project.id + '/training';

                if (values.project.type === 'images') {
                    $scope.minimumExamples = 'ten';
                }
                else if (values.project.type === 'sounds') {
                    $scope.minimumExamples = 'eight';
                }
                $scope.models = values.models;
                $scope.projectSummary = modelService.generateProjectSummary($scope.project.labels);

                var trainingReview = modelService.reviewTrainingData(values.labels, $scope.project.type);
                $scope.trainingcounts = trainingReview.counts;
                $scope.trainingdatastatus = trainingReview.status;

                $scope.status = modelService.getStatus($scope.models);

                if ($scope.project.type === 'numbers') {
                    return projectsService.getFields($scope.projectId, $scope.userId, vm.profile.tenant);
                }
                else if ($scope.project.type === 'sounds') {
                    $scope.listening = false;
                    var loadSavedModel = true;
                    return soundTrainingService.initSoundSupport($scope.project.id, $scope.project.labels, loadSavedModel)
                        .then(function (loaded) {
                            if (loaded) {
                                fetchModels();
                            }
                        });
                }
                else if ($scope.project.type === 'imgtfjs') {
                    return imageTrainingService.initImageSupport($scope.project.id, $scope.project.labels)
                        .then(function (loaded) {
                            if (loaded) {
                                fetchModels();
                            }
                        });
                }
            })
            .then(function (fields) {
                $scope.project.fields = fields;

                $scope.loading = false;
            })
            .catch(function (err) {
                var errId = displayAlert('errors', err.status, err.data ? err.data : err);
                scrollToNewItem('errors' + errId);
            });


        var timer = null;

        function stopRefreshing() {
            loggerService.debug('[ml4kmodels] stop refreshing models');
            if (timer) {
                $interval.cancel(timer);
                timer = null;
            }
        }

        function getRefreshInterval() {
            if ($scope.project.type === 'sounds' || $scope.project.type === 'imgtfjs') {
                return 2000;
            }
            if ($scope.project.type === 'text') {
                return 20000;
            }
            if ($scope.project.type === 'images') {
                return 30000;
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
            else {
                modelFnPromise = trainingService.getModels($scope.projectId, $scope.userId, vm.profile.tenant);
            }
            return modelFnPromise.then(function (models) {
                $scope.models = models;
                $scope.status = modelService.getStatus($scope.models);
            });
        }



        vm.createModel = function (ev, project) {
            loggerService.debug('[ml4kmodels] creating model');

            // prepare the first question for displaying while
            //  the training is running
            $scope.quizQuestion = quizService.getQuestion();

            $scope.submittingTrainingRequest = true;
            clearTestOutput();

            var modelFnPromise;
            if ($scope.project.type === 'imgtfjs') {
                modelFnPromise = imageTrainingService.newModel(project.id, $scope.userId, vm.profile.tenant);
            }
            else if ($scope.project.type === 'sounds') {
                modelFnPromise = soundTrainingService.newModel(project.id, $scope.userId, vm.profile.tenant)
            }
            else {
                modelFnPromise = trainingService.newModel($scope.projectId, $scope.userId, vm.profile.tenant);
            }

            modelFnPromise.then(function (newmodel) {
                    loggerService.debug('[ml4kmodels] model training', newmodel);

                    $scope.models = [ newmodel ];
                    $scope.status = modelService.getStatus($scope.models);

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
                templateUrl : 'static/components-' + $stateParams.VERSION + '/models/downloadfail.tmpl.html'
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
            else if (project.type === 'images' || project.type === 'imgtfjs') {
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
            }
            else if (project.type === 'numbers') {
                testdata.numbers = project.fields.map(function (field) {
                    if (field.type === 'number') {
                        return parseFloat($scope.testformData[field.name]);
                    }
                    return $scope.testformData[field.name];
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
            else {
                testFnPromise = trainingService.testModel(project.id,
                    $scope.userId, vm.profile.tenant,
                    $scope.models[0].classifierid, $scope.models[0].credentialsid,
                    testdata);
            }

            testFnPromise.then(function (resp) {
                    loggerService.debug('[ml4kmodels] test response', resp);

                    if (resp && resp.length > 0) {
                        $scope.testoutput = resp[0].class_name;
                        $scope.testoutput_explanation = "with " + Math.round(resp[0].confidence) + "% confidence";
                    }
                    else {
                        $scope.testoutput = 'Unknown';
                        $scope.testoutput_explanation = "Test value could not be recognised";
                    }
                })
                .catch(function (err) {
                    loggerService.error('[ml4kmodels] model test failed', err);
                    delete $scope.testoutput;

                    var errId = displayAlert('errors', err.status, err.data);
                    scrollToNewItem('errors' + errId);
                });
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
            else {
                var classifierid = model.classifierid;
                modelFnPromise = trainingService.deleteModel(project.id, $scope.userId, vm.profile.tenant, classifierid);
            }

            modelFnPromise.then(function () {
                    $scope.models = [];
                    $scope.status = modelService.getStatus($scope.models);

                    if ($scope.status === 'training' || project.type === 'imgtfjs' || project.type === 'sounds') {
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



        var CANVAS_DATA_TYPES = {
            BASE64 : 'BASE64',
            RESIZEDCANVAS : 'RESIZEDCANVAS'
        };
        function getCanvasData(canvasElement, canvasDataType) {
            loggerService.debug('[ml4kmodels] getting canvas data for testing');
            if (canvasDataType === CANVAS_DATA_TYPES.BASE64) {
                var imagedata = canvasElement.toDataURL('image/jpeg');
                var strippedHeaderData = imagedata.substr(imagedata.indexOf(',') + 1);
                return strippedHeaderData;
            }
            else if (canvasDataType === CANVAS_DATA_TYPES.RESIZEDCANVAS) {
                var hiddenCanvas = document.createElement('canvas');
                hiddenCanvas.width = 224;
                hiddenCanvas.height = 224;

                loggerService.debug('[ml4ktraining] writing to hidden canvas');
                var ctx = hiddenCanvas.getContext('2d');
                ctx.drawImage(canvasElement,
                    0, 0,
                    canvasElement.width, canvasElement.height,
                    0, 0, 224, 224);

                return hiddenCanvas;
            }
        }
        function getWebcamData(videoElement, canvasDataType) {
            loggerService.debug('[ml4kmodels] getting webcam data for testing');

            var targetWidth, targetHeight;
            if (canvasDataType === CANVAS_DATA_TYPES.BASE64) {
                targetWidth = videoElement.videoWidth;
                targetHeight = videoElement.videoHeight;
            }
            else if (canvasDataType === CANVAS_DATA_TYPES.RESIZEDCANVAS) {
                targetWidth = 224;
                targetHeight = 224;
            }

            var hiddenCanvas = document.createElement('canvas');
            hiddenCanvas.width = targetWidth;
            hiddenCanvas.height = targetHeight;

            var ctx = hiddenCanvas.getContext('2d');
            if (canvasDataType === CANVAS_DATA_TYPES.BASE64) {
                ctx.drawImage(videoElement,
                    0, 0, videoElement.videoWidth, videoElement.videoHeight);
            }
            else if (canvasDataType === CANVAS_DATA_TYPES.RESIZEDCANVAS) {
                ctx.drawImage(videoElement,
                    0, 0, videoElement.videoWidth, videoElement.videoHeight,
                    0, 0, targetWidth, targetHeight);
            }

            if (canvasDataType === CANVAS_DATA_TYPES.BASE64) {
                var imagedata = hiddenCanvas.toDataURL('image/jpeg');
                var strippedHeaderData = imagedata.substr(imagedata.indexOf(',') + 1);
                return strippedHeaderData;
            }
            else if (canvasDataType === CANVAS_DATA_TYPES.RESIZEDCANVAS) {
                return hiddenCanvas;
            }
        }

        vm.testUsingCanvas = function (ev, isForBrowserUse) {
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
                        $mdDialog.hide(
                            getCanvasData(
                                $scope.canvas,
                                isForBrowserUse ? CANVAS_DATA_TYPES.RESIZEDCANVAS : CANVAS_DATA_TYPES.BASE64));
                    };
                },
                templateUrl : 'static/components-' + $stateParams.VERSION + '/models/canvas.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (canvasimagedata) {
                    $scope.testoutput = "please wait...";
                    $scope.testoutput_explanation = "";

                    var testPromise;
                    if (isForBrowserUse) {
                        testPromise = imageTrainingService.testCanvas(canvasimagedata);
                    }
                    else {
                        testPromise = trainingService.testModel($scope.project.id,
                                                                $scope.userId, vm.profile.tenant,
                                                                $scope.models[0].classifierid, $scope.models[0].credentialsid,
                                                                { type : $scope.project.type, data : canvasimagedata });
                    }

                    testPromise.then(function (resp) {
                            loggerService.debug('[ml4kmodels] prediction', resp);
                            $timeout(function () {
                                if (resp && resp.length > 0) {
                                    $scope.testoutput = resp[0].class_name;
                                    $scope.testoutput_explanation = "with " + Math.round(resp[0].confidence) + "% confidence";
                                }
                                else {
                                    $scope.testoutput = 'Unknown';
                                    $scope.testoutput_explanation = "Test value could not be recognised";
                                }
                            }, 0);
                        })
                        .catch(function (err) {
                            var errId = displayAlert('errors', err.status, err.data);
                            scrollToNewItem('errors' + errId);
                        });
                },
                function() {
                    // cancelled. do nothing
                    clearTestOutput();
                }
            );
        };

        vm.testUsingWebcam = function (ev, isForBrowserUse) {
            loggerService.debug('[ml4kmodels] testUsingWebcam');

            $scope.testformData.testimageurl = '';

            $mdDialog.show({
                controller : function ($scope) {
                    $scope.channel = {};
                    $scope.webcamerror = false;
                    $scope.webcamInitComplete = false;

                    $scope.webcamCanvas = null;

                    $scope.hide = function() {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function() {
                        $mdDialog.hide(
                            getWebcamData(
                                $scope.channel.video,
                                isForBrowserUse ? CANVAS_DATA_TYPES.RESIZEDCANVAS : CANVAS_DATA_TYPES.BASE64));
                    };

                    $scope.onWebcamSuccess = function () {
                        $scope.$apply(function() {
                            $scope.webcamInitComplete = true;
                        });
                    };

                    function displayWebcamError(err) {
                        loggerService.error('[ml4kmodels] display webcam error', err);

                        $scope.webcamerror = err;
                        if (err && err.message) {
                            if (err.name === 'NotAllowedError') {
                                $scope.webcamerrordetail = 'Not allowed to use the web-cam';
                            }
                            else {
                                $scope.webcamerrordetail = err.message;
                            }
                        }
                    }

                    $scope.onWebcamError = function(err) {
                        loggerService.error('[ml4kmodels] on webcam error', err);

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
                templateUrl : 'static/components-' + $stateParams.VERSION + '/models/webcam.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (webcamimagecanvas) {
                    $scope.testoutput = "please wait...";
                    $scope.testoutput_explanation = "";

                    var testPromise;
                    if (isForBrowserUse) {
                        testPromise = imageTrainingService.testCanvas(webcamimagecanvas);
                    }
                    else {
                        testPromise = trainingService.testModel($scope.project.id,
                            $scope.userId, vm.profile.tenant,
                            $scope.models[0].classifierid, $scope.models[0].credentialsid,
                            { type : $scope.project.type, data : webcamimagecanvas })
                    }

                    testPromise.then(function (resp) {
                            $timeout(function() {
                                if (resp && resp.length > 0) {
                                    $scope.testoutput = resp[0].class_name;
                                    $scope.testoutput_explanation = "with " + Math.round(resp[0].confidence) + "% confidence";
                                }
                                else {
                                    $scope.testoutput = 'Unknown';
                                    $scope.testoutput_explanation = "Test value could not be recognised";
                                }
                            }, 0);
                        })
                        .catch(function (err) {
                            var errId = displayAlert('errors', err.status, err.data);
                            scrollToNewItem('errors' + errId);
                        });
                },
                function() {
                    // cancelled. do nothing
                    clearTestOutput();
                }
            );
        };


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



        vm.changeProjectType = function (newProjectType) {
            loggerService.debug('[ml4kmodels] changing model type', newProjectType);
            if ($scope.project &&
                (($scope.project.type === 'images' && newProjectType === 'imgtfjs') ||
                 ($scope.project.type === 'imgtfjs' && newProjectType === 'images')))
            {
                $scope.loading = true;

                // remove any existing locally created models before switching to cloud-hosted models
                if ($scope.project.type === 'imgtfjs' && $scope.models && $scope.models.length > 0) {
                    imageTrainingService.deleteModel($scope.project.id)
                        .catch(function(err) {
                            loggerService.debug('[ml4kmodels] Failed to delete existing local model', err);
                        });
                }

                // request project type to be changed on the server
                projectsService.changeProjectType($scope.project.id, $scope.userId, vm.profile.tenant, newProjectType)
                    .then(function () {
                        location.reload();
                    })
                    .catch(function (err) {
                        $scope.loading = false;
                        var errId = displayAlert('errors', err.status, err.data);
                        scrollToNewItem('errors' + errId);
                    });
            }
            else {
                loggerService.error('[ml4kmodels] Invalid change request');
            }
        };



        $scope.$on("$destroy", function () {
            loggerService.debug('[ml4kmodels] handling page change');

            stopRefreshing();

            if ($scope.project && $scope.project.type === 'sounds'){
                if ($scope.listening) {
                    soundTrainingService.stopTest()
                        .catch(function (err) {
                            loggerService.debug('[ml4kmodels] Failed to stop listening when cleaning up the page', err);
                        });
                }
                soundTrainingService.reset();
            }
            else if ($scope.project && $scope.project.type === 'imgtjfs'){
                imageTrainingService.reset();
            }
        });


        function scrollToNewItem(itemId) {
            $timeout(function () {
                var newItem = document.getElementById(itemId);
                $document.duScrollToElementAnimated(angular.element(newItem));
            }, 0);
        }
    }
}());
