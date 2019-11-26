(function () {

    angular
        .module('app')
        .service('authService', authService);

    if (AUTH0_CLIENT_ID) {
        authService.$inject = [
            'authManager',
            '$q', '$http',
            '$mdDialog',
            '$rootScope',
            '$window',
            '$state',
            '$timeout',
            'lock'
        ];
    }
    else {
        authService.$inject = [
            'authManager',
            '$q', '$http',
            '$mdDialog',
            '$rootScope',
            '$window',
            '$state',
            '$timeout'
        ];
    }


    function authService(authManager, $q, $http, $mdDialog, $rootScope, $window, $state, $timeout, lock) {

        var SESSION_USERS_CLASS = 'session-users';

        // To avoid a session ever expiring, the UI will try to silently refresh
        //  access tokens in the background.
        // We'll do this 10 minutes before the token expires, to avoid risking a
        //  timing window where we're too late to do it.
        // This constant is the time before the token expiry when we'll try doing it.
        var TEN_MINUTES_MILLISECS = 600000;

        var vm = this;

        // If the user is logged in as a registered user, we'll try and refresh
        //  their access token for them before it expires, to prevent them from
        //  being logged off while active.
        // This timer is used to do that.
        var nextRefreshTimer = null;

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
            if (hasSessionExpired()) {
                // We found an access token in local storage, but it
                // has expired, so we'll wipe it and force them to
                // log in again.
                logout();
            }
            else {
                deferredProfile.resolve(userProfile);

                $rootScope.isTeacher = (userProfile.role === 'supervisor');
                $rootScope.isAuthenticated = true;

                if (Sentry) {
                    Sentry.configureScope(function (scope) {
                        scope.setUser({
                            email : userProfile.email,
                            username : userProfile.user_id
                        });
                        scope.setExtra('role', userProfile.role);
                        scope.setExtra('tenant', userProfile.tenant);
                    });
                }

                // Try to keep the user logged in while they're still active
                //  by refreshing their access token for them in the background
                // This can't be done for "Try it now" users, as those sessions
                //  can't be renewed.
                if (userProfile.tenant !== SESSION_USERS_CLASS) {
                    var expiresAt = JSON.parse(window.localStorageObj.getItem('expires_at'));
                    var refreshTime = expiresAt - TEN_MINUTES_MILLISECS;
                    var timeToRefresh = refreshTime - (new Date().getTime());
                    if (timeToRefresh > 0) {
                        scheduleTokenRenewal(timeToRefresh);
                    }
                    else {
                        // the session is going to expire within 10 minutes, so
                        // we'll refresh it immediately
                        renewLogin();
                    }
                }
            }
        }


        function scheduleTokenRenewal(timeToRefreshMs) {
            // var refreshTime = new Date(Date.now() + timeToRefreshMs);
            // console.log('scheduling token renewal in ' +
            //             Math.round(timeToRefreshMs / 1000 / 60) + ' minutes (' +
            //             refreshTime.toString());
            nextRefreshTimer = setTimeout(renewLogin, timeToRefreshMs);
        }


        function renewLogin() {
            // console.log('renewing login');
            if (lock) {
                lock.checkSession({}, function (err, authres) {
                    if (err) {
                        console.log('failed to renew login');
                        console.log(err);
                    }
                    else if (authres) {
                        // console.log('renewed login');
                        // console.log(authres);
                        storeToken(authres);

                        // schedule the next renewal!
                        var expiresInSeconds = authres.expiresIn;
                        var expiresInMillisecs = expiresInSeconds * 1000;
                        var timeToRefreshLogin = expiresInMillisecs - TEN_MINUTES_MILLISECS;
                        if (timeToRefreshLogin > 0) {
                            scheduleTokenRenewal(timeToRefreshLogin);
                        }
                    }
                });
            }
            else {
                console.log('Unexpected call to renewLogin');
            }
        }


        function login() {
            if (lock) {
                lock.show({
                    languageDictionary : {
                        title: 'Log in to ML for Kids'
                    }
                });
            }
            else {
                console.log('Unexpected call to login');
            }
        }

        function reset() {
            if (lock) {
                lock.show({
                    languageDictionary : {
                        title: 'Forgot your password?'
                    },

                    allowForgotPassword : true,
                    allowLogin : false,

                    initialScreen : 'forgotPassword'
                });
            }
            else {
                console.log('Unexpected call to reset');
            }
        }


        function clearAuthData() {
            if (nextRefreshTimer) {
                clearTimeout(nextRefreshTimer);
                nextRefreshTimer = null;
            }

            deferredProfile = $q.defer();

            window.localStorageObj.removeItem('access_token');
            window.localStorageObj.removeItem('id_token');
            window.localStorageObj.removeItem('expires_at');
            window.localStorageObj.removeItem('scopes');
            window.localStorageObj.removeItem('profile');

            authManager.unauthenticate();

            userProfile = null;
            $rootScope.isTeacher = false;
            $rootScope.isAuthenticated = false;

            $rootScope.$broadcast('authStateChange', 'cleared auth data');
        }

        function logout() {
            if (userProfile && userProfile.tenant === SESSION_USERS_CLASS && authManager.isAuthenticated()) {
                deleteSessionUser(userProfile.user_id)
                    .then(function () {
                        clearAuthData();
                    });
            }
            else {
                clearAuthData();
            }
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
            if (lock) {
                lock.interceptHash();

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

                            // schedule a refresh of the token a little before
                            //  it is due to expire
                            var expiresInSeconds = authResult.expiresIn;
                            var expiresInMillisecs = expiresInSeconds * 1000;
                            var timeToRefreshLogin = expiresInMillisecs - TEN_MINUTES_MILLISECS;
                            scheduleTokenRenewal(timeToRefreshLogin);

                            $timeout(function () {
                                $state.go('welcome');
                                $rootScope.$broadcast('authStateChange', 'authentication complete');
                            });
                        });
                    }
                });

                lock.on('authorization_error', function (err) {
                    if (err && err.errorDescription) {
                        if (err.errorDescription === 'Please verify your email to activate your class account') {
                            alert('Please verify your email to activate your class account\n\n' +
                                'When you created your account, you should have been sent an email to verify your address. \n' +
                                'Clicking on the link in that email will activate your class account.\n\n' +
                                'Please click on the Help tab for more info');
                        }
                    }
                    $rootScope.$broadcast('authStateChange', 'authorization error');
                });

                // auth0 looks completely broken so try starting again
                lock.on('unrecoverable_error', function (err) {
                    console.log('lock unrecoverable error');
                    console.log(err);
                    logout();
                    return window.location.reload(true);
                });
            }

            // after a session has expired, tell the user what happened
            $rootScope.$on('tokenHasExpired', sessionExpired);
        }


        function sessionExpired() {
            clearAuthData();

            var alert = $mdDialog.alert()
                                .title('Session expired')
                                .textContent('Please log in again.')
                                .ok('OK');
            $mdDialog.show(alert).finally(function () {
                $state.go('login');
            });
        }


        function handleUnauthenticated() {
            if (hasSessionExpired()) {
                sessionExpired();
            }
            else {
                clearAuthData();
                $state.go('login');
            }
        }

        function getProfileDeferred() {
            return deferredProfile.promise;
        }

        function isAuthenticated() {
            if (userProfile) {
                // Check whether the current time is past the
                // access token's expiry time
                var expired = hasSessionExpired();
                if (expired) {
                    logout();
                }
                return !expired;
            }
            return false;
        }

        function hasSessionExpired() {
            if (userProfile) {
                // Check whether the current time is past the
                // access token's expiry time
                var expiresAt = JSON.parse(window.localStorageObj.getItem('expires_at'));
                var expired = (new Date().getTime() > expiresAt);
                return expired;
            }
            return false;
        }




        function confirmLocalStorage() {
            // some browsers allow localStorage to be disabled
            try {
                window.localStorageObj = window.localStorage || {};
            }
            catch (err) {
                window.localStorageObj = {};
            }

            // Safari, in Private Browsing Mode, looks like it supports localStorage but all calls to setItem
            // throw QuotaExceededError. If it looks like localStorage isn't working, we use a local object
            if (typeof window.localStorageObj === 'object') {
                try {
                    window.localStorageObj.setItem('confirmLocalStorage', 1);
                    window.localStorageObj.removeItem('confirmLocalStorage');
                }
                catch (e) {
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







        function switchToSessionUser(userinfo) {
            // clear out any existing user/auth info
            logout();

            window.localStorageObj.setItem('access_token', userinfo.token);
            window.localStorageObj.setItem('id_token', userinfo.jwt);

            var expiryTime = JSON.stringify(new Date(userinfo.sessionExpiry).getTime());
            window.localStorageObj.setItem('expires_at', expiryTime);

            window.localStorageObj.setItem('scopes', 'openid email');

            userProfile = {
                tenant : SESSION_USERS_CLASS,
                role : 'student',
                user_id : userinfo.id
            };

            window.localStorageObj.setItem('profile', JSON.stringify(userProfile));
            deferredProfile.resolve(userProfile);

            $rootScope.isAuthenticated = true;
            $rootScope.isTeacher = false;

            $rootScope.$broadcast('authStateChange', 'switched to session user');
        }



        function createSessionUser() {
            return $http.post('/api/sessionusers')
                .then(function (resp) {
                    var sessionuser = resp.data;

                    switchToSessionUser(sessionuser);

                    return sessionuser;
                });
        }

        function deleteSessionUser(userid) {
            return $http.delete('/api/classes/' + SESSION_USERS_CLASS + '/sessionusers/' + userid)
                .catch(function (err) {
                    console.log(err);
                });
        }


        function parseUrlParams(input) {
            var params = {};
            input.split('&').forEach(function (str) {
                var pair = str.split('=');
                params[pair[0]] = pair[1];
            });
            return params;
        }


        function checkForAuthMessagesInUrl() {
            var paramStr = $window.location.search;
            if (paramStr &&
                paramStr[0] === '?')
            {
                var params = parseUrlParams(paramStr.substr(1));

                if (params.message === 'Your%20email%20was%20verified.%20You%20can%20continue%20using%20the%20application.')
                {
                    var alert = $mdDialog.alert()
                                    .title('Welcome to Machine Learning for Kids')
                                    .textContent('Your email address has been verified.')
                                    .ok('OK');
                    $mdDialog.show(alert).finally(function () {
                        window.location = '/';
                    });
                }
            }
        }



        return {
            login : login,
            reset : reset,
            logout : logout,

            setupAuth : setupAuth,
            getProfileDeferred : getProfileDeferred,
            isAuthenticated : isAuthenticated,

            handleUnauthenticated : handleUnauthenticated,

            createSessionUser : createSessionUser,

            checkForAuthMessagesInUrl : checkForAuthMessagesInUrl
        };
    }
})();
