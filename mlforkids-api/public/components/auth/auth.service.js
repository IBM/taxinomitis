(function () {

    angular
        .module('app')
        .service('authService', authService);

    var angDependencies = [
        'authManager', 'loggerService', 'storageService',
        '$q', '$http',
        '$mdDialog',
        '$rootScope',
        '$window',
        '$state',
        '$timeout'
    ];
    if (AUTH0_CLIENT_ID) {
        angDependencies.push('lock');
    }

    authService.$inject = angDependencies;

    function authService(authManager, loggerService, storageService, $q, $http, $mdDialog, $rootScope, $window, $state, $timeout, lock) {

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

        loggerService.debug('[ml4kauth] init');
        storageService.confirmLocalStorage();

        var userProfileStr = storageService.getItem('profile');
        var userProfile = null;
        if (userProfileStr) {
            userProfile = JSON.parse(userProfileStr);
        }
        var deferredProfile = $q.defer();

        if (userProfile) {
            loggerService.debug('[ml4kauth] Existing user profile restored');

            if (hasSessionExpired()) {
                loggerService.debug('[ml4kauth] Session expired');

                // We found an access token in local storage, but it
                // has expired, so we'll wipe it and force them to
                // log in again.
                logout();
            }
            else {
                loggerService.debug('[ml4kauth] Setting restored profile to use');

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
                    var expiresAt = JSON.parse(storageService.getItem('expires_at'));
                    var refreshTime = expiresAt - TEN_MINUTES_MILLISECS;
                    var timeToRefresh = refreshTime - (new Date().getTime());
                    if (timeToRefresh > 0) {
                        loggerService.debug('[ml4kauth] Token valid for longer than 10 minutes');
                        scheduleTokenRenewal(timeToRefresh);
                    }
                    else {
                        loggerService.debug('[ml4kauth] Token due to renew within 10 minutes');

                        // the session is going to expire within 10 minutes, so
                        // we'll refresh it immediately
                        renewLogin();
                    }
                }
            }
        }


        function scheduleTokenRenewal(timeToRefreshMs) {
            loggerService.debug('[ml4kauth] Scheduling token renewal');
            nextRefreshTimer = setTimeout(renewLogin, timeToRefreshMs);
        }


        function renewLogin() {
            loggerService.debug('[ml4kauth] Renewing login');

            if (lock) {
                lock.checkSession({}, function (err, authres) {
                    if (err) {
                        loggerService.error('[ml4kauth] Failed to renew login', err);
                    }
                    else if (authres) {
                        loggerService.debug('[ml4kauth] Renewed login', authres);

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
                loggerService.error('[ml4kauth] Unexpected call to renewLogin');
            }
        }


        function login() {
            loggerService.debug('[ml4kauth] login');
            if (lock) {
                lock.show({
                    languageDictionary : {
                        title: 'Log in to ML for Kids'
                    }
                });
            }
            else {
                loggerService.error('[ml4kauth] Unexpected call to login');
            }
        }

        function reset() {
            loggerService.debug('[ml4kauth] reset');
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
                loggerService.error('Unexpected call to reset');
            }
        }


        function clearAuthData() {
            loggerService.debug('[ml4kauth] Clearing auth data');

            if (nextRefreshTimer) {
                loggerService.debug('[ml4kauth] Clearing token renewal timer');
                clearTimeout(nextRefreshTimer);
                nextRefreshTimer = null;
            }

            deferredProfile = $q.defer();

            loggerService.debug('[ml4kauth] Clearing stored token');
            storageService.removeItem('access_token');
            storageService.removeItem('id_token');
            storageService.removeItem('expires_at');
            storageService.removeItem('scopes');
            storageService.removeItem('profile');

            authManager.unauthenticate();

            userProfile = null;
            $rootScope.isTeacher = false;
            $rootScope.isAuthenticated = false;

            $rootScope.$broadcast('authStateChange', 'cleared auth data');
        }

        function logout() {
            loggerService.debug('[ml4kauth] logout');

            if (userProfile && userProfile.tenant === SESSION_USERS_CLASS && authManager.isAuthenticated()) {
                loggerService.debug('[ml4kauth] Logging out session user');
                deleteSessionUser(userProfile.user_id)
                    .then(function () {
                        loggerService.debug('[ml4kauth] Deleted session user');
                        clearAuthData();
                        storageService.clear();
                    })
                    .catch(function (err) {
                        loggerService.error('[ml4kauth] Failed to delete session user', err);
                    });
            }
            else {
                clearAuthData();
            }
        }


        function storeToken(authResult) {
            loggerService.debug('[ml4kauth] Storing token');

            var expiresAt = JSON.stringify((authResult.expiresIn * 1000) + new Date().getTime());

            var scopes = authResult.scope || REQUESTED_SCOPES || '';

            storageService.setItem('access_token', authResult.accessToken);
            storageService.setItem('id_token', authResult.idToken);
            storageService.setItem('expires_at', expiresAt);
            storageService.setItem('scopes', JSON.stringify(scopes));

            authManager.authenticate();
        }

        function storeProfile(profile) {
            loggerService.debug('[ml4kauth] Storing profile');

            storageService.setItem('profile', JSON.stringify(profile));
            deferredProfile.resolve(profile);

            $rootScope.isTeacher = (profile.role === 'supervisor');
            $rootScope.isAuthenticated = true;
        }


        function extractAppMetadata(profile) {
            loggerService.debug('[ml4kauth] Extracting app metadata from profile data');

            var tenant = profile['https://machinelearningforkids.co.uk/api/tenant'];
            var role = profile['https://machinelearningforkids.co.uk/api/role'];
            var groups = profile['https://machinelearningforkids.co.uk/api/groups'];
            var user_id = profile.sub;
            profile.tenant = tenant;
            profile.role = role;
            profile.groups = groups;
            profile.user_id = user_id;
            delete profile['https://machinelearningforkids.co.uk/api/tenant'];
            delete profile['https://machinelearningforkids.co.uk/api/role'];
            delete profile['https://machinelearningforkids.co.uk/api/groups'];
            delete profile.sub;
            delete profile.picture;
            return profile;
        }


        function setupAuth() {
            loggerService.debug('[ml4kauth] Setting up auth');

            if (lock) {
                loggerService.debug('[ml4kauth] Registering url interceptor');
                lock.interceptHash();

                lock.on('authenticated', function (authResult) {
                    loggerService.debug('[ml4kauth] Authenticated');

                    if (authResult && authResult.accessToken && authResult.idToken) {
                        loggerService.debug('[ml4kauth] Received expected auth tokens');

                        storeToken(authResult);

                        loggerService.debug('[ml4kauth] Retrieving user info');
                        lock.getUserInfo(authResult.accessToken, function (err, profile) {
                            if (err) {
                                loggerService.error('[ml4kauth] lock auth failure', err);
                                return logout();
                            }

                            loggerService.debug('[ml4kauth] Processing retrieved profile');
                            vm.profile = extractAppMetadata(profile);
                            storeProfile(vm.profile);

                            // schedule a refresh of the token a little before
                            //  it is due to expire
                            var expiresInSeconds = authResult.expiresIn;
                            var expiresInMillisecs = expiresInSeconds * 1000;
                            var timeToRefreshLogin = expiresInMillisecs - TEN_MINUTES_MILLISECS;
                            scheduleTokenRenewal(timeToRefreshLogin);

                            loggerService.debug('[ml4kauth] Redirecting to home page');
                            $timeout(function () {
                                $state.go('welcome');
                                $rootScope.$broadcast('authStateChange', 'authentication complete');
                            });
                        });
                    }
                    else {
                        loggerService.error('[ml4kauth] Authenticated without expected tokens');
                        loggerService.error(authResult);
                    }
                });

                lock.on('authorization_error', function (err) {
                    loggerService.warn('[ml4kauth] Authorization error', err);

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
                    loggerService.error('[ml4kauth] Unrecoverable auth error', err);

                    logout();
                    return $window.location.reload(true);
                });
            }

            // after a session has expired, tell the user what happened
            $rootScope.$on('tokenHasExpired', sessionExpired);
        }


        function sessionExpired() {
            loggerService.debug('[ml4kauth] Session has expired');

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
            loggerService.debug('[ml4kauth] Unauthenticated event');

            if (hasSessionExpired()) {
                loggerService.debug('[ml4kauth] Unauthenticated because session has expired');
                sessionExpired();
            }
            else {
                loggerService.debug('[ml4kauth] Unexpected unauth event');
                clearAuthData();
                $state.go('login');
            }
        }

        function getProfileDeferred() {
            return deferredProfile.promise;
        }

        function isAuthenticated() {
            loggerService.debug('[ml4kauth] isAuthenticated');

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
            var expired = false;
            if (userProfile) {
                // Check whether the current time is past the
                // access token's expiry time
                var expiresAt = JSON.parse(storageService.getItem('expires_at'));
                expired = (new Date().getTime() > expiresAt);
            }
            loggerService.debug('[ml4kauth] hasSessionExpired : ' + expired);
            return expired;
        }


        function switchToSessionUser(userinfo) {
            loggerService.debug('[ml4kauth] Switching to session user');

            // clear out any existing user/auth info
            logout();

            loggerService.debug('[ml4kauth] Storing profile data');
            storageService.setItem('access_token', userinfo.token);
            storageService.setItem('id_token', userinfo.jwt);

            var expiryTime = JSON.stringify(new Date(userinfo.sessionExpiry).getTime());
            storageService.setItem('expires_at', expiryTime);

            storageService.setItem('scopes', 'openid email');

            userProfile = {
                tenant : SESSION_USERS_CLASS,
                role : 'student',
                user_id : userinfo.id
            };

            storageService.setItem('profile', JSON.stringify(userProfile));
            deferredProfile.resolve(userProfile);

            $rootScope.isAuthenticated = true;
            $rootScope.isTeacher = false;

            $rootScope.$broadcast('authStateChange', 'switched to session user');
        }



        function createSessionUser() {
            loggerService.debug('[ml4kauth] Creating session user');
            return $http.post('/api/sessionusers')
                .then(function (resp) {
                    loggerService.debug('[ml4kauth] Session user created');

                    var sessionuser = resp.data;

                    switchToSessionUser(sessionuser);

                    return sessionuser;
                });
        }

        function deleteSessionUser(userid) {
            loggerService.debug('[ml4kauth] Deleting session user');
            return $http.delete('/api/classes/' + SESSION_USERS_CLASS + '/sessionusers/' + userid)
                .catch(function (err) {
                    loggerService.error('[ml4kauth] Failed to delete session user', err);
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
                        $window.location = '/';
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

            checkForAuthMessagesInUrl : checkForAuthMessagesInUrl,

            storeProfile : storeProfile
        };
    }
})();
