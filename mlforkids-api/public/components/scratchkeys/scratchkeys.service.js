(function () {

    angular
        .module('app')
        .service('scratchkeysService', scratchkeysService);

    scratchkeysService.$inject = [
        '$http',
        'projectsService',
        'browserStorageService'
    ];

    function scratchkeysService($http, projectsService, browserStorageService) {

        function get(project, userid, tenant) {
            var url;
            if (project.storage === 'local') {
                url = '/api/classes/' + tenant +
                        '/students/' + userid +
                        '/localprojects/' + project.cloudid +
                        '/scratchkeys';
            }
            else {
                url = '/api/classes/' + tenant +
                        '/students/' + userid +
                        '/projects/' + project.id +
                        '/scratchkeys';
            }
            return $http.get(url)
                .then(function (resp) {
                    return resp.data;
                })
                .catch(function (err) {
                    if (project.storage === 'local' && project.type === 'text') {
                        // cloud reference for this project has expired - remove
                        browserStorageService.addCloudRefToProject(project.id, null);
                        delete project.cloudid;
                    }
                    throw err;
                });
        }


        function getScratchKeys(project, userid, tenant) {
            if (project.storage === 'local') {
                if (project.cloudid) {
                    return get(project, userid, tenant);
                }
                else {
                    return projectsService.createLocalProject(project, userid, tenant)
                        .then(function (cloudproject) {
                            project.cloudid = cloudproject.cloudid;
                            return get(project, userid, tenant);
                        });
                }
            }
            else {
                return get(project, userid, tenant);
            }
        }


        return {
            getScratchKeys : getScratchKeys
        };
    }
})();
