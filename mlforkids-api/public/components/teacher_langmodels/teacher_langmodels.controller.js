(function () {

    angular
        .module('app')
        .controller('TeacherLangModelsController', TeacherLangModelsController);

    TeacherLangModelsController.$inject = [
        'languageModelService', 'utilService', 'loggerService',
        '$scope', '$q'
    ];

    function TeacherLangModelsController(languageModelService, utilService, loggerService, $scope, $q) {

        $scope.loading = true;
        $scope.models = [];
        $scope.webllm = undefined;
        $scope.webllmEngine = undefined;
        $scope.error = undefined;
        $scope.downloadInProgress = false;
        $scope.downloadAllInProgress = false;
        $scope.publicAccessUrl = window.location.origin + '/teacher/languagemodels';

        function formatBytes(bytes) {
            if (!bytes) {
                return '0 MB';
            }

            const mb = bytes / (1024 * 1024);
            if (mb >= 1024) {
                return (mb / 1024).toFixed(1) + ' GB';
            }
            return Math.max(0.1, mb).toFixed(1) + ' MB';
        }

        function clearError() {
            $scope.error = undefined;
        }

        function setError(err, fallbackMessage) {
            loggerService.error('[ml4klanguage]', err);
            $scope.error = (err && err.message) ? err.message : fallbackMessage;
        }

        function resolve(promiseLike) {
            return $q.when(promiseLike);
        }

        function updateTotalCachedStorage() {
            const totalCachedBytes = $scope.models.reduce((total, model) => total + (model.cachedBytes || 0), 0);
            $scope.totalCachedBytes = totalCachedBytes;
            $scope.totalCachedStorage = formatBytes(totalCachedBytes);
        }

        function refreshModelCacheUsage(model) {
            if (!$scope.webllm) {
                model.cachedBytes = 0;
                model.cachedStorage = '0 MB';
                updateTotalCachedStorage();
                return $q.resolve();
            }

            model.refreshing = true;

            return resolve(languageModelService.getModelCacheUsage($scope.webllm, model.id))
                .then((cachedBytes) => {
                    model.cachedBytes = cachedBytes;
                    model.cachedStorage = formatBytes(cachedBytes);
                    updateTotalCachedStorage();
                })
                .catch((err) => {
                    model.cachedBytes = 0;
                    model.cachedStorage = '0 MB';
                    updateTotalCachedStorage();
                    loggerService.error('[ml4klanguage] Failed to inspect cache', model.id, err);
                })
                .finally(() => {
                    model.refreshing = false;
                });
        }

        function refreshAllModelCacheUsage() {
            return $q.all($scope.models.map((model) => refreshModelCacheUsage(model)));
        }

        function initialiseWebLlm() {
            return resolve(utilService.loadWebLlmProjectSupport())
                .then((webllm) => {
                    $scope.webllm = webllm;
                    $scope.webllmEngine = new webllm.MLCEngine({
                        initProgressCallback : (report) => {
                            const activeModel = $scope.models.find((model) => model.downloading);
                            if (activeModel) {
                                $scope.$applyAsync(() => {
                                    activeModel.downloadProgress = report.progress * 100;
                                });
                            }
                            loggerService.debug('[ml4klanguage] Initialising model', report.text);
                        }
                    });
                })
                .catch((err) => {
                    loggerService.error('[ml4klanguage] Unable to load WebLLM support', err);
                    $scope.webllm = undefined;
                    $scope.webllmEngine = undefined;
                });
        }

        function initialisePage() {
            clearError();

            return resolve(languageModelService.getAllModelsWithSupport())
                .then((models) => {
                    $scope.models = models
                        .slice()
                        .sort((modelA, modelB) => modelA.label.localeCompare(modelB.label))
                        .map((model) => angular.extend({}, model, {
                            cachedBytes : 0,
                            cachedStorage : '0 MB',
                            deleting : false,
                            downloading : false,
                            downloadProgress : 0,
                            refreshing : false
                        }));
                    updateTotalCachedStorage();
                    return initialiseWebLlm();
                })
                .then(() => {
                    return refreshAllModelCacheUsage();
                })
                .catch((err) => {
                    setError(err, 'Unable to load language model information.');
                })
                .finally(() => {
                    $scope.loading = false;
                });
        }

        function downloadSingleModel(model) {
            if (!model.supported || !$scope.webllmEngine || $scope.downloadInProgress) {
                return $q.resolve();
            }

            $scope.downloadInProgress = true;
            model.downloading = true;
            model.downloadProgress = 1;

            return resolve($scope.webllmEngine.reload(model.id))
                .then(() => {
                    loggerService.debug('[ml4klanguage] Downloaded model', model.id);
                    return refreshModelCacheUsage(model);
                })
                .catch((err) => {
                    setError(err, 'Failed to download model.');
                })
                .finally(() => {
                    model.downloading = false;
                    model.downloadProgress = 0;
                    $scope.downloadInProgress = false;
                });
        }

        $scope.downloadModel = function (model) {
            clearError();
            return downloadSingleModel(model);
        };

        $scope.downloadAllModels = function () {
            clearError();

            if (!$scope.webllmEngine || $scope.downloadInProgress || $scope.downloadAllInProgress) {
                return;
            }

            const supportedModels = $scope.models.filter((model) => model.supported);

            $scope.downloadAllInProgress = true;

            let sequence = $q.resolve();
            supportedModels.forEach((model) => {
                sequence = sequence.then(() => downloadSingleModel(model));
            });

            return sequence.finally(() => {
                $scope.downloadAllInProgress = false;
            });
        };

        $scope.deleteModel = function (model) {
            clearError();

            if (!model.supported || !$scope.webllm) {
                return;
            }

            model.deleting = true;

            return resolve(languageModelService.deleteModelCache($scope.webllm, model.id))
                .then(() => {
                    loggerService.debug('[ml4klanguage] Deleted model cache', model.id);
                    return refreshModelCacheUsage(model);
                })
                .catch((err) => {
                    setError(err, 'Failed to delete model cache.');
                })
                .finally(() => {
                    model.deleting = false;
                });
        };

        initialisePage();
    }
}());
