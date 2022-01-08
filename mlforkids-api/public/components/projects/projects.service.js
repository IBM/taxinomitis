(function () {

    angular
        .module('app')
        .service('projectsService', projectsService);

    projectsService.$inject = [
        '$q', '$http'
    ];

    function projectsService($q, $http) {

        function getClassProjects(profile) {
            return $http.get('/api/classes/' + profile.tenant + '/projects')
                .then(function (resp) {
                    return resp.data;
                });
        }

        function getProjects(profile) {
            return $http.get('/api/classes/' + profile.tenant + '/students/' + profile.user_id + '/projects')
                .then(function (resp) {
                    return resp.data;
                });
        }

        function getProject(projectid, userid, tenant) {
            return $http.get('/api/classes/' + tenant + '/students/' + userid + '/projects/' + projectid)
                .then(function (resp) {
                    return resp.data;
                });
        }

        function getFields(projectid, userid, tenant) {
            return $http.get('/api/classes/' + tenant + '/students/' + userid + '/projects/' + projectid + '/fields')
                .then(function (resp) {
                    return resp.data;
                });
        }

        function getLabels(projectid, userid, tenant) {
            return $http.get('/api/classes/' + tenant + '/students/' + userid + '/projects/' + projectid + '/labels')
                .then(function (resp) {
                    return resp.data;
                });
        }

        function addLabelToProject(projectid, userid, tenant, newlabel) {
            return $http.patch('/api/classes/' + tenant + '/students/' + userid + '/projects/' + projectid, [
                    {
                        op : 'add',
                        path : '/labels',
                        value : newlabel
                    }
                ])
                .then(function (resp) {
                    return resp.data;
                });
        }

        function removeLabelFromProject(projectid, userid, tenant, label) {
            return $http.patch('/api/classes/' + tenant + '/students/' + userid + '/projects/' + projectid, [
                    {
                        op : 'remove',
                        path : '/labels',
                        value : label
                    }
                ])
                .then(function (resp) {
                    return resp.data;
                });
        }

        function deleteProject(project, userid, tenant) {
            return $http.delete('/api/classes/' + tenant + '/students/' + userid + '/projects/' + project.id);
        }

        function createProject(projectAttrs, userid, tenant) {
            return $http.post('/api/classes/' + tenant + '/students/' + userid + '/projects', projectAttrs)
                .then(function (resp) {
                    return resp.data;
                });
        }

        function checkProjectCredentials(tenant, type) {
            return $http.get('/api/classes/' + tenant + '/modelsupport/' + type)
                .then(function (resp) {
                    return resp.data;
                })
                .catch(function (errresp) {
                    return errresp.data;
                });
        }

        function shareProject(project, userid, tenant, shareState) {
            return $http.patch('/api/classes/' + tenant + '/students/' + userid + '/projects/' + project.id + '/iscrowdsourced', [
                    {
                        op : 'replace',
                        path : '/isCrowdSourced',
                        value : shareState
                    }
                ])
                .then(function () {
                    return shareState;
                })
                .catch(function (err) {
                    if (err.status === 409) {
                        return shareState;
                    }
                    throw err;
                });
        }


        return {
            getProject : getProject,
            getProjects : getProjects,
            getClassProjects : getClassProjects,

            deleteProject : deleteProject,
            createProject : createProject,

            getFields : getFields,
            getLabels : getLabels,

            addLabelToProject : addLabelToProject,
            removeLabelFromProject : removeLabelFromProject,

            checkProjectCredentials : checkProjectCredentials,

            shareProject : shareProject
        };
    }
})();
