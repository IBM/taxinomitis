(function () {

    angular
        .module('app')
        .service('authService', authService);

    authService.$inject = [
        'lock',
        'authManager',
        '$q'
    ];


    function authService(lock, authManager, $q) {

        var vm = this;

        var userProfile = JSON.parse(localStorage.getItem('profile')) || null;
        var deferredProfile = $q.defer();

        if (userProfile) {
            deferredProfile.resolve(userProfile);
        }

        function login() {
            lock.show();
        }

        function logout() {
            deferredProfile = $q.defer();

            localStorage.removeItem('id_token');
            localStorage.removeItem('profile');

            authManager.unauthenticate();

            userProfile = null;
        }

        function registerAuthenticationListener() {
            lock.on('authenticated', function (authResult) {

                localStorage.setItem('id_token', authResult.idToken);
                authManager.authenticate();

                lock.getProfile(authResult.idToken, function (error, profile) {
                    vm.profile = JSON.stringify(profile);
                    localStorage.setItem('profile', vm.profile);
                    deferredProfile.resolve(profile);
                });
            });

            lock.on('authorization_error', function (err) {
                // display error
            });
        }

        function getProfileDeferred() {
            return deferredProfile.promise;
        }


        return {
            login: login,
            logout: logout,

            registerAuthenticationListener: registerAuthenticationListener,
            getProfileDeferred: getProfileDeferred,
        };
    }
})();
