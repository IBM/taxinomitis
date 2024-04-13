(function () {

    angular
        .module('app')
        .service('numberTrainingService', numberTrainingService);

    numberTrainingService.$inject = [
        'modelService', 'trainingService', 'storageService',
        'browserStorageService',
        'utilService', 'loggerService',
        '$q', '$http'
    ];

    function numberTrainingService(modelService, trainingService, storageService, browserStorageService, utilService, loggerService, $q, $http) {

        const MODELTYPE = 'numbers';

        let model;
        let modelStatus;
        let modelDetails;


        function loadTensorFlow() {
            loggerService.debug('[ml4knums] loading tensorflow');
            return utilService.loadTensorFlow()
                .then(function () {
                    return utilService.loadNumberProjectSupport();
                })
                .then(function () {
                    loggerService.debug('[ml4knums] enabling tf prod mode');
                    if (tf && tf.enableProdMode) {
                        tf.enableProdMode();
                        loggerService.debug('[ml4knums] tfjs version', tf.version);
                    }
                })
                .catch(function (err) {
                    loggerService.error('[ml4knums] failed to load tensorflow', err);
                    throw err;
                });
        }


        function loadModel(project) {
            // load the graph model
            return modelService.loadModel(MODELTYPE, project.id)
                .then((resp) => {
                    if (resp) {
                        modelStatus = {
                            classifierid : project.id,
                            status : 'Loading',
                            progress : 0,
                            updated : resp.timestamp
                        };

                        // load the decision forest using the graph model and
                        //  the assets zip saved to indexeddb storage
                        return tfdf.loadTFDFModel({
                                loadModel : () => {
                                    return resp.output.artifacts;
                                },
                                loadAssets : () => {
                                    return browserStorageService.retrieveAsset(project.id + '-assets');
                                }
                            });
                    }
                    else {
                        throw new Error('Graph model not found');
                    }
                })
                .then((resp) => {
                    loadModelMetadata(project);
                    model = resp;

                    modelStatus.status = 'Available';
                    modelStatus.progress = 100;

                    return true;
                })
                .catch(function (err) {
                    loggerService.debug('[ml4knums] failed to load model', err);
                });
        }


        function initNumberSupport(project) {
            loggerService.debug('[ml4knums] initialising number model support', project.id);
            return loadTensorFlow()
                .then(function () {
                    return loadModel(project);
                });
        }




        function updateStatus(modelinfo) {
            modelDetails = modelinfo;
            modelDetails.lastupdate = new Date(modelinfo.lastupdate);
            modelStatus.updated = modelDetails.lastupdate;
            modelStatus.lastPollTime = new Date();

            if (modelinfo.status === 'Available') {
                modelStatus.progress = 66;
                storeModelForLocalReuse(modelinfo);
            }
            else if (modelinfo.status === 'Failed') {
                loggerService.error('[ml4knums] model failed', modelinfo);
                modelStatus.status = modelinfo.status;
            }
        }


        function storeModelForLocalReuse(modelinfo) {
            loggerService.debug('[ml4knums] loading tfdf model', modelinfo.urls.model);
            // load the decision forest - which is made up of two pieces - a graph model and an assets zip
            tfdf.loadTFDFModel(modelinfo.urls.model)
                .then((tfmodel) => {
                    model = tfmodel;

                    // store the downloaded model for later reuse, as it will not be
                    //  available at this URL for long
                    // save the visualisation (not part of the TFDF model but needs saving too)
                    loggerService.debug('[ml4knums] downloading visualisation');
                    return browserStorageService.storeAsset(modelStatus.classifierid + '-tree', modelinfo.urls.tree)
                        .then(() => {
                            return browserStorageService.storeAsset(modelStatus.classifierid + '-dot', modelinfo.urls.dot)
                        })
                        .then(() => {
                            return browserStorageService.storeAsset(modelStatus.classifierid + '-vocab', modelinfo.urls.vocab)
                        })
                        .catch((err) => {
                            loggerService.error('[ml4knums] failed to download visualisation', err);
                        });
                })
                .then(() => {
                    // save the assets zip
                    loggerService.debug('[ml4knums] downloading model assets');
                    return browserStorageService.storeAsset(modelStatus.classifierid + '-assets', model.assets);
                })
                .then(() => {
                    // save the graph model
                    loggerService.debug('[ml4knums] saving graph model');
                    return modelService.saveModel(MODELTYPE, modelStatus.classifierid, model.graphModel);
                })
                .then(() => {
                    loggerService.debug('[ml4knums] storing model metadata', modelinfo);
                    modelStatus.status = 'Available';
                    storeModelMetadata(modelinfo);
                })
                .catch((err) => {
                    loggerService.error('[ml4knums] failed to store model', err);
                    if (err.message && err.message.includes('BlobURLs are not yet supported')) {
                        modelStatus.status = 'Available';
                        modelStatus.warning = 'Not stored';
                    }
                    else {
                        modelStatus.status = 'Failed';
                    }
                });
        }


        function getModels() {
            loggerService.debug('[ml4knums] get models');
            if (modelDetails && modelDetails.status === 'Training' && modelStatus.progress === 33) {
                return $http.get(modelDetails.urls.status).then((resp) => {
                    const updated = resp.data;
                    updateStatus(updated);
                    return ([ modelStatus ]);
                });
            }
            else {
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
        }



        function newModel(project, userid, classid) {
            loggerService.debug('[ml4knums] creating new ML model', project.id);
            loggerService.debug('[ml4knums] tf backend', tf.getBackend());
            loggerService.debug('[ml4knums] tf precision', tf.ENV.getBool('WEBGL_RENDER_FLOAT32_ENABLED'));

            return deleteModel(project.id)
                .then(() => {
                    modelStatus = {
                        classifierid : project.id,
                        status : 'Training',
                        progress : 0,
                        updated : new Date()
                    };

                    if (project.storage === 'local') {
                        return trainingService.newLocalProjectNumbersModel(project);
                    }
                    else {
                        return trainingService.newModel(project.id, userid, classid);
                    }
                })
                .then((modelinfo) => {
                    loggerService.debug('[ml4knums] model info', modelinfo);
                    modelDetails = modelinfo;

                    modelStatus.status = modelinfo.status;
                    modelStatus.progress = 33;
                    modelStatus.updated = new Date();

                    return modelStatus;
                });
        }


        function testModel(project, data) {
            loggerService.debug('[ml4knums] testing model', data);

            const testdata = {};
            for (const key of Object.keys(data)) {
                const feature = modelDetails.features[key]
                if (feature) {
                    if (feature.type.includes('int')) {
                        testdata[feature.name] = tf.tensor([ data[key] ]).toInt();
                    }
                    else {
                        testdata[feature.name] = tf.tensor([ data[key] ]);
                    }
                }
            }

            return model.executeAsync(testdata)
                .then((result) => {
                    return result.data();
                })
                .then((output) => {
                    if (modelDetails.labels.length === 2) {
                        return [
                            {
                                class_name : modelDetails.labels[0],
                                confidence : (1 - output[0]) * 100
                            },
                            {
                                class_name : modelDetails.labels[1],
                                confidence : output[0] * 100
                            }
                        ].sort(modelService.sortByConfidence);
                    }
                    else if (modelDetails.labels.length === (output.length / 2)) {
                        const result = modelDetails.labels.map((label, idx) => {
                            return {
                                class_name : label,
                                confidence : output[idx + modelDetails.labels.length] * 100,
                            };
                        }).sort(modelService.sortByConfidence);
                        loggerService.debug('[ml4knums] model response', result);
                        return result;
                    }
                    else {
                        loggerService.error('[ml4knums] unexpected model response', output);
                        throw new Error('Unexpected response');
                    }
                });
        }



        function deleteModel(projectid) {
            model = null;
            modelStatus = null;
            modelDetails = null;
            return modelService.deleteModel(MODELTYPE, projectid)
                .then(() => {
                    return browserStorageService.deleteAsset(projectid + '-assets');
                })
                .then(() => {
                    return browserStorageService.deleteAsset(projectid + '-tree');
                })
                .then(() => {
                    return browserStorageService.deleteAsset(projectid + '-dot');
                })
                .then(() => {
                    return browserStorageService.deleteAsset(projectid + '-vocab');
                })
                .catch((err) => {
                    loggerService.error('[ml4knums] failed to delete model data', err);
                });
        }


        function getModelMetadataAsJson(key) {
            const value = storageService.getItem(key);
            if (!value) {
                throw new Error('Missing data ' + key);
            }
            return JSON.parse(value);
        }


        function loadModelMetadata(project) {
            const projectid = project.id;


            modelDetails = {
                key: projectid,
                features: getModelMetadataAsJson('ml4k-models-numbers-' + projectid + '-features'),
                labels: getModelMetadataAsJson('ml4k-models-numbers-' + projectid + '-labels'),
            };
        }
        function storeModelMetadata(modelinfo) {
            storageService.setItem('ml4k-models-numbers-' + modelStatus.classifierid + '-features',
                                   JSON.stringify(modelinfo.features));
            storageService.setItem('ml4k-models-numbers-' + modelStatus.classifierid + '-labels',
                                   JSON.stringify(modelinfo.labels));
            storageService.setItem('ml4k-models-numbers-' + modelStatus.classifierid + '-status',
                                   modelinfo.urls.status);
        }


        return {
            initNumberSupport,
            getModels,
            newModel,
            deleteModel,
            testModel
        };
    }
})();
