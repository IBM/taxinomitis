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


        return {
            newTrainingData : newTrainingData,
            getTraining : getTraining
        };
    }
})();
