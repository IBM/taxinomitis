(function () {

    angular
        .module('app')
        .service('authService', authService);

    authService.$inject = [
        'angularAuth0',
        '$q',
        '$rootScope',
        '$state',
        '$timeout'
    ];


    function authService(angularAuth0, $q, $rootScope, $state, $timeout) {

        var vm = this;

        var userProfile = JSON.parse(localStorage.getItem('profile')) || null;
        var deferredProfile = $q.defer();

        if (userProfile) {
            deferredProfile.resolve(userProfile);

            $rootScope.isTeacher = (userProfile.role === 'supervisor');
        }

        function login() {
            angularAuth0.authorize();
        }

        function reset(emailAddress, callback) {
            angularAuth0.changePassword({
                connection : 'ml-for-kids-users',
                email : emailAddress
            }, callback);
        }


        function logout() {
            deferredProfile = $q.defer();

            localStorage.removeItem('access_token');
            localStorage.removeItem('id_token');
            localStorage.removeItem('expires_at');
            localStorage.removeItem('scopes');

            // authManager.unauthenticate();

            userProfile = null;
            $rootScope.isTeacher = false;
            $rootScope.isAuthenticated = false;
        }

        function setupAuth() {
            angularAuth0.parseHash(function(err, authResult) {
                if (err) {
                    console.log(err);
                    return logout();
                }

                if (authResult && authResult.idToken) {
                    // Set the time that the access token will expire at
                    let expiresAt = JSON.stringify((authResult.expiresIn * 1000) + new Date().getTime());

                    // If there is a value on the `scope` param from the authResult,
                    // use it to set scopes in the session for the user. Otherwise
                    // use the scopes as requested. If no scopes were requested,
                    // set it to nothing
                    var scopes = authResult.scope || REQUESTED_SCOPES || '';

                    localStorage.setItem('access_token', authResult.accessToken);
                    localStorage.setItem('id_token', authResult.idToken);
                    localStorage.setItem('expires_at', expiresAt);
                    localStorage.setItem('scopes', JSON.stringify(scopes));

                    angularAuth0.client.userInfo(authResult.accessToken, function(error, profile) {
                        if (error) {
                            console.log('lock auth failure');
                            console.log(error);
                            return logout();
                        }

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

                        vm.profile = profile;

                        localStorage.setItem('profile', JSON.stringify(vm.profile));
                        deferredProfile.resolve(profile);

                        $rootScope.isTeacher = (profile.role === 'supervisor');
                        $rootScope.isAuthenticated = true;


                        $timeout(function() {
                            $state.go('welcome');
                        });
                    });
                }
            });
        }

        function getProfileDeferred() {
            return deferredProfile.promise;
        }

        function isAuthenticated() {
            // Check whether the current time is past the
            // access token's expiry time
            let expiresAt = JSON.parse(localStorage.getItem('expires_at'));
            return new Date().getTime() < expiresAt;
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
