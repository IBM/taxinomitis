(function () {

    angular
        .module('app')
        .service('scratchkeysService', scratchkeysService);

    scratchkeysService.$inject = [
        '$q', '$http'
    ];

    function scratchkeysService($q, $http) {

        function getScratchKeys(projectid, userid, tenant) {
            return $http.get('/api/classes/' + tenant + '/students/' + userid + '/projects/' + projectid + '/scratchkeys')
                .then(function (resp) {
                    return resp.data;
                });
        }


        return {
            getScratchKeys : getScratchKeys
        };
    }
})();
