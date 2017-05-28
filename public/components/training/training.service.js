(function () {

    angular
        .module('app')
        .service('trainingService', trainingService);

    trainingService.$inject = [
        '$q', '$http'
    ];

    function trainingService($q, $http) {


        function newTrainingData(projectid, userid, tenant, data, label) {
            var url = '/api/classes/' + tenant +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/training';

            return $http.post(url, { data : data, label : label })
                .then(function (resp) {
                    return resp.data;
                });
        }

        function getTraining(projectid, userid, tenant) {
            var url = '/api/classes/' + tenant +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/training';

            return $http.get(url, { headers : { Range : 'items=0-1000' } })
                .then(function (resp) {
                    return resp.data;
                });
        }

        function getModels(projectid, userid, tenant) {
            var url = '/api/classes/' + tenant +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/models';

            return $http.get(url).then(function (resp) {
                return resp.data;
            });
        }

        function newModel(projectid, userid, tenant) {
            var url = '/api/classes/' + tenant +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/models';

            return $http.post(url).then(function (resp) {
                return resp.data;
            });
        }

        function testModel(projectid, projecttype, userid, tenant, modelid, testtext) {
            var url = '/api/classes/' + tenant +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/models/' + modelid +
                        '/label';

            return $http.post(url, { type : projecttype, text : testtext })
                .then(function (resp) {
                    return resp.data;
                });
        }

        function deleteModel(projectid, userid, tenant, modelid) {
            var url = '/api/classes/' + tenant +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/models/' + modelid;

            return $http.delete(url);
        }


        return {
            newTrainingData : newTrainingData,
            getTraining : getTraining,
            getModels : getModels,
            newModel : newModel,
            testModel : testModel,
            deleteModel : deleteModel
        };
    }
})();
