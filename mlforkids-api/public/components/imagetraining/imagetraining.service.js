(function () {

    angular
        .module('app')
        .service('imageTrainingService', imageTrainingService);

    imageTrainingService.$inject = [
        '$q', '$location',
        'trainingService', 'modelService',
        'utilService', 'loggerService'
    ];

    function imageTrainingService($q, $location, trainingService, modelService, utilService, loggerService) {

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

                    resolve({ metadata : imgmetadata, data : imageData });

                    URL.revokeObjectURL(imgDataBlob);
                };

                hiddenImg.src = imgDataBlob;
            });
        }


        function getImageData(projectid, userid, tenantid, traininginfo) {
            return trainingService.getTrainingItem(projectid, userid, tenantid, traininginfo.id)
                .then(function (imgdata) {
                    return getTensorForImageData(imgdata, traininginfo);
                });
        }


        function getTrainingData(projectid, userid, tenantid) {
            return trainingService.getTraining(projectid, userid, tenantid)
                .then(function (traininginfo) {
                    return $q.all(traininginfo.map(function (trainingitem) {
                        return getImageData(projectid, userid, tenantid, trainingitem);
                    }));
                });
        }


        function newModel(projectid, userid, tenantid) {
            loggerService.debug('[ml4kimages] creating new ML model');

            modelStatus = {
                classifierid : projectid,
                status : 'Training',
                progress : 0,
                updated : new Date()
            };

            if (usingRestoredModel) {
                transferModel = prepareTransferLearningModel(baseModel, modelNumClasses);
            }

            loggerService.debug('[ml4kimages] getting training data');
            return getTrainingData(projectid, userid, tenantid)
                .then(function (trainingdata) {
                    loggerService.debug('[ml4kimages] retrieved training data');

                    var xs;
                    var ys;

                    for (var i=0; i < trainingdata.length; i++) {
                        var trainingdataitem = trainingdata[i];
                        var labelIdx = modelClasses.indexOf(trainingdataitem.metadata.label);

                        var xval = baseModel.predict(trainingdataitem.data);
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

                            oldxs.dispose();
                            oldys.dispose();
                        }
                    }

                    var epochs = 10;
                    if (trainingdata.length > 55) {
                        epochs = 15;
                    }

                    transferModel.fit(xs, ys, {
                        batchSize : 10,
                        epochs : epochs,
                        callbacks : {
                            onEpochEnd : function (epoch, logs) {
                                loggerService.debug('[ml4kimages] epoch ' + epoch + ' loss ' + logs.loss);
                                if (modelStatus) {
                                    if (epochs === 15) {
                                        modelStatus.progress = (epoch + 1) * 7;
                                    }
                                    else {
                                        modelStatus.progress = (epoch + 1) * 10;
                                    }
                                }
                            },
                            onTrainEnd : function () {
                                return saveModel(projectid)
                                    .then(function () {
                                        loggerService.debug('[ml4kimages] training complete');
                                        if (modelStatus) {
                                            modelStatus.status = 'Available';
                                            modelStatus.progress = 100;
                                        }
                                        usingRestoredModel = false;
                                    });
                            }
                        }
                    });

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



        function testImageDataTensor(imageData) {
            var baseModelOutput = baseModel.predict(imageData);
            var transferModelOutput = transferModel.predict(baseModelOutput);

            return transferModelOutput.data()
                .then(function (output) {
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
