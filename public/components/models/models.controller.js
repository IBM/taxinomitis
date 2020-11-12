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

                reviewTrainingData(values.labels);
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
                    return imageTrainingService.initImageSupport($scope.project.id, $scope.project.labels);
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



        function reviewTrainingData (labels) {
            loggerService.debug('[ml4kmodels] reviewing training data');

            var no_data = true;
            var insufficient_data = 0;
            var MIN = 5;
            if ($scope.project.type === 'images') {
                MIN = 10;
            }
            else if ($scope.project.type === 'sounds') {
                MIN = 8;
            }
            var labelslist = Object.keys(labels);

            $scope.trainingcounts = labelslist.map(function (label) {
                var count = labels[label];
                if (count > 0) {
                    no_data = false;
                }
                if (count < MIN) {
                    insufficient_data += 1;
                }
                return { label : label, count : count };
            });

            if (no_data) {
                $scope.trainingdatastatus = 'no_data';
            }
            else {
                if (insufficient_data > 1 ||
                    insufficient_data === labelslist.length ||
                    labelslist.length < 2 ||
                    ($scope.project.type === 'sounds' && insufficient_data > 0))
                {
                    $scope.trainingdatastatus = 'insufficient_data';
                }
                else {
                    $scope.trainingdatastatus = 'data';
                }
            }
        }



        var timer = null;

        function stopRefreshing() {
            loggerService.debug('[ml4kmodels] stop refreshing models');
            if (timer) {
                $interval.cancel(timer);
                timer = null;
            }
        }

        function refreshModels () {
            loggerService.debug('[ml4kmodels] refresh models');
            if (!timer) {
                var interval = 1000; // $scope.project.type === 'sounds' ? 2000 : 30000;

                timer = $interval(function () {
                    fetchModels()
                        .then(function () {
                            if ($scope.status !== 'training') {
                                stopRefreshing();
                            }
                        });
                }, interval);
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
            var modelFunction = imageTrainingService.getModels();
            // var modelFunction = $scope.project.type === 'sounds' ?
            //                         soundTrainingService.getModels() :
            //                         trainingService.getModels($scope.projectId, $scope.userId, vm.profile.tenant);
            return modelFunction.then(function (models) {
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

            if (project.type === 'sounds') {
                soundTrainingService.newModel(project.id, $scope.userId, vm.profile.tenant)
                    .then(function (newmodel) {
                        $scope.models = [ newmodel ];
                        $scope.status = modelService.getStatus($scope.models);

                        $scope.submittingTrainingRequest = false;

                        refreshModels();
                    })
                    .catch(function (err) {
                        var errId = displayAlert('errors', err.status, err.data);
                        scrollToNewItem('errors' + errId);
                    });
            }
            else if (project.type === 'imgtfjs') {
                imageTrainingService.newModel(project.id, $scope.userId, vm.profile.tenant)
                    .then(function (newmodel) {
                        $scope.models = [ newmodel ];
                        $scope.status = modelService.getStatus($scope.models);

                        $scope.submittingTrainingRequest = false;

                        refreshModels();
                    })
                    .catch(function (err) {
                        var errId = displayAlert('errors', err.status, err.data);
                        scrollToNewItem('errors' + errId);
                    });
            }
            else {
                loggerService.debug('[ml4kmodels] submitting new model request');
                trainingService.newModel(project.id, $scope.userId, vm.profile.tenant)
                    .then(function (newmodel) {
                        loggerService.debug('[ml4kmodels] model training', newmodel);

                        $scope.models = [ newmodel ];
                        $scope.status = modelService.getStatus($scope.models);

                        $scope.submittingTrainingRequest = false;

                        refreshModels();
                    })
                    .catch(function (err) {
                        loggerService.error('[ml4kmodels] model training failed', err);
                        $scope.submittingTrainingRequest = false;

                        if (createModelFailedDueToDownloadFail(err)) {
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
                                        trainingService.deleteTrainingData(project.id, $scope.userId, vm.profile.tenant, location.imageid)
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
                        else {
                            var errId = displayAlert('errors', err.status, err.data);
                            scrollToNewItem('errors' + errId);
                        }
                    });
            }
        };


        function createModelFailedDueToDownloadFail(err) {
            return err &&
                   err.status === 409 &&
                   err.data && err.data.code &&
                   (err.data.code === 'MLMOD12' || err.data.code === 'MLMOD13' || err.data.code === 'MLMOD14') &&
                   err.data.location && err.data.location.imageid && err.data.location.url &&
                   err.data.location.type === 'download';
        }


        vm.testModel = function (ev, form, project) {
            loggerService.debug('[ml4kmodels] testing model');
            var testdata = { type : project.type };

            if (project.type === 'text') {
                testdata.text = $scope.testformData.testquestion;
            }
            else if (project.type === 'images') {
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

            trainingService.testModel(project.id, project.type,
                                      $scope.userId, vm.profile.tenant,
                                      $scope.models[0].classifierid, $scope.models[0].credentialsid,
                                      testdata)
                .then(function (resp) {
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

            if (project.type === 'sounds') {
                return soundTrainingService.deleteModel(project.id)
                    .then(function () {
                        $scope.models = [];
                        $scope.status = getStatus();

                        $scope.submittingDeleteRequest = false;

                        refreshModels();
                    })
                    .catch(function (err) {
                        var errId = displayAlert('errors', err.status, err.data);
                        scrollToNewItem('errors' + errId);
                    });
            }

            var classifierid = model.classifierid;
            trainingService.deleteModel(project.id, $scope.userId, vm.profile.tenant, classifierid)
                .then(function () {
                    $scope.models = $scope.models.filter(function (md) {
                        return md.classifierid !== classifierid;
                    });
                    $scope.status = modelService.getStatus($scope.models);

                    if ($scope.status === 'training') {
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


        vm.useWebcam = function (ev, label) {
            loggerService.debug('[ml4kmodels] useWebcam');

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
                        $mdDialog.hide(getWebcamData());
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


                    function getWebcamData() {
                        loggerService.debug('[ml4kmodels] getting webcam data');

                        var hiddenCanvas = document.createElement('canvas');
                        hiddenCanvas.width = $scope.channel.video.width;
                        hiddenCanvas.height = $scope.channel.video.height;

                        loggerService.debug('[ml4kmodels] writing to hidden canvas');
                        var ctx = hiddenCanvas.getContext('2d');
                        ctx.drawImage($scope.channel.video,
                            0, 0,
                            $scope.channel.video.width, $scope.channel.video.height);

                        var imagedata = hiddenCanvas.toDataURL('image/jpeg');
                        var strippedHeaderData = imagedata.substr(imagedata.indexOf(',') + 1);
                        return strippedHeaderData;
                    };

                },
                templateUrl : 'static/components-' + $stateParams.VERSION + '/models/webcam.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (webcamimagedata) {
                    $scope.testoutput = "please wait...";
                    $scope.testoutput_explanation = "";

                    trainingService.testModel($scope.project.id, $scope.project.type,
                                              $scope.userId, vm.profile.tenant,
                                              $scope.models[0].classifierid, $scope.models[0].credentialsid,
                                              { type : $scope.project.type, data : webcamimagedata })
                        .then(function (resp) {
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
                            var errId = displayAlert('errors', err.status, err.data);
                            scrollToNewItem('errors' + errId);
                        });
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };



        vm.useCanvas = function (ev) {
            loggerService.debug('[ml4kmodels] useCanvas');

            $scope.testformData.testimageurl = '';

            $mdDialog.show({
                controller : function ($scope) {
                    $scope.hide = function() {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function() {
                        var imagedata = $scope.canvas.toDataURL('image/jpeg');
                        var strippedHeaderData = imagedata.substr(imagedata.indexOf(',') + 1);
                        $mdDialog.hide(strippedHeaderData);
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

                    trainingService.testModel($scope.project.id, $scope.project.type,
                                              $scope.userId, vm.profile.tenant,
                                              $scope.models[0].classifierid, $scope.models[0].credentialsid,
                                              { type : $scope.project.type, data : canvasimagedata })
                        .then(function (resp) {
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
                            var errId = displayAlert('errors', err.status, err.data);
                            scrollToNewItem('errors' + errId);
                        });
                },
                function() {
                    // cancelled. do nothing
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
                        $scope.$apply(
                            function() {
                                delete $scope.testoutput;
                                delete $scope.testoutput_explanation;
                            });
                    })
                    .catch(function (err) {
                        loggerService.error('[ml4kmodels] Failed to stop listening', err);
                    });
            }
        };


        vm.tempTest = function (divid) {
            imageTrainingService.testModel(divid)
                .then(function (output) {
                    $scope.temptestoutput = output;
                });
        };


        $scope.$on("$destroy", function () {
            loggerService.debug('[ml4kmodels] handling page change');

            stopRefreshing();

            if ($scope.project && $scope.project.type === 'sounds' &&
                $scope.models && $scope.models.length > 0 &&
                $scope.listening)
            {
                soundTrainingService.stopTest();
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
