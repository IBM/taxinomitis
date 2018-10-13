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


        function getClassesList() {
            return $http.get('/api/classes')
                .then(returnData);
        }

        function getStudentList(profile) {
            return $http.get('/api/classes/' + profile.tenant + '/students')
                .then(returnData);
        }

        function deleteStudent(profile, tenant) {
            return $http.delete('/api/classes/' + tenant + '/students/' + profile.id);
        }

        function createStudent(username, tenant) {
            var newstudent = {
                username : username
            };

            return $http.post('/api/classes/' + tenant + '/students', newstudent)
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



        function getCredentials(profile, type) {
            return $http.get('/api/classes/' + profile.tenant + '/credentials?servicetype=' + type)
                .then(returnData);
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

            getClassesList : getClassesList,

            addCredentials : addCredentials,
            getCredentials : getCredentials,
            modifyCredentials : modifyCredentials,
            deleteCredentials : deleteCredentials,

            getClassPolicy : getClassPolicy,

            getStudentList : getStudentList,

            createStudent : createStudent,
            deleteStudent : deleteStudent,

            resetStudentPassword : resetStudentPassword,
            resetStudentsPassword : resetStudentsPassword,


            deleteClass : deleteClass
        };
    }
})();
