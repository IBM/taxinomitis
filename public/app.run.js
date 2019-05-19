(function () {

    angular
        .module('app')
        .run(run);

    run.$inject = [
        '$rootScope',
        'authService', 'authManager', 'sitealertsService'
    ];

    function run($rootScope, authService, authManager, sitealertsService) {
        // Put the authService on $rootScope so its methods
        // can be accessed from the nav bar
        $rootScope.authService = authService;

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
