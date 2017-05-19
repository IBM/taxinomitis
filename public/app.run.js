(function () {

    angular
        .module('app')
        .run(run);

    run.$inject = [
        '$rootScope',
        'authService',
        'authManager',
        'lock'
    ];

    function run($rootScope, authService, authManager, lock) {
        // Put the authService on $rootScope so its methods
        // can be accessed from the nav bar
        $rootScope.authService = authService;

        // Register the authentication listener that is
        // set up in auth.service.js
        authService.registerAuthenticationListener();

        // Use the authManager from angular-jwt to check for
        // the user's authentication state when the page is
        // refreshed and maintain authentication
        authManager.checkAuthOnRefresh();

        // Use redirectWhenUnauthenticated to redirect to unauthenticatedRedirectPath, if server returns 401.
        // set up in app.js
        authManager.redirectWhenUnauthenticated();

        // Register synchronous hash parser
        lock.interceptHash();
    }
})();
