(function () {

    angular
        .module('app')
        .service('soundTrainingService', soundTrainingService);

    soundTrainingService.$inject = [
        'trainingService', 'utilService', '$q', 'loggerService', '$window', '$location'
    ];

    function soundTrainingService(trainingService, utilService, $q, loggerService, $window, $location) {

        var transferRecognizer;
        var transferModelInfo;

        var modelStatus;

        function isUserMediaSupported() {
            var supported = $window.navigator &&
                            $window.navigator.mediaDevices &&
                            $window.navigator.mediaDevices.getUserMedia;
            loggerService.debug('[ml4ksound] isUserMediaSupported ' + supported);
            return supported;
        }


        // easiest way to see if we're allowed to access the microphone
        //  is to try and access the microphone   ¯\_(ツ)_/¯
        function permissionsCheck() {
            loggerService.debug('[ml4ksound] checking permissions');
            return $window.navigator.mediaDevices.getUserMedia({ audio : true, video : false })
                .then(function (stream) {
                    stream.getTracks().forEach(function (track) {
                        track.stop();
                    });
                    loggerService.debug('[ml4ksound] permissions okay');
                })
                .catch(function (err) {
                    loggerService.error('[ml4ksound] permissions check failed');
                    loggerService.error(err);

                    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
                        throw { status : 400, data : {
                            message : 'Sorry! Machine Learning for Kids was not allowed to use your microphone'
                        }};
                    }
                    else if (err.name === 'NotFoundError' || err.name === 'TypeError') {
                        throw { status : 400, data : {
                            message : 'Sorry! Machine Learning for Kids could not find a microphone to use'
                        }};
                    }
                    else if (err.name === 'NotReadableError') {
                        throw { status : 400, data : {
                            message : 'Sorry! There was a problem with your microphone'
                        }};
                    }
                    else {
                        // record the error
                        loggerService.error('[ml4ksound] Unexpected permissions error');
                        if (err && Sentry && Sentry.captureException) {
                            Sentry.captureException(err);
                        }

                        throw { status : 500, data : err };
                    }
                });
        }

        function loadTensorFlow() {
            loggerService.debug('[ml4ksound] loading tensorflow');

            if (!isUserMediaSupported()) {
                loggerService.error('[ml4ksound] user media not supported');

                if (utilService.isInternetExplorer()) {
                    loggerService.debug('[ml4ksound] running on Internet Explorer');
                    throw ({
                        status : 400,
                        data : { message : 'Sorry! Internet Explorer cannot be used for sounds projects' }
                    });
                }
                else {
                    loggerService.debug('[ml4ksound] reporting failure to find microphone');
                    throw ({
                        status : 400,
                        data : { message : 'Sorry! Machine Learning for Kids could not find a microphone to use' }
                    });
                }
            }

            return permissionsCheck()
                .then(function () {
                    loggerService.debug('[ml4ksound] loading tf');
                    return utilService.loadScript('/static/bower_components/tensorflowjs/tf.min.js');
                })
                .then(function () {
                    loggerService.debug('[ml4ksound] loading speech-commands');
                    return utilService.loadScript('/static/bower_components/tensorflow-models/speech-commands/speech-commands.min.js');
                })
                .then(function () {
                    loggerService.debug('[ml4ksound] enabling tf prod mode');
                    if (tf && tf.enableProdMode) {
                        tf.enableProdMode();
                    }
                })
                .catch(function (err) {
                    loggerService.error('[ml4ksound] failed to load tensorflow');
                    loggerService.error(err);
                    throw err;
                });
        }

        function initSoundSupport(projectid) {
            var baseRecognizer;
            return loadTensorFlow()
                .then(function () {
                    loggerService.debug('[ml4ksound] browser model');

                    var siteUrl = $location.protocol() + '://' + $location.host();
                    if ($location.port()) {
                        siteUrl = siteUrl + ':' + $location.port();
                    }

                    var vocab = null;
                    var modelJson = siteUrl + '/static/bower_components/tensorflow-models/speech-commands/model.json';
                    var metadataJson = siteUrl + '/static/bower_components/tensorflow-models/speech-commands/metadata.json';
                    baseRecognizer = speechCommands.create('BROWSER_FFT', vocab, modelJson, metadataJson);
                    return baseRecognizer.ensureModelLoaded();
                })
                .then(function () {
                    loggerService.debug('[ml4ksound] creating transfer learning recognizer');
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
            loggerService.debug('[ml4ksound] get sound models');
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

        function getTrainingData(projectid, userid, tenantid) {
            return trainingService.getTraining(projectid, userid, tenantid)
                .then(function (traininginfo) {
                    return $q.all(traininginfo.map(trainingService.getSoundData));
                });
        }

        function newModel(projectid, userid, tenantid) {
            loggerService.debug('[ml4ksound] creating new ML model');

            modelStatus = {
                classifierid : projectid,
                status : 'Training',
                progress : 0,
                updated : new Date()
            };

            loggerService.debug('[ml4ksound] getting training data');
            return getTrainingData(projectid, userid, tenantid)
                .then(function (trainingdata) {
                    loggerService.debug('[ml4ksound] retrieved training data');

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
                    loggerService.debug('[ml4ksound] starting transfer learning');

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

                    loggerService.debug('[ml4ksound] returning interim status');
                    return modelStatus;
                })
                .catch(function (err) {
                    loggerService.error('[ml4ksound] model training failure', err);

                    modelStatus.status = 'Failed';
                    modelStatus.updated = new Date();

                    return modelStatus;
                });
        }


        function startTest(callback) {
            loggerService.debug('[ml4ksound] starting to listen');
            return transferRecognizer.listen(function (result) {
                var matches = [];

                var labels = transferRecognizer.wordLabels();
                if (!labels) {
                    loggerService.debug('[ml4ksound] labels unavailable');
                    return callback(matches);
                }

                if (labels.length !== result.scores.length) {
                    loggerService.error('[ml4ksound] Unexpected number of results',
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
            loggerService.debug('[ml4ksound] stopping listening');
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
