(function () {

    angular
        .module('app')
        .service('modelService', modelService);

    modelService.$inject = [
        'loggerService', 'storageService', 'utilService'
    ];


    function modelService(loggerService, storageService, utilService) {

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


        function generateProjectSummary(labels, joinWord) {
            if (labels.length > 0) {
                var summary = '';
                switch (labels.length) {
                    case 1:
                        summary = labels[0];
                        break;
                    case 2:
                        summary = labels[0] + joinWord + labels[1];
                        break;
                    case 3:
                        summary = labels[0] + ', ' +
                                  labels[1] + joinWord +
                                  labels[2];
                        break;
                    default:
                        summary = labels[0] + ', ' +
                                  labels[1] + joinWord +
                                  (labels.length - 2) + ' other classes';
                        break;
                }
                return summary;
            }
        }



        function getMinimumTrainingItems(projectType) {
            if (projectType === 'sounds') {
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
                if (projectType === 'regression') {
                    if (trainingDataCountsByLabel.data < 10)
                    {
                        trainingdatastatus = 'insufficient_data';
                    }
                    else if (trainingDataCountsByLabel.outputcolumns > 0)
                    {
                        trainingdatastatus = 'data';
                    }
                    else {
                        trainingdatastatus = 'no_output_columns';
                    }
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
            }

            return {
                counts : trainingcounts,
                status : trainingdatastatus
            };
        }


        function getModelDbLocation(modeltype, projectid) {
            return 'indexeddb://ml4k-models-' +
                   modeltype + '-' +
                   projectid.toString().replace(/-/g, '');
        }

        function isModelSavedInBrowser(modeltype, projectid) {
            try {
                const type = modeltype === 'imgtfjs' ? 'images' : modeltype;
                const modelid = getModelDbLocation(type, projectid);
                if (storageService.getItem(modelid)) {
                    return true;
                }
            }
            catch (err) {
                loggerService.error('[ml4kmodels] Failed to get metadata');
            }
            return false;
        }


        function clearSupportingModelData(savelocation, modeltype, projectid) {
            loggerService.debug('[ml4kmodels] deleting supporting model data');

            if (modeltype === 'numbers') {
                storageService.removeItem('ml4k-models-numbers-' + projectid + '-features');
                storageService.removeItem('ml4k-models-numbers-' + projectid + '-labels');
                storageService.removeItem('ml4k-models-numbers-' + projectid + '-status');
                storageService.removeItem('ml4k-models-numbers-' + projectid + '-date');

                // can't delete the assets (e.g. -model and -tree) without introducing a circular dependency,
                //  so this has to be done in both numberTrainingService and ProjectsController
                //
                // browserStorageService.deleteAsset(projectid + '-model');
                // browserStorageService.deleteAsset(projectid + '-tree');
                // browserStorageService.deleteAsset(projectid + '-dot');
                // browserStorageService.deleteAsset(projectid + '-vocab');
            }
            else {
                clearModelSavedDate(savelocation);
            }

            return Promise.resolve();
        }


        function deleteModel(modeltype, projectid, retried) {
            loggerService.debug('[ml4kmodels] deleting stored model', projectid);
            var savelocation = getModelDbLocation(modeltype, projectid);
            if (modeltype === 'numbers') {
                return clearSupportingModelData(savelocation, modeltype, projectid);
            }

            if (typeof tf !== 'undefined') {
                return tf.io.removeModel(savelocation)
                    .then(function () {
                        return clearSupportingModelData(savelocation, modeltype, projectid);
                    })
                    .catch(function (err) {
                        loggerService.debug('[ml4kmodels] model could not be deleted', err);
                    });
            }
            else if (!retried) {
                return utilService.loadTensorFlow()
                    .then(function () {
                        // if tensorflow is failing to load, use a 'retried' flag
                        //  to stop us infinitely attempting to load it
                        return deleteModel(modeltype, projectid, true);
                    });
            }
            else {
                loggerService.debug('[ml4kmodels] tensorflow not loaded - skipping model deletion');
                return clearSupportingModelData(savelocation, modeltype, projectid);
            }
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
            else if (modeltype === 'numbers') {
                loadPromise = tf.loadGraphModel(savelocation);
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
                storageService.setItem(modelid, Date.now());
            }
            catch (err) {
                loggerService.error('[ml4kmodels] Failed to store model timestamp');
            }
        }

        function clearModelSavedDate(modelid) {
            try {
                storageService.removeItem(modelid);
            }
            catch (err) {
                loggerService.error('[ml4kmodels] Failed to clear model timestamp');
            }
        }

        function getModelSavedDate(modelid) {
            try {
                var timestampStr = storageService.getItem(modelid);
                if (timestampStr) {
                    return new Date(parseInt(timestampStr));
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
