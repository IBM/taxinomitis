(function () {

    angular
        .module('app')
        .service('usersService', usersService);

    usersService.$inject = [
        '$q', '$http'
    ];


    function usersService($q, $http) {

        function getClassPolicy(profile) {
            return $http.get('/api/classes/' + profile.tenant + '/policy')
                .then(function (resp) {
                    return resp.data;
                });
        }

        function createTeacher(username, email, notes) {
            var newteacher = {
                username : username,
                email : email,
                notes : notes
            };

            return $http.post('/api/teachers', newteacher)
                .then(function (resp) {
                    return resp.data;
                });
        }

        function getStudentList(profile) {
            return $http.get('/api/classes/' + profile.tenant + '/students')
                .then(function (resp) {
                    return resp.data;
                });
        }

        function deleteStudent(profile, tenant) {
            return $http.delete('/api/classes/' + tenant + '/students/' + profile.id);
        }

        function createStudent(username, tenant) {
            var newstudent = {
                username : username
            };

            return $http.post('/api/classes/' + tenant + '/students', newstudent)
                .then(function (resp) {
                    return resp.data;
                });
        }

        function resetStudentPassword(profile, tenant) {
            return $http.post('/api/classes/' + tenant + '/students/' + profile.id + '/password')
                .then(function (resp) {
                    return resp.data;
                });
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
                .then(function (resp) {
                    return resp.data;
                });
        }



        function getCredentials(profile, type) {
            return $http.get('/api/classes/' + profile.tenant + '/credentials?servicetype=' + type)
                .then(function (resp) {
                    return resp.data;
                });
        }
        function deleteCredentials(profile, credentials) {
            return $http.delete('/api/classes/' + profile.tenant + '/credentials/' + credentials.id);
        }
        function addCredentials(credentials, tenant) {
            return $http.post('/api/classes/' + tenant + '/credentials', credentials)
                .then(function (resp) {
                    return resp.data;
                });
        }


        return {
            createTeacher : createTeacher,

            addCredentials : addCredentials,
            getCredentials : getCredentials,
            deleteCredentials : deleteCredentials,

            getClassPolicy : getClassPolicy,

            getStudentList : getStudentList,

            createStudent : createStudent,
            deleteStudent : deleteStudent,

            resetStudentPassword : resetStudentPassword,
            resetStudentsPassword : resetStudentsPassword
        };
    }
})();
