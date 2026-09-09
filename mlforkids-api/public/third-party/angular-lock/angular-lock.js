/**
 * angular-lock.js
 *
 * AngularJS binding for Auth0's Lock widget.
 *
 * Depends on two globals: `Auth0Lock` (from lock.min.js) and `auth0` (from
 * auth0.min.js). Neither is read while this file is being parsed - `Auth0Lock` is
 * read when Angular instantiates the provider during its config phase, and `auth0`
 * only when `interceptHash()` is called - so both simply need to be loaded before
 * Angular bootstraps, not before this script.
 *
 * Registers:
 *   - module   'auth0.lock'  - listed in the dependencies of the 'app' module (public/app.js)
 *   - provider 'lock'        - configured as `lockProvider` in app.js, and injected
 *                              as `lock` into authService (public/components/auth/auth.service.js)
 *
 * This is a locally-maintained replacement for the abandoned `angular-lock` npm
 * package. See README.md in this directory for why, and for how to maintain it.
 */

(function () {
    'use strict';

    // The Lock instance methods that this app uses. Anything not listed here is
    // not exposed on the `lock` service.
    //
    // The npm package this replaces discovered these by enumerating the Lock
    // instance with a for..in loop. That silently returns nothing from Lock v13
    // onwards, because Lock is now transpiled with Babel's _createClass, which
    // defines prototype methods as non-enumerable. Naming the methods we need
    // means a future Lock release that drops one of them fails loudly, at
    // startup, instead of handing back a service with no methods on it.
    var LOCK_METHODS = [
        'show',         // authService.login() / authService.reset()
        'checkSession', // authService.renewLogin()
        'getUserInfo',  // authService.setupAuth()
        'on'            // authService.setupAuth()
    ];


    angular.module('auth0.lock', []).provider('lock', function LockProvider () {

        if (typeof Auth0Lock !== 'function') {
            throw new Error('Auth0Lock must be loaded before angular-lock.js');
        }

        var config = null;

        // Called from the config block in public/app.js.
        this.init = function (options) {
            if (!options) {
                throw new Error('clientID and domain must be provided to lock');
            }

            config = {
                clientID : options.clientID,
                domain : options.domain,
                options : options.options || {}
            };

            // Identifies the calling library to Auth0, and is reported back in
            // the Auth0 dashboard. The package this replaced sent
            // { name: 'angular-lock', version: '3.1.0' } here.
            config.options._telemetryInfo = {
                name : 'mlforkids-angular-lock',
                version : '1.0.0'
            };
        };


        this.$get = ['$rootScope', '$location', function ($rootScope, $location) {

            var Lock = new Auth0Lock(config.clientID, config.domain, config.options);

            // Fail at startup, not at the point of use, if the Lock version we
            // have been given no longer provides something we depend on.
            LOCK_METHODS.forEach(function (name) {
                if (typeof Lock[name] !== 'function') {
                    throw new Error('Auth0Lock has no ' + name + '() method. ' +
                                    'The Lock version in public/third-party/auth0-lock ' +
                                    'is not compatible with angular-lock.js.');
                }
            });


            // Lock invokes its callbacks from outside Angular, so anything they
            // change (for example $rootScope.isAuthenticated) would not be picked
            // up until the next digest. Run them inside one.
            function safeApply(fn) {
                var phase = $rootScope.$root.$$phase;
                if (phase === '$apply' || phase === '$digest') {
                    if (fn && typeof fn === 'function') {
                        fn();
                    }
                }
                else {
                    $rootScope.$apply(fn);
                }
            }

            // Every Lock method we use takes its callback as the last argument -
            // show(options), checkSession(options, cb), getUserInfo(token, cb) and
            // on(event, handler) all fit that shape - so wrapping the last argument
            // when it is a function covers all of them.
            function wrapArguments(parameters) {
                var lastIndex = parameters.length - 1;
                var func = parameters[lastIndex];

                if (typeof func === 'function') {
                    parameters[lastIndex] = function () {
                        var args = arguments;
                        safeApply(function () {
                            func.apply(Lock, args);
                        });
                    };
                }

                return parameters;
            }


            var lock = {};

            LOCK_METHODS.forEach(function (name) {
                lock[name] = function () {
                    return Lock[name].apply(Lock, wrapArguments(arguments));
                };
            });


            // Auth0 redirects back to the app with the tokens in the URL fragment.
            // Lock does not read those itself when it is driven this way, so we
            // watch for them, hand the fragment to auth0.js to be parsed and
            // verified, and re-emit the outcome as the Lock events that
            // authService.setupAuth() is already listening for.
            lock.interceptHash = function () {
                if (typeof auth0 === 'undefined' || typeof auth0.WebAuth !== 'function') {
                    throw new Error('auth0.js version 8 or higher must be loaded before angular-lock.js');
                }

                var webAuthOptions = {
                    clientID : config.clientID,
                    domain : config.domain,
                    _telemetryInfo : config.options._telemetryInfo,
                    _sendTelemetry : config.options._sendTelemetry
                };

                $rootScope.$on('$locationChangeStart', function (event, location) {
                    if (/id_token=/.test(location) ||
                        /access_token=/.test(location) ||
                        /error=/.test(location))
                    {
                        var webAuth = new auth0.WebAuth(webAuthOptions);
                        var hash = $location.hash() || window.location.hash;

                        webAuth.parseHash({ hash : hash }, function (err, authResult) {
                            if (err) {
                                Lock.emit('authorization_error', err);
                            }
                            if (authResult && authResult.idToken) {
                                Lock.emit('authenticated', authResult);
                            }
                        });
                    }
                });
            };

            return lock;
        }];
    });

}());
