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

        var resetting = false;

        var modelStatus;
        var model;
        var normalization;

        // TODO right values?
        const UNITS_PER_LAYER = 50;
        const LEARNING_RATE = 0.01;
        const BATCH_SIZE = 40;
        // this number is referred to (as the final epoch 199) in public/components/describeregression/describemodel.html
        //  update the explanation if this is changed
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
                    utilService.logTfjsMemory('initRegressionSupport');
                    if (project.normalization) {
                        // we have previously stored a model - see if we can
                        //  restore it
                        return modelService.loadModel(MODELTYPE, project.id);
                    }
                })
                .then(function (loadedModel) {
                    if (loadedModel) {
                        if (project.normalization.mean) {
                            // only normalization for input is available (models trained before December 2025)
                            normalization = {
                                input : {
                                    mean : tf.tensor(project.normalization.mean),
                                    standardDeviation : tf.tensor(project.normalization.standardDeviation)
                                }
                            };
                        }
                        else {
                            normalization = {
                                input : {
                                    mean : tf.tensor(project.normalization.input.mean),
                                    standardDeviation : tf.tensor(project.normalization.input.standardDeviation)
                                },
                                output : {
                                    mean : tf.tensor(project.normalization.output.mean),
                                    standardDeviation : tf.tensor(project.normalization.output.standardDeviation)
                                }
                            };
                        }
                        model = loadedModel.output;
                        modelStatus = {
                            classifierid : project.id,
                            status : 'Available',
                            progress : 100,
                            updated : loadedModel.timestamp
                        };
                        utilService.logTfjsMemory('loaded model');
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
                })
                .then(function () {
                    return browserStorageService.deleteAsset(projectid + '-history');
                })
                .catch(function (err) {
                    loggerService.debug('[ml4kregress] error deleting training history', err);
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


        function normalizeFeatures(features) {
            return tf.tidy(() => {
                const featuresTensor = tf.tensor2d(features);
                const mean = featuresTensor.mean(0);
                const standardDeviation = featuresTensor
                    .sub(mean)
                    .square()
                    .mean(0)
                    .sqrt();

                const normalizedFeatures = featuresTensor
                    .sub(mean)
                    .div(standardDeviation);

                return {
                    mean: mean.clone(),
                    standardDeviation: standardDeviation.clone(),
                    features: normalizedFeatures.clone()
                };
            });
        }


        function newModel (project) {
            loggerService.debug('[ml4kregress] creating new ML model');
            utilService.logTfjsMemory('newModel');

            resetting = false;

            var trainingHistory = {
                epochs: [],
                trainingLoss: [],
                validationLoss: [],
                // store this in case we start varying model definition
                //  for resource constrained devices
                parameters: {
                    epochs: EPOCHS,
                    batchSize: BATCH_SIZE,
                    learningRate: LEARNING_RATE,
                    validationSplit: VALIDATION_PROPORTION,
                    unitsPerLayer: UNITS_PER_LAYER
                }
            };

            modelStatus = {
                classifierid : project.id,
                status : 'Training',
                progress : 0,
                updated : new Date()
            };

            return browserStorageService.getTrainingData(project.id)
                .then(function (training) {
                    // separate out columns into input and output values
                    //  keep only numeric columns (for now)
                    const inputColumns = project.columns
                        .filter(function (col) { return col.type === 'number' && col.output === false; })
                        .map(function (col) { return col.label; });
                    const targetColumns = project.columns
                        .filter(function (col) { return col.type === 'number' && col.output === true; })
                        .map(function (col) { return col.label; });

                    // turn array of JSON objects into array of raw numbers
                    const inputFeatures = [];
                    const targetFeatures = [];
                    for (let i = 0; i < training.length; i++) {
                        const trainingitem = training[i];
                        let skip = false;

                        const inputFeature = inputColumns.map(function (col) {
                            const num = trainingitem[col];
                            if (isNaN(num)) {
                                skip = true;
                            }
                            return num;
                        });
                        const targetFeature = targetColumns.map(function (col) {
                            const num = trainingitem[col];
                            if (isNaN(num)) {
                                skip = true;
                            }
                            return num;
                        });

                        if (skip) {
                            loggerService.error('[ml4kregress] skipping non-numeric training data', trainingitem);
                        }
                        else {
                            inputFeatures.push(inputFeature);
                            targetFeatures.push(targetFeature);
                        }
                    }

                    // normalize the data
                    const normalizedInput = normalizeFeatures(inputFeatures);
                    const normalizedTarget = normalizeFeatures(targetFeatures);

                    // Dispose old normalization tensors if they exist
                    if (normalization) {
                        if (normalization.input) {
                            tf.dispose(normalization.input.mean);
                            tf.dispose(normalization.input.standardDeviation);
                        }
                        if (normalization.output) {
                            tf.dispose(normalization.output.mean);
                            tf.dispose(normalization.output.standardDeviation);
                        }
                    }

                    normalization = {
                        input : {
                            mean : normalizedInput.mean,
                            standardDeviation : normalizedInput.standardDeviation
                        },
                        output : {
                            mean : normalizedTarget.mean,
                            standardDeviation : normalizedTarget.standardDeviation
                        }
                    };

                    // save the mean and std dev so they can be used in testing
                    browserStorageService.addMetadataToProject(project.id, 'normalization', {
                        input : {
                            mean : normalizedInput.mean.arraySync(),
                            standardDeviation : normalizedInput.standardDeviation.arraySync()
                        },
                        output : {
                            mean : normalizedTarget.mean.arraySync(),
                            standardDeviation : normalizedTarget.standardDeviation.arraySync()
                        }
                    });

                    // create the model
                    if (model) {
                        tf.dispose(model);
                        model = null;
                    }
                    model = defineModel(inputColumns.length, targetColumns.length);

                    // train the model
                    model.fit(normalizedInput.features, normalizedTarget.features, {
                        batchSize : BATCH_SIZE,
                        epochs : EPOCHS,
                        validationSplit : VALIDATION_PROPORTION,
                        callbacks: {
                            onEpochEnd : (epoch, logs) => {
                                loggerService.debug('[ml4kregress] epoch ' + epoch + ' loss ' + logs.loss);

                                trainingHistory.epochs.push(epoch);
                                trainingHistory.trainingLoss.push(logs.loss);
                                trainingHistory.validationLoss.push(logs.val_loss);

                                if (modelStatus) {
                                    modelStatus.progress = (epoch + 1) * PERCENT_PER_EPOCH;
                                }
                            },
                            onTrainEnd : function () {
                                tf.dispose(normalizedInput.features);
                                tf.dispose(normalizedTarget.features);

                                if (!resetting) {
                                    utilService.logTfjsMemory('model trained');

                                    return saveModel(project.id)
                                        .then(function () {
                                            return browserStorageService.storeAssetData(
                                                project.id + '-history',
                                                trainingHistory
                                            );
                                        })
                                        .then(function () {
                                            loggerService.debug('[ml4kregress] training complete');
                                            if (modelStatus) {
                                                modelStatus.status = 'Available';
                                                modelStatus.progress = 100;
                                            }
                                        });
                                }
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
            const testModelOutput = tf.tidy(() => {
                const inputValues = project.columns
                    .filter(function (col) { return col.type === 'number' && col.output === false; })
                    .map(function (col) {
                        return testdata[col.label];
                    });

                const inputTensor = tf.tensor2d([ inputValues ]);
                const normalisedInputValues = inputTensor
                    .sub(normalization.input.mean)
                    .div(normalization.input.standardDeviation);

                let modelOutput = model.predict(normalisedInputValues);

                if (normalization.output) {
                    modelOutput = modelOutput
                        .mul(normalization.output.standardDeviation)
                        .add(normalization.output.mean);
                }

                return modelOutput.clone();
            });

            return testModelOutput.data()
                .then(function (output) {
                    const targetColumns = project.columns
                        .filter(function (col) { return col.type === 'number' && col.output === true; });

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
                })
                .finally(function () {
                    tf.dispose(testModelOutput);
                });
        }


        function reset() {
            try {
                resetting = true;

                if (model) {
                    model.stopTraining = true;
                    tf.dispose(model);
                    model = null;
                }
                if (normalization) {
                    if (normalization.input) {
                        tf.dispose(normalization.input.mean);
                        tf.dispose(normalization.input.standardDeviation);
                    }
                    if (normalization.output) {
                        tf.dispose(normalization.output.mean);
                        tf.dispose(normalization.output.standardDeviation);
                    }
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
