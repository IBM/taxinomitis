(function () {

    angular
        .module('app')
        .service('usersService', usersService);

    usersService.$inject = [
        '$q', '$http'
    ];


    function usersService($q, $http) {

        function returnData(resp) {
            return resp.data;
        }

        function getClassPolicy(profile) {
            return $http.get('/api/classes/' + profile.tenant + '/policy')
                .then(returnData);
        }

        function modifyClassPolicy(profile, textexpiry) {
            var modification = [
                { op : 'replace', path : '/textClassifierExpiry', value : textexpiry },
            ];
            return $http.patch('/api/classes/' + profile.tenant + '/policy', modification)
                .then(returnData);
        }

        function createTeacher(username, email, notes) {
            var newteacher = {
                username : username,
                email : email,
                notes : notes
            };

            return $http.post('/api/teachers', newteacher)
                .then(returnData);
        }


        function deleteClass(profile) {
            return $http.delete('/api/classes/' + profile.tenant + '?confirm=true');
        }

        function getStudentList(profile, group) {
            return $http.get('/api/classes/' + profile.tenant + '/students?group=' + group)
                .then(returnData);
        }

        function deleteStudent(profile, tenant) {
            return $http.delete('/api/classes/' + tenant + '/students/' + profile.id);
        }

        function createStudent(userattrs, tenant) {
            var newstudent = {
                username : userattrs.username,
                group : userattrs.group
            };

            return $http.post('/api/classes/' + tenant + '/students', newstudent)
                .then(returnData);
        }

        function createStudents(tenant, prefix, number, password, group) {
            var bulkCreate = {
                prefix : prefix,
                number : number,
                password : password,
                group : group
            };
            return $http.put('/api/classes/' + tenant + '/students', bulkCreate)
                .then(returnData);
        }

        function resetStudentPassword(profile, tenant) {
            return $http.post('/api/classes/' + tenant + '/students/' + profile.id + '/password')
                .then(returnData);
        }
        function resetStudentsPassword(profiles, tenant) {
            var students = profiles.map(function (profile) {
                return {
                    op : 'replace',
                    path : '/password',
                    value : { id : profile.id }
                };
            });
            return $http.patch('/api/classes/' + tenant + '/students', students)
                .then(returnData);
        }

        function addStudentsToGroup(userids, tenant, group) {
            var students = userids.map(function (userid) {
                return {
                    op : 'replace',
                    path : '/group',
                    value : { group : group, user : userid }
                };
            });
            return $http.patch('/api/classes/' + tenant + '/students', students)
                .then(returnData);
        }
        function removeStudentsFromGroup(userids, tenant) {
            var students = userids.map(function (userid) {
                return {
                    op : 'remove',
                    path : '/group',
                    value : { user : userid }
                };
            });
            return $http.patch('/api/classes/' + tenant + '/students', students)
                .then(returnData);
        }

        function deleteStudents(userids, tenant) {
            var students = userids.map(function (userid) {
                return {
                    op : 'remove',
                    path : '/students',
                    value : { user : userid }
                };
            });
            return $http.patch('/api/classes/' + tenant, students)
                .then(returnData);
        }

        function createClassGroup(profile, groupname) {
            var modification = [
                { op : 'add', path : '/groups', value : groupname }
            ];
            return $http.patch('/api/classes/' + profile.tenant, modification)
                .then(returnData);
        }
        function deleteClassGroup(profile, groupname) {
            var modification = [
                { op : 'remove', path : '/groups', value : groupname }
            ];
            return $http.patch('/api/classes/' + profile.tenant, modification)
                .then(returnData);
        }

        function getGeneratedPassword(tenant) {
            return $http.get('/api/classes/' + tenant + '/passwords')
                .then(returnData);
        }



        function getCredentials(profile, type) {
            return $http.get('/api/classes/' + profile.tenant + '/credentials?servicetype=' + type)
                .then(returnData);
        }
        function verifyCredentials(profile, credentials) {
            return $http.get('/api/classes/' + profile.tenant + '/credentials/' + credentials.id);
        }
        function deleteCredentials(profile, credentials) {
            return $http.delete('/api/classes/' + profile.tenant + '/credentials/' + credentials.id);
        }
        function addCredentials(credentials, tenant) {
            return $http.post('/api/classes/' + tenant + '/credentials', credentials)
                .then(returnData);
        }
        function modifyCredentials(credentials, servicetype, credstype, tenant) {
            var update = [
                {
                    op : 'replace',
                    path : '/credstype',
                    value : {
                        servicetype : servicetype,
                        credstype : credstype
                    }
                }
            ];
            return $http.patch('/api/classes/' + tenant + '/credentials/' + credentials.id, update)
                .then(returnData);
        }


        return {
            createTeacher : createTeacher,

            addCredentials : addCredentials,
            getCredentials : getCredentials,
            modifyCredentials : modifyCredentials,
            verifyCredentials : verifyCredentials,
            deleteCredentials : deleteCredentials,

            getGeneratedPassword : getGeneratedPassword,

            getClassPolicy : getClassPolicy,
            modifyClassPolicy : modifyClassPolicy,

            getStudentList : getStudentList,

            createStudent : createStudent,
            createStudents : createStudents,
            deleteStudent : deleteStudent,
            deleteStudents : deleteStudents,

            resetStudentPassword : resetStudentPassword,
            resetStudentsPassword : resetStudentsPassword,

            addStudentsToGroup : addStudentsToGroup,
            removeStudentsFromGroup : removeStudentsFromGroup,

            createClassGroup : createClassGroup,
            deleteClassGroup : deleteClassGroup,

            deleteClass : deleteClass
        };
    }
})();
