(function () {

    angular
        .module('app')
        .service('authService', authService);

    authService.$inject = [
        'lock', 'authManager',
        '$q',
        '$rootScope',
        '$state',
        '$timeout'
    ];


    function authService(lock, authManager, $q, $rootScope, $state, $timeout) {

        var vm = this;

        $rootScope.isTeacher = false;
        $rootScope.isAuthenticated = false;


        var userProfile = JSON.parse(localStorage.getItem('profile')) || null;
        var deferredProfile = $q.defer();

        if (userProfile) {
            var expiresAt = JSON.parse(localStorage.getItem('expires_at'));
            var isAuth = (new Date().getTime() < expiresAt);

            if (isAuth) {
                deferredProfile.resolve(userProfile);

                $rootScope.isTeacher = (userProfile.role === 'supervisor');
                $rootScope.isAuthenticated = true;
            }
        }


        function login() {
            lock.show({
                languageDictionary : {
                    title: 'Log in to ML for kids'
                }
            });
        }

        function reset() {
            lock.show({
                languageDictionary : {
                    title: 'Forgot your password?'
                },

                allowForgotPassword : true,
                allowLogin : false,

                initialScreen : 'forgotPassword'
            });
        }


        function logout() {
            deferredProfile = $q.defer();

            localStorage.removeItem('access_token');
            localStorage.removeItem('id_token');
            localStorage.removeItem('expires_at');
            localStorage.removeItem('scopes');

            authManager.unauthenticate();

            userProfile = null;
            $rootScope.isTeacher = false;
            $rootScope.isAuthenticated = false;
        }


        function storeToken(authResult) {
            var expiresAt = JSON.stringify((authResult.expiresIn * 1000) + new Date().getTime());

            var scopes = authResult.scope || REQUESTED_SCOPES || '';

            localStorage.setItem('access_token', authResult.accessToken);
            localStorage.setItem('id_token', authResult.idToken);
            localStorage.setItem('expires_at', expiresAt);
            localStorage.setItem('scopes', JSON.stringify(scopes));

            authManager.authenticate();
        }

        function storeProfile(profile) {
            localStorage.setItem('profile', JSON.stringify(profile));
            deferredProfile.resolve(profile);

            $rootScope.isTeacher = (profile.role === 'supervisor');
            $rootScope.isAuthenticated = true;
        }


        function extractAppMetadata(profile) {
            const tenant = profile['https://machinelearningforkids.co.uk/api/tenant'];
            const role = profile['https://machinelearningforkids.co.uk/api/role'];
            const user_id = profile.sub;
            profile.tenant = tenant;
            profile.role = role;
            profile.user_id = user_id;
            delete profile['https://machinelearningforkids.co.uk/api/tenant'];
            delete profile['https://machinelearningforkids.co.uk/api/role'];
            delete profile.sub;
            delete profile.picture;
            return profile;
        }


        function setupAuth() {
            lock.on('authenticated', function (authResult) {
                if (authResult && authResult.accessToken && authResult.idToken) {
                    storeToken(authResult);

                    lock.getUserInfo(authResult.accessToken, function (err, profile) {
                        if (err) {
                            console.log('lock auth failure');
                            console.log(err);
                            return logout();
                        }
                        vm.profile = extractAppMetadata(profile);
                        storeProfile(vm.profile);

                        $timeout(function () {
                            $state.go('welcome');
                        });
                    });
                }
            });

            lock.on('authorization_error', function (err) {
                console.log('lock authorization error');
                console.log(err);
                return logout();
            });
        }




        function getProfileDeferred() {
            return deferredProfile.promise;
        }

        function isAuthenticated() {
            // Check whether the current time is past the
            // access token's expiry time
            var expiresAt = JSON.parse(localStorage.getItem('expires_at'));
            var isAuth = (new Date().getTime() < expiresAt);
            if (!isAuth) {
                logout();
            }
            return isAuth;
        }


        return {
            login: login,
            reset : reset,
            logout: logout,

            setupAuth: setupAuth,
            getProfileDeferred: getProfileDeferred,
            isAuthenticated : isAuthenticated
        };
    }
})();
