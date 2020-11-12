(function () {

    angular
        .module('app')
        .service('imageTrainingService', imageTrainingService);

    imageTrainingService.$inject = [
        '$q',
        'trainingService', 'utilService', 'loggerService'
    ];

    function imageTrainingService($q, trainingService, utilService, loggerService) {

        var transferModel;
        var baseModel;
        var modelStatus;
        var modelNumClasses;
        var modelClasses;

        function loadTensorFlow() {
            loggerService.debug('[ml4kimages] loading tensorflow');
            return utilService.loadScript('/static/bower_components/tensorflowjs/tf.min.js')
                .then(function () {
                    loggerService.debug('[ml4kimages] loading mobilenet');
                    return utilService.loadScript('/static/bower_components/tensorflow-models/mobilenet/mobilenet.min.js');
                })
                .then(function () {
                    loggerService.debug('[ml4kimages] enabling tf prod mode');
                    if (tf && tf.enableProdMode) {
                        tf.enableProdMode();
                    }
                })
                .catch(function (err) {
                    loggerService.error('[ml4kimages] failed to load tensorflow');
                    loggerService.error(err);
                    throw err;
                });
        }

        function prepareMobilenet() {
            loggerService.debug('[ml4kimages] preparing mobilenet for transfer learning');
            var BASE_MODEL = 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json';
            return tf.loadLayersModel(BASE_MODEL)
                .then(function (mobilenet) {
                    var activationLayer = mobilenet.getLayer('conv_pw_13_relu');
                    return tf.model({
                        inputs : mobilenet.inputs,
                        outputs: activationLayer.output
                    });
                })
                .catch(function (err) {
                    loggerService.error('[ml4kimages] failed to prepare mobilenet');
                    loggerService.error(err);
                    throw err;
                });
        }

        function prepareTransferLearningModel(mobilenet, numClasses) {
            loggerService.debug('[ml4kimages] creating transfer learning model');
            var model = tf.sequential({
                layers : [
                    tf.layers.flatten({
                        inputShape : mobilenet.outputs[0].shape.slice(1)
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
                .then(function (mobilenet) {
                    baseModel = mobilenet;
                    transferModel = prepareTransferLearningModel(mobilenet, modelNumClasses);
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


        var IMG_WIDTH = 224;
        var IMG_HEIGHT = 224;

        function getImageData(projectid, userid, tenantid, traininginfo) {
            return $q(function (resolve, reject) {
                trainingService.getTrainingItem(projectid, userid, tenantid, traininginfo.id)
                    .then(function (imgdata) {
                        var imgDataBlob = URL.createObjectURL(new Blob([imgdata]));

                        var hiddenImg = document.createElement('img');
                        hiddenImg.width = IMG_WIDTH;
                        hiddenImg.height = IMG_HEIGHT;
                        hiddenImg.onerror = function (err) {
                            loggerService.error('[ml4kimages] Failed to load image', traininginfo, err);
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

                            resolve({ metadata : traininginfo, data : imageData });

                            URL.revokeObjectURL(imgDataBlob);
                        };

                        hiddenImg.src = imgDataBlob;
                    })
                    .catch(reject);
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

                    transferModel.fit(xs, ys, {
                        batchSize : 10,
                        epochs : 10,
                        callbacks : {
                            onEpochEnd : function (epoch, logs) {
                                console.log('----- epoch end -----');
                                console.log(epoch);
                                console.log(logs.loss);
                                modelStatus.progress = (epoch + 1) * 10;
                            },
                            onTrainEnd : function () {
                                console.log('training complete');
                                modelStatus.status = 'Available';
                                modelStatus.progress = 100;
                            }
                        }
                    });

                    return modelStatus;
                })
                .catch(function (err) {
                    loggerService.error('[ml4kimages] model training failure', err);

                    modelStatus.status = 'Failed';
                    modelStatus.updated = new Date();

                    return modelStatus;
                });
        }



        function testModel(testdivid) {
            return $q(function (resolve, reject) {
                try {
                    var testImage = document.getElementById(testdivid);
                    var testImageWidth = testImage.naturalWidth;
                    var testImageHeight = testImage.naturalHeight;

                    var testCanvas = document.createElement('canvas');
                    testCanvas.width = 224;
                    testCanvas.height = 224;
                    var testContext = testCanvas.getContext('2d');

                    testContext.drawImage(testImage,
                                        0, 0,
                                        testImageWidth, testImageHeight,
                                        0, 0,
                                        224, 224);

                    var imageData = tf.tidy(function () {
                        return tf.browser.fromPixels(testCanvas)
                                    .expandDims(0)
                                    .toFloat()
                                    .div(127)
                                    .sub(1);
                    });
                    var baseModelOutput = baseModel.predict(imageData);
                    var transferModelOutput = transferModel.predict(baseModelOutput);

                    transferModelOutput.data().then(function (output) {
                        if (output.length !== modelNumClasses) {
                            console.log('unexpected output', output);
                            reject(new Error('Unexpected output from model'));
                        }
                        else {
                            var scores = modelClasses.map(function (label, idx) {
                                return {
                                    label : label,
                                    confidence : 100 * output[idx]
                                };
                            }).sort(function (a, b) {
                                if (a.confidence < b.confidence) {
                                    return 1;
                                }
                                else if (a.confidence > b.confidence) {
                                    return -1;
                                }
                                else {
                                    return 0;
                                }
                            });
                            resolve(scores);
                        }
                    });
                }
                catch (err) {
                    loggerService.error('[ml4kimages] failed to run test', err);
                    return reject(err);
                }
            });
        }



        return {
            initImageSupport : initImageSupport,
            newModel : newModel,
            getModels : getModels,
            testModel : testModel
        };
    }
})();
