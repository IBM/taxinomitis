(function () {
  'use strict';

  angular
    .module('app')
    .controller('PingController', PingController);

  PingController.$inject = ['authService', '$http'];


  function getStudents (vm, $http) {
    $http.get('/api/classes/' + vm.profile.tenant + '/students')
      .then(function (result) {
        vm.pingResult = result.data;
      }, function (error) {
        console.log(error);
        vm.pingResult = error.statusText;
      });
  }

  function createStudent (vm, $http) {
      var newstudent = {
        username : 'stub-test-user'
      };

      $http.post('/api/classes/' + vm.profile.tenant + '/students', newstudent)
        .then(function (result) {
          vm.pingResult = result.data;
        }, function (error) {
          vm.pingResult = error.data;
        });
  }

  function deleteStudent (vm, $http) {
      var userid = 'auth0|58dd727c1abdf4687c6d4cca';

      $http.delete('/api/classes/' + vm.profile.tenant + '/students/' + userid)
        .then(function (result) {
          vm.pingResult = 'deleted';
        }, function (error) {
          vm.pingResult = error.data;
        });
  }

  function resetStudentPassword (vm, $http) {
      var userid = 'auth0|58dd72d0b2e87002695249b6';

      $http.post('/api/classes/' + vm.profile.tenant + '/students/' + userid + '/password')
        .then(function (result) {
          vm.pingResult = result.data;
        }, function (error) {
          vm.pingResult = error.data;
        });
  }


  function createProject (vm, $http) {
    var userid = vm.profile.user_id;
    var classid = vm.profile.tenant;

    var newproject = {
      name : 'belongs to bobby',
      type : 'text'
    };

    $http.post('/api/classes/' + classid + '/students/' + userid + '/projects', newproject)
      .then(function (result) {
        vm.pingResult = result.data;
      }, function (error) {
        vm.pingResult = error.data;
      });
  }


  function getMyProjects (vm, $http) {
    var userid = vm.profile.user_id;
    var classid = vm.profile.tenant;

    $http.get('/api/classes/' + classid + '/students/' + userid + '/projects')
      .then(function (result) {
        vm.pingResult = result.data;
      }, function (error) {
        vm.pingResult = error.statusText;
      });
  }

  function getAllProjects (vm, $http) {
    $http.get('/api/classes/' + vm.profile.tenant + '/projects')
      .then(function (result) {
        vm.pingResult = result.data;
      }, function (error) {
        vm.pingResult = error.statusText;
      });
  }


  function PingController(authService, $http) {

    var vm = this;
    vm.authService = authService;

    authService.getProfileDeferred().then(function (profile) {
      vm.profile = profile;
    });

    // The user's JWT will automatically be attached
    // as an authorization header on HTTP requests
    vm.ping = function () {
      // createProject(vm, $http);
      // getMyProjects(vm, $http);
      // getAllProjects(vm, $http);
      // getStudents(vm, $http);
      // createStudent(vm, $http);
      // deleteStudent(vm, $http);
      resetStudentPassword(vm, $http);
    };

  }

}());
