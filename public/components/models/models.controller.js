(function () {

    angular
        .module('app')
        .controller('ModelsController', ModelsController);

    ModelsController.$inject = [
        'authService',
        'projectsService', 'trainingService', 'quizService',
        '$stateParams',
        '$scope', '$interval', '$q'
    ];

    function ModelsController(authService, projectsService, trainingService, quizService, $stateParams, $scope, $interval, $q) {

        var vm = this;
        vm.authService = authService;


        var alertId = 1;
        vm.errors = [];
        vm.warnings = [];
        vm.dismissAlert = function (type, errIdx) {
            vm[type].splice(errIdx, 1);
        };
        function displayAlert(type, status, errObj) {
            vm[type].push({
                alertid : alertId++,
                message : errObj.message || errObj.error || 'Unknown error',
                status : status
            });
        }

        $scope.loading = true;
        $scope.status = 'unknown';
        $scope.projectId = $stateParams.projectId;
        $scope.minimumExamples = 'five';
        $scope.testformData = {};

        $scope.quizQuestion = quizService.getQuestion();


        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                return $q.all({
                    project : projectsService.getProject($scope.projectId, vm.profile.user_id, vm.profile.tenant),
                    labels : projectsService.getLabels($scope.projectId, vm.profile.user_id, vm.profile.tenant),
                    models : trainingService.getModels($scope.projectId, vm.profile.user_id, vm.profile.tenant)
                });
            })
            .then(function (values) {
                $scope.project = values.project;
                if (values.project.type === 'images') {
                    $scope.minimumExamples = 'ten';
                }
                $scope.models = values.models;
                $scope.projectSummary = generateProjectSummary();

                reviewTrainingData(values.labels);
                $scope.status = getStatus();

                if ($scope.project.type === 'numbers') {
                    return projectsService.getFields($scope.projectId, vm.profile.user_id, vm.profile.tenant);
                }
            })
            .then(function (fields) {
                $scope.project.fields = fields;

                $scope.loading = false;
            })
            .catch(function (err) {
                displayAlert('errors', err.status, err.data);
            });



        function reviewTrainingData (labels) {
            var no_data = true;
            var insufficient_data = 0;
            var MIN = $scope.project.type === 'images' ? 10 : 5;
            $scope.trainingcounts = Object.keys(labels).map(function (label) {
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
                if (insufficient_data > 1 || insufficient_data === Object.keys(labels).length) {
                    $scope.trainingdatastatus = 'insufficient_data';
                }
                else {
                    $scope.trainingdatastatus = 'data';
                }
            }
        }



        function getStatus() {
            if (allModelsAreTraining($scope.models)) {
                return 'training';
            }
            if (allModelsAreGood($scope.models)) {
                return 'ready';
            }
            if ($scope.models.length === 0) {
                return 'idle';
            }
            return 'error';
        }


        function allModelsAreTraining (models) {
            return models &&
                   models.length > 0 &&
                   !(models.some(function (model) { return model.status !== 'Training'; }));
        }
        function allModelsAreGood (models) {
            return models &&
                   models.length > 0 &&
                   !(models.some(function (model) { return model.status !== 'Available'; }));
        }


        var timer = null;

        function refreshModels () {
            if (!timer) {
                timer = $interval(function () {
                    fetchModels()
                        .then(function () {
                            if ($scope.status !== 'training') {
                                $interval.cancel(timer);
                            }
                        });
                }, 30000);
            }
        }

        function allAnswersAreCorrect (answers) {
            return !(answers.some(function (answer) { return answer.selected !== answer.correct; }));
        }

        vm.checkQuizAnswers = function (quizQuestion) {
            $scope.answered = true;
            $scope.answerCorrect = allAnswersAreCorrect(quizQuestion.answers);

            if ($scope.answerCorrect === false) {
                quizQuestion.answers.forEach(function (answer) {
                    answer.selected = answer.correct;
                });
            }
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
            return trainingService.getModels($scope.projectId, vm.profile.user_id, vm.profile.tenant)
                .then(function (models) {
                    $scope.models = models;
                    $scope.status = getStatus();
                });
        }



        vm.createModel = function (ev, project) {
            $scope.submittingTrainingRequest = true;
            trainingService.newModel(project.id, vm.profile.user_id, vm.profile.tenant)
                .then(function (newmodel) {
                    $scope.models = [ newmodel ];
                    $scope.status = getStatus();

                    $scope.submittingTrainingRequest = false;

                    refreshModels();
                })
                .catch(function (err) {
                    $scope.submittingTrainingRequest = false;

                    displayAlert('errors', err.status, err.data);
                });
        };


        vm.testModel = function (ev, form, project) {
            var testdata = { type : project.type };

            if (project.type === 'text') {
                testdata.text = $scope.testformData.testquestion;
            }
            else if (project.type === 'images') {
                testdata.image = $scope.testformData.testimageurl;
            }
            else if (project.type === 'numbers') {
                testdata.numbers = project.fields.map(function (field) {
                    if (field.type === 'number') {
                        return parseFloat($scope.testformData[field.name]);
                    }
                    return $scope.testformData[field.name];
                });
            }

            $scope.testoutput = "please wait...";
            $scope.testoutput_explanation = "";

            trainingService.testModel(project.id, project.type,
                                      vm.profile.user_id, vm.profile.tenant,
                                      $scope.models[0].classifierid, $scope.models[0].credentialsid,
                                      testdata)
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
                    displayAlert('errors', err.status, err.data);
                });
        };




        vm.deleteModel = function (ev, project, model) {
            var classifierid = model.classifierid;
            trainingService.deleteModel(project.id, vm.profile.user_id, vm.profile.tenant, classifierid)
                .then(function () {
                    $scope.models = $scope.models.filter(function (md) {
                        return md.classifierid !== classifierid;
                    });
                    $scope.status = getStatus();

                    if ($scope.status !== 'training' && timer) {
                        $timeout.cancel(timer);
                        timer = null;
                    }
                    else if ($scope.status === 'training' && !timer) {
                        refreshModels();
                    }
                })
                .catch(function (err) {
                    displayAlert('errors', err.status, err.data);
                });
        };



        $scope.$on("$destroy", function(evt) {
            if (timer) {
                $interval.cancel( timer );
                timer = null;
            }
        });


        function generateProjectSummary() {
            if ($scope.project.labels.length > 0) {
                var summary = '';
                switch ($scope.project.labels.length) {
                    case 1:
                        summary = $scope.project.labels[0];
                        break;
                    case 2:
                        summary = $scope.project.labels[0] + ' or ' + $scope.project.labels[1];
                        break;
                    case 3:
                        summary = $scope.project.labels[0] + ', ' +
                                    $scope.project.labels[1] + ' or ' +
                                    $scope.project.labels[2];
                        break;
                    default:
                        summary = $scope.project.labels[0] + ', ' +
                                    $scope.project.labels[1] + ' or ' +
                                    ($scope.project.labels.length - 2) + ' other classes';
                        break;
                }
                return summary;
            }
        }

    }

}());
