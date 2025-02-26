(function () {

    angular
        .module('app')
        .service('languageModelService', languageModelService);

    languageModelService.$inject = [
        '$http',
    ];

    function languageModelService($http) {

        function generateNgrams(userid, tenant, inputstrings) {
            var url = '/api/classes/' + tenant + '/students/' + userid + '/training/ngrams';
            return $http.post(url, { input : inputstrings })
                .then((resp) => {
                    return resp.data;
                });
        }


        return {
            generateNgrams
        };
    }
})();