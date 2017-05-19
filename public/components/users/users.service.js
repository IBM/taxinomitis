(function () {

    angular
        .module('app')
        .service('usersService', usersService);

    usersService.$inject = [
        '$q', '$http'
    ];


    function usersService($q, $http) {

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



        return {
            getStudentList : getStudentList,

            createStudent : createStudent,
            deleteStudent : deleteStudent,

            resetStudentPassword : resetStudentPassword
        };
    }
})();
