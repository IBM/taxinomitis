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

        let model;
        let modelStatus;
        let modelDetails;

        let ydf;


        function loadYdf() {
            loggerService.debug('[ml4knums] loading ydf');
            return utilService.loadNumberProjectSupport()
                .then(function (ydfInstance) {
                    ydf = ydfInstance;
                })
                .catch(function (err) {
                    loggerService.error('[ml4knums] failed to load ydf', err);
                    throw err;
                });
        }


        function loadModel(project) {
            loggerService.debug('[ml4knums] loading model');
            modelStatus = {
                classifierid : project.id,
                status : 'Loading',
                progress : 0,
                updated : getModelDate(project)
            };

            return browserStorageService.retrieveAsset(project.id + '-model')
                .then((modelzip) => {
                    loggerService.debug('[ml4knums] opening model');
                    return ydf.loadModelFromZipBlob(modelzip);
                })
                .then((ydfmodel) => {
                    loadModelMetadata(project);
                    model = ydfmodel;

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
            return loadYdf()
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
            loggerService.debug('[ml4knums] loading ydf model', modelinfo.urls.model);

            // save the model zip to browser storage
            browserStorageService.storeAsset(modelStatus.classifierid + '-model', modelinfo.urls.model)
                .then(() => {
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
                    // check that the model can be loaded from storage
                    //  before declaring it available
                    return browserStorageService.retrieveAsset(modelStatus.classifierid + '-model');
                })
                .then((modelzip) => {
                    loggerService.debug('[ml4knums] opening model');
                    return ydf.loadModelFromZipBlob(modelzip);
                })
                .then((ydfmodel) => {
                    model = ydfmodel;

                    loggerService.debug('[ml4knums] storing model metadata', modelinfo);
                    modelStatus.status = 'Available';
                    storeModelMetadata(modelinfo);
                })
                .catch((err) => {
                    loggerService.error('[ml4knums] failed to store model', err);
                    if (modelStatus) {
                        if (err.message && err.message.includes('BlobURLs are not yet supported')) {
                            modelStatus.status = 'Available';
                            modelStatus.warning = 'Not stored';
                        }
                        else if (browserStorageService.isCorruptedDatabase(err)) {
                            modelStatus.status = 'Available';
                            modelStatus.warning = 'Not stored';

                            return browserStorageService.deleteAssetsDatabase();
                        }
                        else {
                            modelStatus.status = 'Failed';
                        }
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
                    if (modelinfo.error) {
                        modelStatus.error = { data : modelinfo.error };
                    }

                    return modelStatus;
                });
        }


        function testModel(project, data) {
            loggerService.debug('[ml4knums] testing model', data);

            const testdata = {};
            for (const key of Object.keys(data)) {
                const feature = modelDetails.features[key]
                if (feature) {
                    testdata[feature.name] = [ data[key] ];
                }
            }

            return $q(function (resolve, reject) {
                const output = model.predict(testdata);
                if (modelDetails.labels.length === 2) {
                    resolve([
                        {
                            class_name : modelDetails.labels[0],
                            confidence : (1 - output[0]) * 100
                        },
                        {
                            class_name : modelDetails.labels[1],
                            confidence : output[0] * 100
                        }
                    ].sort(modelService.sortByConfidence));
                }
                else if (modelDetails.labels.length === output.length) {
                    const result = modelDetails.labels.map((label, idx) => {
                        return {
                            class_name : label,
                            confidence : output[idx] * 100,
                        };
                    }).sort(modelService.sortByConfidence);
                    loggerService.debug('[ml4knums] model response', result);
                    resolve(result);
                }
                else {
                    loggerService.error('[ml4knums] unexpected model response', output);
                    reject(new Error('Unexpected response'));
                }
            });
        }



        function deleteModel(projectid) {
            if (model) {
                model.unload();
            }

            model = null;
            modelStatus = null;
            modelDetails = null;
            storageService.removeItem('ml4k-models-numbers-' + projectid + '-date');
            return browserStorageService.deleteAsset(projectid + '-model')
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

        function getModelDate(project) {
            try {
                const key = 'ml4k-models-numbers-' + project.id + '-date';
                const value = storageService.getItem(key);
                if (!value) {
                    return new Date();
                }
                else {
                    return new Date(parseInt(value));
                }
            }
            catch (err) {
                loggerService.error('[ml4knums] model date parsing error', err);
                return new Date();
            }
        }
        function setModelDate(classifierid) {
            const key = 'ml4k-models-numbers-' + classifierid + '-date';
            storageService.setItem(key, Date.now());
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
            setModelDate(modelStatus.classifierid);
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
