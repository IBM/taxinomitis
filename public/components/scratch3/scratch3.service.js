(function () {

    angular
        .module('app')
        .service('scratchService', scratchService);

        scratchService.$inject = [ '$http' ];


    function scratchService($http) {

        function newTfjsExtension(modelinfo) {
            var url = '/api/scratchtfjs/extensions';

            return $http.post(url, modelinfo)
                .then(function (resp) {
                    return resp.data;
                });
        }


        return {
            newTfjsExtension : newTfjsExtension
        };
    }
})();
