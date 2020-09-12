(function () {

    angular
        .module('app')
        .run(run);

    run.$inject = [
        '$rootScope',
        'authService', 'authManager', 'sitealertsService', 'loggerService'
    ];

    function run($rootScope, authService, authManager, sitealertsService, loggerService) {
        // Put the authService on $rootScope so its methods
        // can be accessed from the nav bar
        $rootScope.authService = authService;

        // Put the loggerService on $rootScope so the nav
        // bar can download the log
        $rootScope.loggerService = loggerService;

        // register auth listener
        authService.setupAuth();

        // check auth when they load or refresh the page
        authManager.checkAuthOnRefresh();

        // send them back to the login screen if they get an HTTP 401
        //  from an API call
        authManager.redirectWhenUnauthenticated();

        // display confirmation if the user is verifying their
        //  email address with Auth0
        authService.checkForAuthMessagesInUrl();

        // prepare the service for fetching site alerts
        sitealertsService.init();
    }
})();
