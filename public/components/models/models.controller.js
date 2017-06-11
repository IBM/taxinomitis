(function () {

    angular
        .module('app')
        .controller('ModelsController', ModelsController);

    ModelsController.$inject = [
        'authService',
        'projectsService', 'trainingService', 'quizService',
        '$stateParams',
        '$scope',
        '$timeout'
    ];

    function ModelsController(authService, projectsService, trainingService, quizService, $stateParams, $scope, $timeout) {

        var vm = this;
        vm.authService = authService;

        var alertId = 1;
        vm.errors = [];
        vm.warnings = [];
        vm.dismissAlert = function (type, errIdx) {
            vm[type].splice(errIdx, 1);
        };
        function displayAlert(type, errObj) {
            vm[type].push({ alertid : alertId++, message : errObj.message || errObj.error || 'Unknown error' });
        }


        function allModelsAreTraining (models) {
            return models &&
                   models.length > 0 &&
                   !(models.some(function (model) { return model.status !== 'Training'; }));
        }


        var timer = null;

        function refreshModels () {
            timer = $timeout(() => {
                fetchModels()
                    .then(() => {
                        if ($scope.displayQuiz) {
                            refreshModels();
                        }
                    });
            }, 60000);
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
                    $scope.displayQuiz = allModelsAreTraining(models);
                });
        }

        $scope.projectId = $stateParams.projectId;

        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                return projectsService.getProject($scope.projectId, profile.user_id, profile.tenant);
            })
            .then(function (project) {
                $scope.project = project;

                return fetchModels();
            })
            .then(function () {
                $scope.answered = false;
                $scope.quizQuestion = quizService.getQuestion();

                if ($scope.displayQuiz) {
                    refreshModels();
                }
            })
            .catch(function (err) {
                displayAlert('errors', err.data);
            });


        vm.createModel = function (ev, project) {
            trainingService.newModel(project.id, vm.profile.user_id, vm.profile.tenant)
                .then(function (newmodel) {
                    $scope.models = [ newmodel ];
                    return fetchModels();
                })
                .then(function () {
                    if ($scope.displayQuiz) {
                        refreshModels();
                    }
                })
                .catch(function (err) {
                    displayAlert('errors', err.data);
                });
        };

        vm.deleteModel = function (ev, project, model) {
            var classifierid = model.classifierid;
            trainingService.deleteModel(project.id, vm.profile.user_id, vm.profile.tenant, classifierid)
                .then(function () {
                    $scope.models = $scope.models.filter(function (md) {
                        return md.classifierid !== classifierid;
                    });
                    $scope.displayQuiz = allModelsAreTraining($scope.models);
                })
                .catch(function (err) {
                    displayAlert('errors', err.data);
                });
        };

    }

}());
