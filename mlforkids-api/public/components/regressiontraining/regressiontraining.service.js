(function () {

    angular
        .module('app')
        .service('regressionTrainingService', regressionTrainingService);

    regressionTrainingService.$inject = [
        'browserStorageService',
        'modelService',
        'utilService',
        'loggerService',
        '$q'
    ];

    function regressionTrainingService(browserStorageService, modelService, utilService, loggerService, $q) {

        var modelStatus;
        var model;
        var normalization;

        // TODO right values?
        const UNITS_PER_LAYER = 50;
        const LEARNING_RATE = 0.01;
        const BATCH_SIZE = 40;
        const EPOCHS = 200;
        const VALIDATION_PROPORTION = 0.2;
        const PERCENT_PER_EPOCH = 100 / EPOCHS;


        function loadTensorFlow() {
            loggerService.debug('[ml4kregress] loading tensorflow');
            return utilService.loadTensorFlow()
                .then(function () {
                    loggerService.debug('[ml4kregress] enabling tf prod mode');
                    if (tf && tf.enableProdMode) {
                        tf.enableProdMode();
                        loggerService.debug('[ml4kregress] tfjs version', tf.version);
                    }
                })
                .catch(function (err) {
                    loggerService.error('[ml4kregress] failed to load tensorflow', err);
                    throw err;
                });
        }


        function initRegressionSupport (project) {
            return loadTensorFlow()
                .then(function () {
                    if (project.normalization) {
                        // we have previously stored a model - see if we can
                        //  restore it
                        return modelService.loadModel(MODELTYPE, project.id);
                    }
                })
                .then(function (loadedModel) {
                    if (loadedModel) {
                        normalization = {
                            mean : tf.tensor(project.normalization.mean),
                            standardDeviation : tf.tensor(project.normalization.standardDeviation)
                        };
                        model = loadedModel.output;
                        modelStatus = {
                            classifierid : project.id,
                            status : 'Available',
                            progress : 100,
                            updated : loadedModel.timestamp
                        };
                        return modelStatus;
                    }
                })
                .catch(function (err) {
                    loggerService.error('[ml4kregress] failed to load model', err);
                    model = null;
                    modelStatus = null;
                    normalization = null;
                    throw err;
                });
        }

        var MODELTYPE = 'regression';

        function deleteModel(projectid) {
            modelStatus = null;
            return modelService.deleteModel(MODELTYPE, projectid)
                .then(function () {
                    return browserStorageService.addMetadataToProject(projectid, 'normalization', null);
                });
        }

        function saveModel(projectid) {
            return modelService.saveModel(MODELTYPE, projectid, model);
        }

        function getModels() {
            loggerService.debug('[ml4kregress] get models');
            return $q(function (resolve) {
                if (modelStatus) {
                    modelStatus.lastPollTime = new Date();
                    resolve([ modelStatus ]);
                }
                else {
                    resolve([]);
                }
            });
        }


        function defineModel (numInputFeatures, numOutputs) {
            const regressionModel = tf.sequential();
            regressionModel.add(
                tf.layers.dense({
                    inputShape : [ numInputFeatures ],
                    units : UNITS_PER_LAYER,
                    activation : 'sigmoid',
                    kernelInitializer: 'leCunNormal'
                })
            );
            regressionModel.add(
                tf.layers.dense({
                    units : UNITS_PER_LAYER,
                    activation : 'sigmoid',
                    kernelInitializer : 'leCunNormal'
                })
            );
            regressionModel.add(
                tf.layers.dense({
                    units : numOutputs
                })
            );
            regressionModel.compile({
                optimizer : tf.train.sgd(LEARNING_RATE),
                loss : 'meanSquaredError'
            });
            return regressionModel;
        }


        function newModel (project) {
            loggerService.debug('[ml4kregress] creating new ML model');

            modelStatus = {
                classifierid : project.id,
                status : 'Training',
                progress : 0,
                updated : new Date()
            };

            return browserStorageService.getTrainingData(project.id)
                .then(function (training) {
                    // separate out columns into input and output values
                    const inputColumns = project.columns
                        .filter(function (col) { return col.output === false; })
                        .map(function (col) { return col.label; });
                    const targetColumns = project.columns
                        .filter(function (col) { return col.output === true; })
                        .map(function (col) { return col.label; });

                    // turn array of JSON objects into array of raw numbers
                    const inputFeatures = [];
                    const targetFeatures = [];
                    for (let i = 0; i < training.length; i++) {
                        const trainingitem = training[i];
                        inputFeatures.push(inputColumns.map(function (col) { return trainingitem[col]; }));
                        targetFeatures.push(targetColumns.map(function (col) { return trainingitem[col]; }));
                    }

                    // normalize the input
                    const inputFeaturesTensor = tf.tensor2d(inputFeatures);
                    const mean = inputFeaturesTensor.mean(0);
                    const standardDeviation = inputFeaturesTensor
                        .sub(mean)
                        .square()
                        .mean(0)
                        .sqrt();
                    normalization = { mean, standardDeviation };
                    const normalisedInputFeatures = inputFeaturesTensor
                        .sub(normalization.mean)
                        .div(normalization.standardDeviation);

                    // save the mean and std dev so they can be used in testing
                    browserStorageService.addMetadataToProject(project.id, 'normalization', {
                        mean : normalization.mean.arraySync(),
                        standardDeviation : normalization.standardDeviation.arraySync()
                    });

                    // create the model
                    model = defineModel(inputColumns.length, targetColumns.length);

                    // train the model
                    model.fit(normalisedInputFeatures, tf.tensor2d(targetFeatures), {
                        batchSize : BATCH_SIZE,
                        epochs : EPOCHS,
                        validationSplit : VALIDATION_PROPORTION,
                        callbacks: {
                            onEpochEnd : (epoch, logs) => {
                                loggerService.debug('[ml4kregress] epoch ' + epoch + ' loss ' + logs.loss);
                                if (modelStatus) {
                                    modelStatus.progress = (epoch + 1) * PERCENT_PER_EPOCH;
                                }
                            },
                            onTrainEnd : function () {
                                return saveModel(project.id)
                                    .then(function () {
                                        loggerService.debug('[ml4kregress] training complete');
                                        if (modelStatus) {
                                            modelStatus.status = 'Available';
                                            modelStatus.progress = 100;
                                        }
                                    });
                            }
                        }
                    });

                    return modelStatus;
                })
                .catch(function (err) {
                    loggerService.error('[ml4kregress] model training failure', err);

                    if (modelStatus) {
                        modelStatus.status = 'Failed';
                        modelStatus.updated = new Date();
                        modelStatus.error = err;
                    }

                    return modelStatus;
                });
        }


        function testModel (project, testdata) {
            var testTensor = tf.tidy(function () {
                const inputValues = project.columns
                    .filter(function (col) { return col.output === false; })
                    .map(function (col) {
                        return testdata[col.label];
                    });
                const inputTensor = tf.tensor2d([ inputValues ]);
                const normalisedInputValues = inputTensor
                    .sub(normalization.mean)
                    .div(normalization.standardDeviation);
                return normalisedInputValues;
            });
            var modelOutput = model.predict(testTensor);
            return modelOutput.data()
                .then(function (output) {
                    const targetColumns = project.columns
                        .filter(function (col) { return col.output === true; });

                    if (output.length !== targetColumns.length) {
                        loggerService.error('[ml4kregress] unexpected output from model', output);
                        throw new Error('Unexpected output from model');
                    }

                    var labelledOutput = {};
                    targetColumns.forEach(function (col, idx) {
                        labelledOutput[col.label] = output[idx];
                    });
                    return [ labelledOutput ];
                })
                .catch(function (err) {
                    loggerService.error('[ml4kregress] failed to run test', err);
                    throw err;
                });
        }


        function reset() {
            try {
                if (model) {
                    tf.dispose(model);
                    model = null;
                }
                modelStatus = null;
                normalization = null;
            }
            catch (err) {
                loggerService.debug('[ml4kregress] error when disposing of models', err);
            }
        }


        return {
            initRegressionSupport : initRegressionSupport,
            newModel : newModel,
            deleteModel : deleteModel,
            getModels : getModels,
            testModel : testModel,
            reset : reset
        };
    }
})();
