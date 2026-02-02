(function () {

    angular
        .module('app')
        .service('imageTrainingService', imageTrainingService);

    imageTrainingService.$inject = [
        '$q', '$location',
        'trainingService', 'modelService',
        'browserStorageService',
        'utilService', 'loggerService'
    ];

    function imageTrainingService($q, $location, trainingService, modelService, browserStorageService, utilService, loggerService) {

        var transferModel;
        var baseModel;

        var resetting = false;

        var usingRestoredModel = false;

        var modelStatus;
        var modelNumClasses;
        var modelClasses;

        var IMG_WIDTH = 224;
        var IMG_HEIGHT = 224;

        var simplified = false;



        function loadTensorFlow() {
            loggerService.debug('[ml4kimages] loading tensorflow');
            return utilService.loadTensorFlow()
                .then(function () {
                    loggerService.debug('[ml4kimages] enabling tf prod mode');
                    if (tf && tf.enableProdMode) {
                        tf.enableProdMode();
                        loggerService.debug('[ml4kimages] tfjs version', tf.version);
                    }
                })
                .catch(function (err) {
                    loggerService.error('[ml4kimages] failed to load tensorflow', err);
                    throw err;
                });
        }

        function prepareMobilenet() {
            loggerService.debug('[ml4kimages] preparing mobilenet for transfer learning');
            var siteUrl = $location.protocol() + '://' + $location.host();
            if ($location.port()) {
                siteUrl = siteUrl + ':' + $location.port();
            }
            var BASE_MODEL = siteUrl + '/static/bower_components/tensorflow-models/image-recognition/model.json';
            return tf.loadLayersModel(BASE_MODEL)
                .then(function (pretrainedModel) {
                    var activationLayer = pretrainedModel.getLayer('conv_pw_13_relu');
                    return tf.model({
                        inputs : pretrainedModel.inputs,
                        outputs: activationLayer.output
                    });
                })
                .catch(function (err) {
                    loggerService.error('[ml4kimages] failed to prepare mobilenet', err);
                    throw err;
                });
        }

        function prepareTransferLearningModel(modifiedMobilenet, numClasses) {
            if (simplified) {
                loggerService.debug('[ml4kimages] creating simplified transfer learning model');

                var model = tf.sequential({
                    layers : [
                        tf.layers.flatten({
                            inputShape : modifiedMobilenet.outputs[0].shape.slice(1)
                        }),
                        tf.layers.dense({
                            units : numClasses,
                            activation : 'softmax',
                            kernelInitializer : 'varianceScaling',
                            useBias : false
                        })
                    ]
                });

                loggerService.debug('[ml4kimages] compiling simplified model');
                model.compile({
                    optimizer : tf.train.sgd(0.001),
                    loss : 'categoricalCrossentropy'
                });

                return model;
            }
            else {
                loggerService.debug('[ml4kimages] creating transfer learning model');

                var model = tf.sequential({
                    layers : [
                        tf.layers.flatten({
                            inputShape : modifiedMobilenet.outputs[0].shape.slice(1)
                        }),
                        tf.layers.dense({
                            units : 100,
                            activation : 'relu',
                            kernelInitializer : 'varianceScaling',
                            useBias : true
                        }),
                        tf.layers.dense({
                            units : numClasses,
                            activation : 'softmax',
                            kernelInitializer : 'varianceScaling',
                            useBias : false
                        })
                    ]
                });

                loggerService.debug('[ml4kimages] compiling model');
                model.compile({
                    optimizer : tf.train.adam(0.0001),
                    loss : 'categoricalCrossentropy'
                });

                return model;
            }
        }




        function initImageSupport(projectid, projectLabels) {
            loggerService.debug('[ml4kimages] initialising image model support', projectid);
            modelNumClasses = projectLabels.length;
            modelClasses = projectLabels;
            return loadTensorFlow()
                .then(function () {
                    utilService.logTfjsMemory('initImageSupport');
                    return prepareMobilenet();
                })
                .then(function (preparedBaseModel) {
                    baseModel = preparedBaseModel;

                    return loadModel(projectid);
                })
                .then(function (loadedmodel) {
                    if (loadedmodel) {
                        transferModel = loadedmodel;
                        return modelStatus;
                    }
                    else {
                        transferModel = prepareTransferLearningModel(baseModel, modelNumClasses);
                    }
                });
        }


        function getModels() {
            loggerService.debug('[ml4kimages] get models');
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

        function getTensorForImageData(imgdata, imgmetadata) {
            return $q(function (resolve, reject) {
                var imgDataBlob = URL.createObjectURL(new Blob([imgdata]));

                var hiddenImg = document.createElement('img');
                hiddenImg.width = IMG_WIDTH;
                hiddenImg.height = IMG_HEIGHT;
                hiddenImg.onerror = function (err) {
                    loggerService.error('[ml4kimages] Failed to load image', imgmetadata);
                    return reject(err);
                };
                hiddenImg.onload = function () {
                    var imageData;
                    try {
                        imageData = tf.tidy(function () {
                            return tf.browser.fromPixels(hiddenImg)
                                        .expandDims(0)
                                        .toFloat()
                                        .div(127)
                                        .sub(1);
                        });
                    }
                    catch (err) {
                        loggerService.error('[ml4kimages] Failed to create image tensor', imgmetadata);
                        return reject(err);
                    }

                    const imgid = imgmetadata ? imgmetadata.id : 'test';
                    loggerService.debug('[ml4kimages] tensor image data ' + imgid + ' ' +
                        imageData.size + ' (' + imageData.dtype + ')');

                    resolve({ metadata : imgmetadata, data : imageData });

                    URL.revokeObjectURL(imgDataBlob);
                };

                hiddenImg.src = imgDataBlob;
            });
        }


        // Create a generator that will yield a new training example on each next()
        //  This is helpful for mobile devices that cannot hold the entire training
        //  set in memory at once, as TensorFlow can fetch a batch at a time. The
        //  benefit of this approach is that the memory requirements are greatly
        //  reduced, especially for large training sets.
        //  The downside is that tensors will need to be prepared for each training
        //  example for every epoch. This makes training takes much longer.
        function createTrainingDataset(traininginfo, getImageDataFn) {
            const BATCH_SIZE = 20;

            async function* dataGenerator() {
                for (let i = 0; i < traininginfo.length; i++) {
                    const imageInfo = traininginfo[i];

                    const imageData = await Promise.resolve(getImageDataFn(imageInfo));
                    const xs = tf.tidy(() => baseModel.predict(imageData.data));
                    imageData.data.dispose();

                    const labelIdx = modelClasses.indexOf(imageData.metadata.label);
                    const ys = tf.tidy(() =>
                        tf.oneHot(tf.tensor1d([labelIdx]).toInt(), modelNumClasses)
                    );


                    yield { xs, ys };
                }
            }

            return tf.data.generator(dataGenerator).batch(BATCH_SIZE);
        }

        // Build a single concatenated set for the entire training data
        //  This is helpful for devices with enough memory to hold all of this,
        //   as it can be reused for every epoch, making training very quick.
        //  The downside is that this can exhaust the memory of mobile devices.
        async function createTrainingData(traininginfo, getImageDataFn) {
            let xs;
            let ys;

            for (let i = 0; i < traininginfo.length; i++) {
                const imageInfo = traininginfo[i];

                const imageData = await Promise.resolve(getImageDataFn(imageInfo));
                const xval = tf.tidy(() => baseModel.predict(imageData.data));
                imageData.data.dispose();

                const labelIdx = modelClasses.indexOf(imageData.metadata.label);
                const yval = tf.tidy(() =>
                    tf.oneHot(tf.tensor1d([labelIdx]).toInt(), modelNumClasses)
                );

                if (i === 0) {
                    xs = xval;
                    ys = yval;
                }
                else {
                    const oldxs = xs;
                    xs = oldxs.concat(xval, 0);
                    safeDispose(oldxs, xval);

                    const oldys = ys;
                    ys = oldys.concat(yval, 0);
                    safeDispose(oldys, yval);
                }
            }

            return { xs, ys };
        }



        function calculateEpochs(trainingDataLength) {
            let epochs = 10;
            if (!simplified) {
                if (trainingDataLength < 20) {
                    epochs = 30;
                }
                else if (trainingDataLength < 50) {
                    epochs = 20;
                }
                else if (trainingDataLength < 200) {
                    epochs = 10;
                }
                else {
                    epochs = 8;
                }
            }

            loggerService.debug('[ml4kimages] epochs', epochs);
            return epochs;
        }


        function newModel(projectid, userid, tenantid, trainSimplifiedModel) {
            loggerService.debug('[ml4kimages] creating new ML model');
            loggerService.debug('[ml4kimages] tf backend', tf.getBackend());
            loggerService.debug('[ml4kimages] tf precision', tf.ENV.getBool('WEBGL_RENDER_FLOAT32_ENABLED'));

            if (trainSimplifiedModel !== simplified) {
                loggerService.debug('[ml4kimages] requested model type', trainSimplifiedModel);
                simplified = trainSimplifiedModel;
                resetTransferModel();
            }

            utilService.logTfjsMemory('newModel');

            resetting = false;

            modelStatus = {
                classifierid : projectid,
                status : 'Training',
                progress : 0,
                updated : new Date(),
                simplified : simplified
            };

            if (usingRestoredModel || !transferModel) {
                if (transferModel) {
                    transferModel.dispose();
                }
                transferModel = prepareTransferLearningModel(baseModel, modelNumClasses);
            }

            let getImageDataFn;
            if (browserStorageService.idIsLocal(projectid)) {
                // with local storage, the image data is already stored in the browser
                //  so we just need to use it to create a tensor
                getImageDataFn = (trainingInfoObj) => {
                    return getTensorForImageData(trainingInfoObj.imagedata, trainingInfoObj);
                };
            }
            else {
                // with cloud storage, we need to retrieve the image data first, and
                //  then use it to create a tensor
                getImageDataFn = (trainingInfoObj) => {
                    loggerService.debug('[ml4kimages] training image metadata', trainingInfoObj);
                    return trainingService.getTrainingItem(projectid, userid, tenantid, trainingInfoObj.id)
                        .then(function (imgdata) {
                            loggerService.debug('[ml4kimages] retrieved image data ' + trainingInfoObj.id + ' ' + imgdata.byteLength + ' bytes');
                            return getTensorForImageData(imgdata, trainingInfoObj);
                        });
                };
            }

            loggerService.debug('[ml4kimages] preparing training dataset');
            return trainingService.getTraining(projectid, userid, tenantid)
                .then((traininginfo) => {
                    loggerService.debug('[ml4kimages] creating dataset from ' + traininginfo.length + ' images');

                    utilService.logTfjsMemory('preparing training data');
                    const epochs = calculateEpochs(traininginfo.length);

                    // start the training in the background
                    if (isMobile()) {
                        loggerService.debug('[ml4kimages] streaming training data');
                        const dataset = createTrainingDataset(traininginfo, getImageDataFn);
                        trainTfjsModel(projectid, epochs, dataset, true);
                    }
                    else {
                        loggerService.debug('[ml4kimages] building training data batch');
                        createTrainingData(traininginfo, getImageDataFn)
                            .then((data) => {
                                trainTfjsModel(projectid, epochs, data, false);
                            })
                            .catch((err) => {
                                loggerService.error('[ml4kimages] model training batch train failure', err);
                                handleTrainingError(err);
                                return modelStatus;
                            });
                    }

                    // return the status immediately
                    return modelStatus;
                })
                .catch((dataErr) => {
                    loggerService.error('[ml4kimages] model training data failure', dataErr);
                    handleTrainingError(dataErr);
                    return modelStatus;
                });
        }


        function trainTfjsModel(projectid, epochs, datasource, useStreamingDataset) {
            utilService.logTfjsMemory('training model');

            let aborted = false;

            const STEPS_TO_SAVE = 10;
            var progressPerEpoch = Math.round((100 - STEPS_TO_SAVE) / epochs);

            var trainingHistory = {
                epochs : [],
                trainingLoss : []
            };

            const trainingConfig = {
                epochs : epochs,
                callbacks : {
                    onEpochEnd : function (epoch, logs) {
                        loggerService.debug('[ml4kimages] epoch ' + epoch + ' loss ' + logs.loss);
                        utilService.logTfjsMemory('epoch end');

                        trainingHistory.epochs.push(epoch);
                        trainingHistory.trainingLoss.push(logs.loss);

                        if (modelStatus) {
                            modelStatus.progress = (epoch + 1) * progressPerEpoch;
                        }

                        if (isNaN(logs.loss)) {
                            loggerService.debug('[ml4kimages] aborting training');
                            transferModel.stopTraining = true;
                            aborted = true;
                        }
                    },
                    onTrainEnd : function () {
                        if (!useStreamingDataset) {
                            safeDispose(datasource.xs, datasource.ys);
                        }

                        if (resetting) {
                            return;
                        }

                        if (aborted) {
                            loggerService.debug('[ml4kimages] training failed');
                            if (modelStatus) {
                                modelStatus.status = 'Failed';
                                modelStatus.progress = 100;
                            }
                            usingRestoredModel = false;
                            return;
                        }

                        if (modelStatus) {
                            modelStatus.progress = 100 - STEPS_TO_SAVE;
                        }

                        saveModel(projectid)
                            .then(function () {
                                return browserStorageService.storeAssetData(
                                    projectid + '-history',
                                    trainingHistory
                                );
                            })
                            .then(function () {
                                loggerService.debug('[ml4kimages] training complete');
                                if (modelStatus) {
                                    modelStatus.status = 'Available';
                                    modelStatus.progress = 100;
                                }
                                usingRestoredModel = false;
                                utilService.logTfjsMemory('training complete');
                            })
                            .catch(function (err) {
                                loggerService.error('[ml4kimages] failed to save model', err);
                                if (modelStatus) {
                                    modelStatus.status = 'Available';
                                    modelStatus.progress = 100;
                                    modelStatus.warning = 'Not stored';
                                }
                                usingRestoredModel = false;
                                utilService.logTfjsMemory('training complete');
                            });
                    }
                }
            };


            if (useStreamingDataset) {
                transferModel.fitDataset(datasource, trainingConfig)
                    .catch((err) => {
                        loggerService.error('[ml4kimages] failed to train model', err);
                        handleTrainingError(err);
                        usingRestoredModel = false;
                    });
            }
            else {
                trainingConfig.batchSize = simplified ? 5 : 10;

                transferModel.fit(datasource.xs, datasource.ys, trainingConfig)
                    .catch((err) => {
                        loggerService.error('[ml4kimages] failed to train model', err);
                        safeDispose(datasource.xs, datasource.ys);
                        handleTrainingError(err);
                        usingRestoredModel = false;
                    });
            }
        }


        function handleTrainingError(err) {
            if (modelStatus) {
                modelStatus.status = 'Failed';
                modelStatus.progress = 100;
                modelStatus.updated = new Date();

                if (err.message &&
                    (err.message.includes('compile fragment shader') || err.message.includes('link vertex and fragment shaders')))
                {
                    const RESOURCE_MESSAGE = 'Your device does not have enough graphics memory to get your training data ready. ' +
                        'You could remove some of your training images, or train a simplified model. ' +
                        'It might help if you close other browser tabs or applications. ';
                    err = new Error(RESOURCE_MESSAGE);
                    err.data = { error : RESOURCE_MESSAGE };
                    err.resourceLimitError = true;
                    err.status = 500;
                }
                else if (!err.data) {
                    err = new Error('Failed to train machine learning model ' +
                        err.message ? '(' + err.message + ')' : '');
                    err.status = 500;
                }
                modelStatus.error = err;
            }
        }


        function safeDispose(tens1, tens2) {
            try {
                tf.dispose(tens1);
                tf.dispose(tens2);
            }
            catch (err) {
                loggerService.error('[ml4kimages] failed to dispose tensors', err);
            }
        }


        function testImageDataTensor(imageData) {
            var baseModelOutput = tf.tidy(function () {
                return baseModel.predict(imageData);
            });
            var transferModelOutput = tf.tidy(function () {
                return transferModel.predict(baseModelOutput);
            });

            return transferModelOutput.data()
                .then(function (output) {
                    imageData.dispose();
                    safeDispose(baseModelOutput, transferModelOutput);

                    if (output.length !== modelNumClasses) {
                        loggerService.error('[ml4kimages] unexpected output from model', output);
                        throw new Error('Unexpected output from model');
                    }

                    var scores = modelClasses.map(function (label, idx) {
                        return {
                            class_name : label,
                            confidence : 100 * output[idx]
                        };
                    }).sort(modelService.sortByConfidence);
                    return scores;
                })
                .catch(function (err) {
                    loggerService.error('[ml4kimages] failed to run test', err);
                    throw err;
                });
        }


        function testBase64ImageData(imgdata) {
            return getTensorForImageData(imgdata)
                .then(function (imageDataObj) {
                    return testImageDataTensor(imageDataObj.data);
                });
        }


        function testCanvas(canvasToTest) {
            var imageData = tf.tidy(function () {
                return tf.browser.fromPixels(canvasToTest)
                            .expandDims(0)
                            .toFloat()
                            .div(127)
                            .sub(1);
            });
            return testImageDataTensor(imageData);
        }


        var MODELTYPE = 'images';

        function deleteModel(projectid) {
            modelStatus = null;
            return modelService.deleteModel(MODELTYPE, projectid)
                .then(function () {
                    return browserStorageService.deleteAsset(projectid + '-history');
                })
                .catch(function (err) {
                    loggerService.debug('[ml4kimages] error deleting training history', err);
                });
        }

        function saveModel(projectid) {
            return modelService.saveModel(MODELTYPE, projectid, transferModel);
        }

        function loadModel(projectid) {
            return modelService.loadModel(MODELTYPE, projectid)
                .then(function (resp) {
                    if (resp) {
                        modelStatus = {
                            classifierid : projectid,
                            status : 'Available',
                            progress : 100,
                            updated : resp.timestamp,
                            simplified : simplified
                        };
                        usingRestoredModel = true;
                        return resp.output;
                    }
                })
                .catch(function (err) {
                    loggerService.error('[ml4kimages] failed to load model', err);
                });
        }


        function resetTransferModel() {
            try {
                if (transferModel && transferModel.built) {
                    transferModel.stopTraining = true;
                }
                if (tf) {
                    tf.dispose(transferModel);
                }

                transferModel = null;
            }
            catch (err) {
                loggerService.debug('[ml4kimages] error when disposing of transfer model', err);
            }
        }


        function reset() {
            try {
                resetting = true;

                resetTransferModel();

                if (baseModel) {
                    tf.dispose(baseModel);
                }

                modelStatus = null;
            }
            catch (err) {
                loggerService.debug('[ml4kimages] error when disposing of models', err);
            }
        }

        function isMobile() {
            loggerService.debug('[ml4kimages] user agent ' + navigator.userAgent);
            return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
        }


        return {
            initImageSupport : initImageSupport,
            newModel : newModel,
            deleteModel : deleteModel,
            getModels : getModels,
            testCanvas : testCanvas,
            testBase64ImageData : testBase64ImageData,
            reset : reset
        };
    }
})();
