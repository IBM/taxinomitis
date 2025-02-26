(function () {

    angular
        .module('app')
        .service('wikipediaService', wikipediaService);

    wikipediaService.$inject = [ '$http' ];


    function wikipediaService($http) {

        function searchByTitle(term) {
            return $http.get('https://proxy.machinelearningforkids.co.uk/wikipedia/w/api.php', {
                    params : {
                        action : 'query',
                        format : 'json',
                        prop : 'extracts',
                        explaintext : '',
                        titles : term
                    }
                })
                .then((resp) => {
                    const responseJson = resp.data;
                    if (responseJson &&
                        responseJson.query &&
                        responseJson.query.pages &&
                        Object.keys(responseJson.query.pages).length > 0 &&
                        responseJson.query.pages[Object.keys(responseJson.query.pages)[0]].extract)
                    {
                        return responseJson.query.pages[Object.keys(responseJson.query.pages)[0]].extract;
                    }
                    return 'not found';
                });
        }


        return {
            searchByTitle
        };
    }
})();
