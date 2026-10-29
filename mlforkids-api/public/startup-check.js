/**
 * startup-check.js
 *
 * Must be loaded AFTER all of the third-party scripts in index.html, and
 * BEFORE app.js and mlapp.min.js.
 *
 * Purpose:
 *   Some school networks block or truncate some of the third-party scripts
 *   (most often lock.min.js). 
 * 
 *   When that happens, Angular fails to bootstrap with an $injector:modulerr 
 *   error, and the user is left looking at a broken page with no explanation.
 *
 *   This checks that everything the 'app' module needs has loaded. If anything
 *   is missing, it stops Angular from bootstrapping, and shows a message
 *   explaining what has happened instead.
 *
 *   It deliberately doesn't depend on anything else (no Angular, no jQuery, no
 *   translations, no style.min.css) as any of those could be what is missing.
 */

(function () {
    'use strict';

    // globals that the app needs, with the name to display if they are missing
    var REQUIRED_GLOBALS = [
        { global: 'jQuery',    name: 'jquery' },
        { global: 'angular',   name: 'angular' },
        { global: 'Auth0Lock', name: 'auth0-lock' },
        { global: 'auth0',     name: 'auth0.js' }
    ];

    // Angular modules that the 'app' module depends on
    //  (including ngAnimate and ngAria, which ngMaterial depends on)
    var REQUIRED_MODULES = [
        { module: 'ngAnimate',              name: 'angular-animate' },
        { module: 'ngAria',                 name: 'angular-aria' },
        { module: 'ngMaterial',             name: 'angular-material' },
        { module: 'ngMessages',             name: 'angular-messages' },
        { module: 'ngSanitize',             name: 'angular-sanitize' },
        { module: 'auth0.lock',             name: 'angular-lock' },
        { module: 'angular-jwt',            name: 'angular-jwt' },
        { module: 'ui.router',              name: 'angular-ui-router' },
        { module: 'duScroll',               name: 'angular-scroll' },
        { module: 'webcam',                 name: 'webcam-directive' },
        { module: 'pascalprecht.translate', name: 'angular-translate' },
        { module: 'yaru22.angular-timeago', name: 'angular-timeago' }
    ];

    // services added to a module that a different script creates, so the
    //  module check can't tell if the script that adds them is missing
    var REQUIRED_SERVICES = [
        { module: 'pascalprecht.translate', service: '$translateStaticFilesLoader', name: 'angular-translate-loader-static-files' }
    ];


    function isServiceRegistered(moduleName, serviceName) {
        try {
            // _invokeQueue is private, but won't change as 1.8.3 is the
            //  final AngularJS release
            return window.angular.module(moduleName)._invokeQueue.some(function (item) {
                return item[2] && item[2][0] === serviceName;
            });
        }
        catch (err) {
            return false;
        }
    }

    function findMissing() {
        var missing = [];

        REQUIRED_GLOBALS.forEach(function (req) {
            if (!window[req.global]) {
                missing.push(req.name);
            }
        });

        if (window.angular) {
            REQUIRED_MODULES.forEach(function (req) {
                try {
                    // throws if the module hasn't been registered
                    window.angular.module(req.module);
                }
                catch (err) {
                    missing.push(req.name);
                }
            });

            REQUIRED_SERVICES.forEach(function (req) {
                if (!isServiceRegistered(req.module, req.service)) {
                    missing.push(req.name);
                }
            });
        }

        return missing;
    }


    function createElement(tag, className, text) {
        var el = document.createElement(tag);
        if (className) {
            el.className = className;
        }
        if (text) {
            el.textContent = text;
        }
        return el;
    }


    function showStartupFailure(missing) {
        var heading = createElement('h1', null, 'Machine Learning for Kids couldn\'t start');
        var explanation = createElement('p', null, 'Some parts of the website didn\'t download properly.');

        var retryButton = createElement('button', 'btn btn-primary', 'Try again');
        retryButton.type = 'button';
        retryButton.addEventListener('click', function () {
            window.location.reload();
        });
        var retry = createElement('p');
        retry.appendChild(retryButton);

        var help = createElement('p', null, 'If this keeps happening, your school\'s network might be blocking part of the website. ' +
                                            'Ask your teacher to check with IT that ');
        help.appendChild(createElement('strong', null, 'machinelearningforkids.co.uk/static/'));
        help.appendChild(document.createTextNode(' is allowed.'));

        var details = createElement('p', 'small text-muted', 'Missing: ' + missing.join(', '));

        var message = createElement('div');
        message.setAttribute('role', 'alert');
        message.appendChild(heading);
        message.appendChild(explanation);
        message.appendChild(retry);
        message.appendChild(help);
        message.appendChild(details);

        var container = createElement('div', 'container');
        container.appendChild(message);

        document.body.insertBefore(container, document.body.firstChild);
    }


    var missing = findMissing();
    if (missing.length > 0) {
        // prod-sentry.js checks this, so that errors from the
        //  half-loaded page aren't reported
        window.mlforkidsStartupFailed = true;

        // this script runs before DOMContentLoaded, so removing ng-app
        //  now stops Angular from trying to bootstrap the app
        var appElement = document.querySelector('[ng-app]');
        if (appElement) {
            appElement.removeAttribute('ng-app');
            appElement.hidden = true;
        }

        showStartupFailure(missing);
    }

}());
