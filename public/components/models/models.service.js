(function () {

    angular
        .module('app')
        .service('modelService', modelService);

    modelService.$inject = [
        'loggerService',
        '$window'
    ];


    function modelService(loggerService, $window) {

        function sortByConfidence(a, b) {
            if (a.confidence < b.confidence) {
                return 1;
            }
            else if (a.confidence > b.confidence) {
                return -1;
            }
            else {
                return 0;
            }
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

        function getStatus(models) {
            if (allModelsAreTraining(models)) {
                return 'training';
            }
            if (allModelsAreGood(models)) {
                return 'ready';
            }
            if (models.length === 0) {
                return 'idle';
            }
            return 'error';
        }


        function generateProjectSummary(labels) {
            if (labels.length > 0) {
                var summary = '';
                switch (labels.length) {
                    case 1:
                        summary = labels[0];
                        break;
                    case 2:
                        summary = labels[0] + ' or ' + labels[1];
                        break;
                    case 3:
                        summary = labels[0] + ', ' +
                                  labels[1] + ' or ' +
                                  labels[2];
                        break;
                    default:
                        summary = labels[0] + ', ' +
                                  labels[1] + ' or ' +
                                  (labels.length - 2) + ' other classes';
                        break;
                }
                return summary;
            }
        }



        function getMinimumTrainingItems(projectType) {
            if (projectType === 'images') {
                return 10;
            }
            else if (projectType === 'sounds') {
                return 8;
            }
            else {
                return 5;
            }
        }


        function reviewTrainingData(trainingDataCountsByLabel, projectType) {
            var no_data = true;
            var insufficient_data = 0;
            var MIN = getMinimumTrainingItems(projectType);

            var labelslist = Object.keys(trainingDataCountsByLabel);

            var trainingcounts = labelslist.map(function (label) {
                var count = trainingDataCountsByLabel[label];
                if (count > 0) {
                    no_data = false;
                }
                if (count < MIN) {
                    insufficient_data += 1;
                }
                return { label : label, count : count };
            });

            var trainingdatastatus;
            if (no_data) {
                trainingdatastatus = 'no_data';
            }
            else {
                if (insufficient_data > 1 ||
                    insufficient_data === labelslist.length ||
                    labelslist.length < 2 ||
                    (projectType === 'sounds' && insufficient_data > 0))
                {
                    trainingdatastatus = 'insufficient_data';
                }
                else {
                    trainingdatastatus = 'data';
                }
            }

            return {
                counts : trainingcounts,
                status : trainingdatastatus
            };
        }


        function getModelDbLocation(modeltype, projectid) {
            return 'indexeddb://ml4k-models-' +
                   modeltype + '-' +
                   projectid.replaceAll('-', '');
        }

        function isModelSavedInBrowser(modeltype, projectid) {
            try {
                if ($window.localStorageObj) {
                    var modelid = getModelDbLocation(modeltype, projectid);
                    if ($window.localStorageObj.getItem(modelid)) {
                        return true;
                    }
                }
            }
            catch (err) {
                loggerService.error('[ml4kmodels] Failed to get metadata');
            }
            return false;
        }

        function deleteModel(modeltype, projectid) {
            loggerService.debug('[ml4kmodels] deleting stored model', projectid);
            var savelocation = getModelDbLocation(modeltype, projectid);
            return tf.io.removeModel(savelocation)
                .then(function () {
                    loggerService.debug('[ml4kmodels] model deleted');
                    clearModelSavedDate(savelocation);
                })
                .catch(function (err) {
                    loggerService.debug('[ml4kmodels] model could not be deleted', err);
                });
        }

        function saveModel(modeltype, projectid, transfermodel) {
            loggerService.debug('[ml4kmodels] saving model to browser storage');
            var savelocation = getModelDbLocation(modeltype, projectid);
            return transfermodel.save(savelocation)
                .then(function (saveresults) {
                    loggerService.debug('[ml4kmodels] saved model', savelocation, saveresults);
                    storeModelSavedDate(savelocation);
                })
                .catch(function (err) {
                    loggerService.error('[ml4kmodels] failed to save model', err);
                });
        }

        function loadModel(modeltype, projectid, transfermodel) {
            loggerService.debug('[ml4kmodels] loading model from browser storage');
            var savelocation = getModelDbLocation(modeltype, projectid);
            var loadPromise;
            if (transfermodel) {
                loadPromise = transfermodel.load(savelocation);
            }
            else {
                loadPromise = tf.loadLayersModel(savelocation);
            }
            return loadPromise.then(function (loadoutput) {
                    return {
                        output : loadoutput,
                        timestamp : getModelSavedDate(savelocation)
                    };
                })
                .catch(function (err) {
                    loggerService.debug('[ml4kmodels] Failed to load model', err);
                });
        }

        function storeModelSavedDate(modelid) {
            try {
                if ($window.localStorageObj) {
                    $window.localStorageObj.setItem(modelid, Date.now());
                }
            }
            catch (err) {
                loggerService.error('[ml4kmodels] Failed to store model timestamp');
            }
        }

        function clearModelSavedDate(modelid) {
            try {
                if ($window.localStorageObj) {
                    $window.localStorageObj.removeItem(modelid);
                }
            }
            catch (err) {
                loggerService.error('[ml4kmodels] Failed to store model timestamp');
            }
        }

        function getModelSavedDate(modelid) {
            try {
                if ($window.localStorageObj) {
                    var timestampStr = $window.localStorageObj.getItem(modelid);
                    if (timestampStr) {
                        return new Date(parseInt(timestampStr));
                    }
                }
            }
            catch (err) {
                loggerService.error('[ml4kmodels] Failed to get metadata');
            }
            return new Date();
        }


        return {
            sortByConfidence : sortByConfidence,
            getStatus : getStatus,
            generateProjectSummary : generateProjectSummary,
            reviewTrainingData : reviewTrainingData,
            saveModel : saveModel,
            loadModel : loadModel,
            deleteModel : deleteModel,
            isModelSavedInBrowser : isModelSavedInBrowser
        };
    }
})();
