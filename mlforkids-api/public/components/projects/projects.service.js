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

        function getLabels(project, userid, tenant) {
            if (project.storage === 'local') {
                if (project.type === 'regression') {
                    return browserStorageService.countTrainingData(project.id)
                        .then(function (count) {
                            let outputcolumns = 0;
                            if (project.columns) {
                                outputcolumns = project.columns.filter(p => p.output).length;
                            }
                            return { data : count, outputcolumns };
                        });
                }
                return browserStorageService.getLabelCounts(project.id);
            }
            else {
                return $http.get('/api/classes/' + tenant + '/students/' + userid + '/projects/' + project.id + '/labels')
                    .then(function (resp) {
                        return resp.data;
                    });
            }
        }


        function submitLocalProjectLabels(project, newlabels) {
            return $http.put('/api/classes/' + project.classid + '/students/' + project.userid + '/localprojects/' + project.cloudid, { labels : newlabels })
                .then(function (resp) {
                    return resp.data.labels;
                })
                .catch(function (err) {
                    if (err.status === 404) {
                        // cloud reference for this project has expired - remove
                        browserStorageService.addCloudRefToProject(project.id, null);
                        delete project.cloudid;
                    }
                    return newlabels;
                });
        }


        function updateLocalProjectLabels(project, newlabels) {
            if (project.type === 'text') {
                // TEXT PROJECTS - labels are stored in the cloud to enable Scratch extensions

                if (project.cloudid) {
                    // PROJECT ALREADY STORED IN THE CLOUD
                    //  update with new set of labels
                    return submitLocalProjectLabels(project, newlabels);
                }
                else {
                    // PROJECT NOT YET STORED IN CLOUD
                    //  wait until we need to create a Scratch extension
                    return Promise.resolve(newlabels);

                    // project.labels = newlabels;
                    // return createLocalProject(project, project.userid, project.classid)
                    //     .then(function (storedproject) {
                    //         return storedproject.labels;
                    //     });
                }
            }
            else {
                return Promise.resolve(newlabels);
            }
        }


        function addLabelToProject(project, userid, tenant, newlabel) {
            if (project.storage === 'local') {
                return browserStorageService.addLabel(project.id, newlabel)
                    .then(function (newlabels) {
                        return updateLocalProjectLabels(project, newlabels);
                    });
            }
            else {
                return $http.patch('/api/classes/' + tenant + '/students/' + userid + '/projects/' + project.id, [
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

        function removeLabelFromProject(project, userid, tenant, label) {
            if (project.storage === 'local') {
                return browserStorageService.deleteLabel(project.id, label)
                    .then(function (newlabels) {
                        return updateLocalProjectLabels(project, newlabels);
                    });
            }
            else {
                return $http.patch('/api/classes/' + tenant + '/students/' + userid + '/projects/' + project.id, [
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


        function addMetadataToProject(project, key, value) {
            if (project.storage === 'local') {
                return browserStorageService.addMetadataToProject(project.id, key, value);
            }
            else {
                return Promise.reject(new Error('Unexpected project type'));
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
                    edublocks : true,
                    python : true
                };
            }
            else if (project.type === 'numbers') {
                return {
                    scratch : true,
                    edublocks : true,
                    python : true
                };
            }
            else if (project.type === 'sounds') {
                return {
                    scratch : true,
                    edublocks : false,
                    python : false
                };
            }
            else if (project.type === 'imgtfjs') {
                if (project.storage === 'local') {
                    return {
                        scratch : true,
                        edublocks : false,
                        python : false
                    };
                }
                else {
                    return {
                        scratch : true,
                        edublocks : false,
                        python : true
                    };
                }
            }
            else if (project.type === 'regression') {
                return {
                    scratch : true,
                    edublocks : false,
                    python : false
                };
            }
            else {
                return {
                    scratch : false,
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
            addMetadataToProject : addMetadataToProject,

            checkProjectCredentials : checkProjectCredentials,

            shareProject : shareProject,

            supportedMakes : supportedMakes
        };
    }
})();
