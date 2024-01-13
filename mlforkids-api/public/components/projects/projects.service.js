(function () {

    angular
        .module('app')
        .service('projectsService', projectsService);

    projectsService.$inject = [
        '$http', '$q',
        'browserStorageService'
    ];

    function projectsService($http, $q, browserStorageService) {

        function getClassProjects(profile) {
            return $http.get('/api/classes/' + profile.tenant + '/projects')
                .then(function (resp) {
                    return resp.data;
                });
        }

        function getProjects(profile) {
            return $q.all({
                cloud : $http.get('/api/classes/' + profile.tenant + '/students/' + profile.user_id + '/projects'),
                local : browserStorageService.getProjects(profile.user_id)
            })
            .then(function (responses) {
                return responses.cloud.data.concat(responses.local);
            });
        }

        function getProject(projectid, userid, tenant) {
            if (browserStorageService.idIsLocal(projectid)) {
                return browserStorageService.getProject(projectid);
            }
            else {
                return $http.get('/api/classes/' + tenant + '/students/' + userid + '/projects/' + projectid)
                    .then(function (resp) {
                        return resp.data;
                    });
            }
        }

        function getFields(projectid, userid, tenant) {
            return $http.get('/api/classes/' + tenant + '/students/' + userid + '/projects/' + projectid + '/fields')
                .then(function (resp) {
                    return resp.data;
                });
        }

        function getLabels(projectid, userid, tenant) {
            if (browserStorageService.idIsLocal(projectid)) {
                return browserStorageService.getLabelCounts(projectid);
            }
            else {
                return $http.get('/api/classes/' + tenant + '/students/' + userid + '/projects/' + projectid + '/labels')
                    .then(function (resp) {
                        return resp.data;
                    });
            }
        }

        function addLabelToProject(projectid, userid, tenant, newlabel) {
            if (browserStorageService.idIsLocal(projectid)) {
                return browserStorageService.addLabel(projectid, newlabel);
            }
            else {
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
        }

        function removeLabelFromProject(projectid, userid, tenant, label) {
            if (browserStorageService.idIsLocal(projectid)) {
                return browserStorageService.deleteLabel(projectid, label);
            }
            else {
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
        }

        function deleteProject(project, userid, tenant) {
            if (project.storage === 'local') {
                if (project.cloudid) {
                    $http.delete('/api/classes/' + tenant + '/students/' + userid + '/localprojects/' + project.cloudid);
                }

                return browserStorageService.deleteProject(project.id);
            }
            else {
                return $http.delete('/api/classes/' + tenant + '/students/' + userid + '/projects/' + project.id);
            }
        }

        function createProject(projectAttrs, userid, tenant) {
            if (projectAttrs.storage === 'local') {
                projectAttrs.userid = userid;
                projectAttrs.classid = tenant;
                return browserStorageService.addProject(projectAttrs);
            }
            else {
                return $http.post('/api/classes/' + tenant + '/students/' + userid + '/projects', projectAttrs)
                    .then(function (resp) {
                        return resp.data;
                    });
            }
        }

        function createLocalProject(projectAttrs, userid, tenant) {
            return $http.post('/api/classes/' + tenant + '/students/' + userid + '/localprojects', projectAttrs)
                .then(function (resp) {
                    const cloudref = resp.data;
                    return browserStorageService.addCloudRefToProject(projectAttrs.id, cloudref.id);
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


        function supportedMakes (project) {
            if (project.type === 'text') {
                return {
                    scratch : true,
                    appinventor : true,
                    edublocks : true,
                    python : true
                };
            }
            else if (project.type === 'numbers') {
                return {
                    scratch : true,
                    appinventor : true,
                    edublocks : true,
                    python : true
                };
            }
            else if (project.type === 'sounds') {
                return {
                    scratch : true,

                    appinventor : false,
                    edublocks : false,
                    python : false
                };
            }
            else if (project.type === 'imgtfjs') {
                if (project.storage === 'local') {
                    return {
                        scratch : true,
                        appinventor : false,
                        edublocks : false,
                        python : false
                    };
                }
                else {
                    return {
                        scratch : true,
                        appinventor : true,
                        edublocks : false,
                        python : true
                    };
                }
            }
            else {
                return {
                    scratch : false,
                    appinventor : false,
                    edublocks : false,
                    python : false
                };
            }
        }


        return {
            getProject : getProject,
            getProjects : getProjects,
            getClassProjects : getClassProjects,

            deleteProject : deleteProject,
            createProject : createProject,
            createLocalProject : createLocalProject,

            getFields : getFields,
            getLabels : getLabels,

            addLabelToProject : addLabelToProject,
            removeLabelFromProject : removeLabelFromProject,

            checkProjectCredentials : checkProjectCredentials,

            shareProject : shareProject,

            supportedMakes : supportedMakes
        };
    }
})();
