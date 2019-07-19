(function () {

    angular
        .module('app')
        .service('soundTrainingService', soundTrainingService);

    soundTrainingService.$inject = [
        'trainingService', 'utilService', '$q'
    ];

    function soundTrainingService(trainingService, utilService, $q) {

        var transferRecognizer;
        var transferModelInfo;

        var modelStatus;

        function loadTensorFlow() {
            return utilService.loadScript('https://unpkg.com/@tensorflow/tfjs@1.0.2/dist/tf.js')
                .then(function () {
                    return utilService.loadScript('https://unpkg.com/@tensorflow-models/speech-commands@0.3.0');
                });
        }

        function initSoundSupport(projectid) {
            var baseRecognizer;
            return loadTensorFlow()
                .then(function () {
                    baseRecognizer = speechCommands.create('BROWSER_FFT');
                    return baseRecognizer.ensureModelLoaded();
                })
                .then(function () {
                    transferRecognizer = baseRecognizer.createTransfer(projectid);

                    var modelInfo = transferRecognizer.modelInputShape();
                    transferModelInfo = {
                        numFrames : modelInfo[1],
                        fftSize : modelInfo[2]
                    };
                });
        }

        function collectExample(label) {
            return transferRecognizer.collectExample(label);
        }

        function getModelInfo() {
            return transferModelInfo;
        }

        function getModels() {
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

        function newModel(projectid, userid, tenantid) {
            modelStatus = {
                classifierid : projectid,
                status : 'Training',
                progress : 0,
                updated : new Date()
            };

            return trainingService.getTraining(projectid, userid, tenantid)
                .then(function (trainingdata) {
                    // reset
                    transferRecognizer.dataset.clear();
                    transferRecognizer.dataset.label2Ids = {};
                    transferRecognizer.words = null;

                    // add training data
                    for (var i = 0; i < trainingdata.length; i++) {
                        var trainingdataitem = trainingdata[i];

                        transferRecognizer.dataset.addExample({
                            label : trainingdataitem.label,
                            spectrogram : {
                                frameSize : transferModelInfo.fftSize,
                                data : new Float32Array(trainingdataitem.audiodata)
                            }
                        });
                    }

                    // rebuild vocab
                    transferRecognizer.collateTransferWords();

                    return tf.nextFrame();
                })
                .then(function () {
                    transferRecognizer.train({
                        epochs : 100,
                        callback: {
                            onEpochEnd: function (epoch) {
                                modelStatus.progress = epoch;
                            }
                        }
                    }).then(function() {
                        modelStatus.status = 'Available';
                        modelStatus.progress = 100;
                    });

                    return modelStatus;
                })
                .catch(function (err) {
                    console.log(err);

                    modelStatus.status = 'Failed';
                    modelStatus.updated = new Date();

                    return modelStatus;
                });
        }


        function startTest(callback) {
            return transferRecognizer.listen(function (result) {
                var matches = [];

                var labels = transferRecognizer.wordLabels();
                if (!labels) {
                    console.log('Labels unavailable');
                    return callback(matches);
                }

                if (labels.length !== result.scores.length) {
                    console.log('Unexpected number of results',
                                labels.length,
                                result.scores.length);
                }

                for (var i = 0; i < Math.min(labels.length, result.scores.length); i++) {
                    matches.push({
                        class_name : labels[i],
                        confidence : result.scores[i] * 100
                    });
                }

                matches.sort(function (a, b) {
                    return b.confidence - a.confidence;
                });

                callback(matches);
            }, {
                probabilityThreshold : 0.7
            });
        }

        function stopTest() {
            return transferRecognizer.stopListening();
        }


        return {
            initSoundSupport : initSoundSupport,
            getModelInfo : getModelInfo,
            collectExample : collectExample,
            newModel : newModel,
            getModels : getModels,
            startTest : startTest,
            stopTest : stopTest
        };
    }
})();
