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

        var usingRestoredModel = false;

        var modelStatus;
        var modelNumClasses;
        var modelClasses;

        var IMG_WIDTH = 224;
        var IMG_HEIGHT = 224;



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
                    var imageData = tf.tidy(function () {
                        return tf.browser.fromPixels(hiddenImg)
                                    .expandDims(0)
                                    .toFloat()
                                    .div(127)
                                    .sub(1);
                    });

                    const imgid = imgmetadata ? imgmetadata.id : 'test';
                    loggerService.debug('[ml4kimages] tensor image data ' + imgid + ' ' +
                        imageData.size + ' (' + imageData.dtype + ')');

                    resolve({ metadata : imgmetadata, data : imageData });

                    URL.revokeObjectURL(imgDataBlob);
                };

                hiddenImg.src = imgDataBlob;
            });
        }


        function getTrainingData(projectid, userid, tenantid, getImageDataFn) {
            return trainingService.getTraining(projectid, userid, tenantid)
                .then(function (traininginfo) {
                    return $q.all(traininginfo.map(getImageDataFn));
                });
        }


        function prepareTrainingData(trainingdata) {
            var xs;
            var ys;

            try {
                for (var i=0; i < trainingdata.length; i++) {
                    var trainingdataitem = trainingdata[i];
                    var labelIdx = modelClasses.indexOf(trainingdataitem.metadata.label);

                    var xval = baseModel.predict(trainingdataitem.data);
                    trainingdataitem.data.dispose();

                    var yval = tf.tidy(function () {
                        return tf.oneHot(tf.tensor1d([ labelIdx ]).toInt(), modelNumClasses);
                    });

                    if (i === 0) {
                        xs = xval;
                        ys = yval;
                    }
                    else {
                        var oldxs = xs;
                        var oldys = ys;
                        xs = oldxs.concat(xval, 0);
                        ys = oldys.concat(yval, 0);

                        safeDispose(oldxs, xval);
                        safeDispose(oldys, yval);
                    }
                }

                let epochs = 10;
                if (trainingdata.length > 100) {
                    epochs = 20;
                }
                else if (trainingdata.length > 50) {
                    epochs = 15;
                }

                return { xs, ys, epochs };
            }
            catch (err) {
                loggerService.error('[ml4kimages] failed to prepare training tensors', err);
                if (err.message && err.message.includes('compile fragment shader')) {
                    err.data = {
                        error : 'Your device does not have enough graphics memory to get ' +
                        'your training data ready. ' +
                        'You could remove some of your training images. ' +
                        'It might help if you close other browser tabs or applications. '
                    };
                    err.status = 500;
                }
                throw err;
            }
        }


        function newModel(projectid, userid, tenantid) {
            loggerService.debug('[ml4kimages] creating new ML model');
            loggerService.debug('[ml4kimages] tf backend', tf.getBackend());
            loggerService.debug('[ml4kimages] tf precision', tf.ENV.getBool('WEBGL_RENDER_FLOAT32_ENABLED'));
            utilService.logTfjsMemory('newModel');

            modelStatus = {
                classifierid : projectid,
                status : 'Training',
                progress : 0,
                updated : new Date()
            };

            if (usingRestoredModel) {
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

            loggerService.debug('[ml4kimages] getting training data');
            return getTrainingData(projectid, userid, tenantid, getImageDataFn)
                .then(function (trainingdata) {
                    loggerService.debug('[ml4kimages] retrieved training data');

                    utilService.logTfjsMemory('preparing training data');
                    const { xs, ys, epochs } = prepareTrainingData(trainingdata);

                    // start the training in the background
                    trainTfjsModel(projectid, epochs, xs, ys);

                    // return the status immediately
                    return modelStatus;
                })
                .catch(function (err) {
                    loggerService.error('[ml4kimages] model training failure', err);

                    if (modelStatus) {
                        modelStatus.status = 'Failed';
                        modelStatus.updated = new Date();
                        modelStatus.error = err;
                    }

                    return modelStatus;
                });
        }


        function trainTfjsModel(projectid, epochs, xs, ys) {
            utilService.logTfjsMemory('training model', epochs);

            let aborted = false;

            var progressPerEpoch = Math.round(100 / epochs);
            transferModel.fit(xs, ys, {
                batchSize : 10,
                epochs : epochs,
                callbacks : {
                    onEpochEnd : function (epoch, logs) {
                        loggerService.debug('[ml4kimages] epoch ' + epoch + ' loss ' + logs.loss);
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
                        safeDispose(xs, ys);

                        if (aborted) {
                            if (epochs >= 10) {
                                // retry with a smaller epoch
                                transferModel = prepareTransferLearningModel(baseModel, modelNumClasses);
                                return trainTfjsModel(projectid,
                                    (epochs > 10) ? 10 : 5,
                                    xs, ys);
                            }
                            else {
                                // already tried with only 5 epochs - give up
                                loggerService.debug('[ml4kimages] training failed');
                                if (modelStatus) {
                                    modelStatus.status = 'Failed';
                                    modelStatus.progress = 100;
                                }
                                usingRestoredModel = false;
                                return;
                            }
                        }

                        return saveModel(projectid)
                            .then(function () {
                                loggerService.debug('[ml4kimages] training complete');
                                if (modelStatus) {
                                    modelStatus.status = 'Available';
                                    modelStatus.progress = 100;
                                }
                                usingRestoredModel = false;
                                utilService.logTfjsMemory('training complete');
                            });
                    }
                }
            });
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
            var baseModelOutput = baseModel.predict(imageData);
            var transferModelOutput = transferModel.predict(baseModelOutput);

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
            return modelService.deleteModel(MODELTYPE, projectid);
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
                            updated : resp.timestamp
                        };
                        usingRestoredModel = true;
                        return resp.output;
                    }
                })
                .catch(function (err) {
                    loggerService.error('[ml4kimages] failed to load model', err);
                });
        }


        function reset() {
            try {
                if (transferModel) {
                    tf.dispose(transferModel);
                }
                if (baseModel) {
                    tf.dispose(baseModel);
                }
            }
            catch (err) {
                loggerService.debug('[ml4kimages] error when disposing of models', err);
            }
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
