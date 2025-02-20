(function () {

    angular
        .module('app')
        .controller('LanguageModelController', LanguageModelController);

    LanguageModelController.$inject = [
        'authService',
        'loggerService',
        '$stateParams', '$scope',
        '$timeout'
    ];

    function LanguageModelController(authService, loggerService, $stateParams, $scope, $timeout) {
        var vm = this;
        vm.authService = authService;

        var alertId = 1;
        vm.errors = [];
        vm.warnings = [];
        vm.dismissAlert = function (type, errIdx) {
            vm[type].splice(errIdx, 1);
        };
        function displayAlert(type, status, errObj) {
            if (!errObj) {
                errObj = {};
            }
            else {
                // record the error
                loggerService.error(errObj);
                if (status === 500 && Sentry && Sentry.captureException) {
                    Sentry.captureException({ error : errObj, errortype : typeof (errObj) });
                }
            }

            vm[type].push({
                alertid : alertId++,
                message : errObj.message || errObj.error || 'Unknown error',
                status : status
            });
        }
        vm.displayAlert = displayAlert;

        $scope.loadingtraining = true;
        $scope.projectId = $stateParams.projectId;
        $scope.userId = $stateParams.userId;

        $scope.generated = 'Generated text';

        $scope.slmModels = [
            {
                id : 'SmolLM2-135M-Instruct-q0f16-MLC',
                version : 'SmolLM2',
                size : '135M',
                label : 'Smol',
                developer : 'Hugging Face',
                storage : '276 MB'
            },
            {
                id : 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC-1k',
                version : '1.0',
                size : '1.1B',
                label : 'Tiny Llama',
                developer : 'Singapore University of Technology and Design',
                storage : '625 MB'
            },
            {
                id : 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
                version : '3.2',
                size : '1B',
                label : 'Llama',
                developer : 'Meta',
                storage : '711 MB'
            },
            {
                id : 'phi-1_5-q4f16_1-MLC',
                version : '1.5',
                size : '1.3B',
                label : 'Phi',
                developer : 'Microsoft',
                storage : '806 MB'
            }
        ];


        // check that they're authenticated before doing anything else
        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                $scope.project = {
                    id : $scope.projectId
                };
            })
            .catch(function (err) {
                loggerService.error('[ml4ktraining] error', err);
                displayAlert('errors', err.status, err.data ? err.data : err);
            });

        $scope.downloadModel = function () {
            $scope.project.details.slm.download = 0;
            console.log('simulating download');
            $timeout(() => { $scope.project.details.slm.download = 33; }, 700);
            $timeout(() => { $scope.project.details.slm.download = 50; }, 1200);
            $timeout(() => { $scope.project.details.slm.download = 66; }, 1700);
            $timeout(() => { $scope.project.details.slm.download = 90; }, 2300);
            $timeout(() => { $scope.project.details.slm.download = 100; }, 2900);
        };

        $scope.generateText = function (prompt) {
            $scope.generating = true;
            $scope.textgenerated = true;
            $scope.generated = '...';
            $timeout(() => {
                $scope.generated = 'Response to the prompt ' + prompt + ' will go here';
                $scope.generating = false;
            }, 1000);
        };


        $scope.getController = function () {
            return vm;
        };
    }
}());
