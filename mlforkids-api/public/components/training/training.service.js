(function () {

    angular
        .module('app')
        .service('trainingService', trainingService);

    trainingService.$inject = [
        '$http',
        'browserStorageService'
    ];

    function trainingService($http, browserStorageService) {

        var INVALID_TEXT_CHARS = /[\t\n]/g;

        function newTrainingData(projectid, userid, tenant, projecttype, storagetype, data, label) {
            if (storagetype === 'local') {
                if (projecttype === 'imgtfjs') {
                    var url = '/api/classes/' + tenant +
                                '/students/' + userid +
                                '/training/images';
                    var trainingObject;
                    return $http.get(url, { params: { imageurl : data, label : label, option : 'check' } })
                        .then(function (resp) {
                            trainingObject = resp.data;
                            return $http.get(url, {
                                responseType : 'arraybuffer',
                                params: { imageurl : data, label : label, option : 'prepare' }
                            });
                        })
                        .then(function (resp) {
                            trainingObject.imagedata = resp.data;
                            return browserStorageService.addTrainingData(projectid, trainingObject);
                        });
                }
                else if (projecttype === 'text') {
                    var trainingObject = {
                        textdata : data.replace(INVALID_TEXT_CHARS, ' '),
                        label : label
                    };
                    return browserStorageService.addTrainingData(projectid, trainingObject);
                }
                else {
                    console.error('unexpected project type', projecttype);
                }
            }
            else {
                var url = '/api/classes/' + tenant +
                            '/students/' + userid +
                            '/projects/' + projectid +
                            '/training';

                return $http.post(url, { data : data, label : label })
                    .then(function (resp) {
                        return resp.data;
                    });
            }
        }

        function deleteTrainingData(projectid, userid, tenant, trainingdataid) {
            if (browserStorageService.idIsLocal(projectid)) {
                return browserStorageService.deleteTrainingData(projectid, trainingdataid);
            }
            else {
                var url = '/api/classes/' + tenant +
                            '/students/' + userid +
                            '/projects/' + projectid +
                            '/training/' + trainingdataid;

                return $http.delete(url);
            }
        }

        function getTraining(projectid, userid, tenant) {
            if (browserStorageService.idIsLocal(projectid)) {
                return browserStorageService.getTrainingData(projectid)
                    .then(function (trainingitems) {
                        return trainingitems.map(function (trainingitem) {
                            if (!trainingitem.imageurl && trainingitem.imagedata) {
                                // TODO cleanup
                                trainingitem.imageurl = URL.createObjectURL(trainingitem.imagedata);
                            }
                            return trainingitem;
                        });
                    });
            }
            else {
                var url = '/api/classes/' + tenant +
                            '/students/' + userid +
                            '/projects/' + projectid +
                            '/training';

                return $http.get(url, { headers : { Range : 'items=0-3000' } })
                    .then(function (resp) {
                        return resp.data;
                    });
            }
        }

        function getTrainingItem(projectid, userid, tenant, trainingid) {
            if (browserStorageService.idIsLocal(projectid)) {
                return browserStorageService.getTrainingDataItem(projectid, trainingid);
            }
            else {
                var url = '/api/classes/' + tenant +
                            '/students/' + userid +
                            '/projects/' + projectid +
                            '/training/' + trainingid;

                return $http.get(url, { responseType : 'arraybuffer' })
                    .then(function (resp) {
                        return resp.data;
                    })
                    .catch(function (err) {
                        if (err.status) {
                            // because we explicitly request an arraybuffer, we need
                            //  to decode the JSON payload in the event of an error
                            err.data = JSON.parse(new TextDecoder().decode(err.data));
                        }
                        throw err;
                    });
            }
        }

        function getSoundData(soundobj) {
            if (soundobj.audiodata) {
                return Promise.resolve(soundobj);
            }
            else {
                return $http.get(soundobj.audiourl)
                    .then(function (resp) {
                        soundobj.audiodata = resp.data;
                        return soundobj;
                    });
            }
        }

        function getModels(projectid, userid, tenant) {
            if (browserStorageService.idIsLocal(projectid)) {
                return Promise.resolve([]);
            }
            else {
                var url = '/api/classes/' + tenant +
                            '/students/' + userid +
                            '/projects/' + projectid +
                            '/models';

                return $http.get(url).then(function (resp) {
                    var models = resp.data;
                    if (models) {
                        var now = new Date();
                        for (var i = 0; i < models.length; i++) {
                            models[i].lastPollTime = now;
                        }
                    }
                    return models;
                });
            }
        }

        function getModel(projectid, userid, tenant, modelid, timestamp) {
            var url = '/api/classes/' + tenant +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/models/' + modelid +
                        '?ts=' + timestamp;

             return $http.get(url).then(function (resp) {
                return resp.data;
            });
        }

        function newModel(projectid, userid, tenant) {
            var url = '/api/classes/' + tenant +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/models';

            return $http.post(url, {}, { timeout : 180000 }).then(function (resp) {
                resp.data.lastPollTime = new Date();
                return resp.data;
            });
        }

        function testModel(projectid, userid, tenant, modelid, credsid, testdata) {
            var url = '/api/classes/' + tenant +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/models/' + modelid +
                        '/label';
            testdata.credentialsid = credsid;

            return $http.post(url, testdata)
                .then(function (resp) {
                    return resp.data;
                });
        }

        function testModelPrep(projectid, userid, tenant, modelid, testdata) {
            var url = '/api/classes/' + tenant +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/models/' + modelid +
                        '/label';

            return $http.post(url, testdata, { responseType : 'arraybuffer' })
                .then(function (resp) {
                    return resp.data;
                })
                .catch(function (err) {
                    if (err.status) {
                        // because we explicitly request an arraybuffer, we need
                        //  to decode the JSON payload in the event of an error
                        err.data = JSON.parse(new TextDecoder().decode(err.data));
                    }
                    throw err;
                });
        }

        function deleteModel(projectid, userid, tenant, modelid) {
            var url = '/api/classes/' + tenant +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/models/' + modelid;

            return $http.delete(url);
        }


        function uploadImage(projectid, userid, tenant, imgdata, label) {
            if (browserStorageService.idIsLocal(projectid)) {
                return browserStorageService.addTrainingData(projectid, {
                    imagedata: imgdata,
                    isstored: true,
                    label: label
                })
                .then(function (trainingitem) {
                    trainingitem.imageurl = URL.createObjectURL(trainingitem.imagedata);
                    return trainingitem;
                });
            }
            else {
                var url = '/api/classes/' + tenant +
                            '/students/' + userid +
                            '/projects/' + projectid +
                            '/images';

                var data = new FormData();
                data.append('image', imgdata, 'webcam.jpg');
                data.append('label', label);

                var postreq = {
                    transformRequest: angular.identity,
                    headers: { 'Content-Type': undefined }
                };

                return $http.post(url, data, postreq)
                    .then(function (resp) {
                        return resp.data;
                    });
            }
        }

        function uploadSound(projectid, userid, tenant, projecttype, storagetype, audiodata, label) {
            if (storagetype === 'local') {
                return browserStorageService.addTrainingData(projectid, {
                    audiodata: audiodata,
                    label: label
                })
                .then(function (trainingitem) {
                    return trainingitem;
                });
            }
            else {
                var url = '/api/classes/' + tenant +
                            '/students/' + userid +
                            '/projects/' + projectid +
                            '/sounds';

                return $http.post(url, { data : audiodata, label : label })
                    .then(function (resp) {
                        return resp.data;
                    });
            }
        }



        function getUnmanagedClassifiers(tenant) {
            var url = '/api/classes/' + tenant + '/classifiers';

            return $http.get(url, { params : { type : 'unmanaged' } })
                .then(function (resp) {
                    return resp.data;
                });
        }

        function deleteBluemixClassifier(tenant, classifierid, credentialsid, type) {
            var url = '/api/classes/' + tenant + '/classifiers/' + classifierid;

            return $http.delete(url, {
                params : {
                    type : type,
                    credentialsid : credentialsid
                }
            });
        }


        return {
            newTrainingData : newTrainingData,
            uploadImage : uploadImage,

            uploadSound : uploadSound,
            getSoundData : getSoundData,

            getTraining : getTraining,
            getTrainingItem : getTrainingItem,
            deleteTrainingData : deleteTrainingData,
            getModels : getModels,
            getModel : getModel,
            newModel : newModel,
            testModel : testModel,
            testModelPrep : testModelPrep,
            deleteModel : deleteModel,

            getUnmanagedClassifiers : getUnmanagedClassifiers,
            deleteBluemixClassifier : deleteBluemixClassifier
        };
    }
})();
