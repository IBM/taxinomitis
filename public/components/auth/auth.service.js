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

        confirmLocalStorage();

        var userProfileStr = window.localStorageObj.getItem('profile');
        var userProfile = null;
        if (userProfileStr) {
            userProfile = JSON.parse(userProfileStr);
        }
        var deferredProfile = $q.defer();

        if (userProfile) {
            var expiresAt = JSON.parse(window.localStorageObj.getItem('expires_at'));
            var isAuth = (new Date().getTime() < expiresAt);

            if (isAuth) {
                deferredProfile.resolve(userProfile);

                $rootScope.isTeacher = (userProfile.role === 'supervisor');
                $rootScope.isAuthenticated = true;

                if (Raven) {
                    Raven.setUserContext({
                        email : userProfile.email,
                        username : userProfile.user_id
                    });
                    Raven.setExtraContext({
                        role : userProfile.role,
                        tenant : userProfile.tenant
                    });
                }
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

            window.localStorageObj.removeItem('access_token');
            window.localStorageObj.removeItem('id_token');
            window.localStorageObj.removeItem('expires_at');
            window.localStorageObj.removeItem('scopes');

            authManager.unauthenticate();

            userProfile = null;
            $rootScope.isTeacher = false;
            $rootScope.isAuthenticated = false;
        }


        function storeToken(authResult) {
            var expiresAt = JSON.stringify((authResult.expiresIn * 1000) + new Date().getTime());

            var scopes = authResult.scope || REQUESTED_SCOPES || '';

            window.localStorageObj.setItem('access_token', authResult.accessToken);
            window.localStorageObj.setItem('id_token', authResult.idToken);
            window.localStorageObj.setItem('expires_at', expiresAt);
            window.localStorageObj.setItem('scopes', JSON.stringify(scopes));

            authManager.authenticate();
        }

        function storeProfile(profile) {
            window.localStorageObj.setItem('profile', JSON.stringify(profile));
            deferredProfile.resolve(profile);

            $rootScope.isTeacher = (profile.role === 'supervisor');
            $rootScope.isAuthenticated = true;
        }


        function extractAppMetadata(profile) {
            var tenant = profile['https://machinelearningforkids.co.uk/api/tenant'];
            var role = profile['https://machinelearningforkids.co.uk/api/role'];
            var user_id = profile.sub;
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
            var expiresAt = JSON.parse(window.localStorageObj.getItem('expires_at'));
            var isAuth = (new Date().getTime() < expiresAt);
            if (!isAuth) {
                logout();
            }
            return isAuth;
        }




        function confirmLocalStorage() {
            // some browsers allow localStorage to be disabled
            window.localStorageObj = window.localStorage || {};

            // Safari, in Private Browsing Mode, looks like it supports localStorage but all calls to setItem
            // throw QuotaExceededError. If it looks like localStorage isn't working, we use a local object
            if (typeof window.localStorageObj === 'object') {
                try {
                    window.localStorageObj.setItem('confirmLocalStorage', 1);
                    window.localStorageObj.removeItem('confirmLocalStorage');
                }
                catch (e) {
                    console.log(e);
                    console.log('Replacing local storage');

                    window._tempLocalStorage = {};
                    window.localStorageObj.setItem = function (key, val) {
                        window._tempLocalStorage[key] = val;
                    };
                    window.localStorageObj.getItem = function (key) {
                        return window._tempLocalStorage[key];
                    };
                    window.localStorageObj.removeItem = function (key) {
                        delete window._tempLocalStorage[key];
                    };
                }
            }
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
