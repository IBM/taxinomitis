(function () {

    angular
        .module('app')
        .service('authService', authService);

    authService.$inject = [
        'lock',
        'authManager',
        '$q',
        '$rootScope'
    ];


    function authService(lock, authManager, $q, $rootScope) {

        var vm = this;

        var userProfile = JSON.parse(localStorage.getItem('profile')) || null;
        var deferredProfile = $q.defer();

        if (userProfile) {
            deferredProfile.resolve(userProfile);

            $rootScope.isTeacher = (userProfile.role === 'supervisor');
        }

        function login() {
            lock.show();
        }

        function reset() {
            lock.show({
                allowForgotPassword : true,
                allowLogin : false,

                initialScreen : 'forgotPassword'
            });
        }


        function logout() {
            deferredProfile = $q.defer();

            localStorage.removeItem('id_token');
            localStorage.removeItem('profile');

            authManager.unauthenticate();

            userProfile = null;
            $rootScope.isTeacher = false;
        }

        function registerAuthenticationListener() {
            lock.on('authenticated', function (authResult) {

                localStorage.setItem('id_token', authResult.idToken);
                authManager.authenticate();

                lock.getProfile(authResult.idToken, function (error, profile) {
                    if (error) {
                        console.log('lock auth failure');
                        console.log(error);
                        return logout();
                    }
                    vm.profile = JSON.stringify(profile);
                    localStorage.setItem('profile', vm.profile);
                    deferredProfile.resolve(profile);

                    $rootScope.isTeacher = (profile.role === 'supervisor');
                });
            });

            lock.on('authorization_error', function (err) {
                console.log('lock authorization_error');
                console.log(err);
                return logout();
            });
        }

        function getProfileDeferred() {
            return deferredProfile.promise;
        }


        return {
            login: login,
            reset : reset,
            logout: logout,

            registerAuthenticationListener: registerAuthenticationListener,
            getProfileDeferred: getProfileDeferred,
        };
    }
})();
