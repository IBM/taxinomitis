(function () {

    angular
        .module('app')
        .run(run);

    run.$inject = [
        '$rootScope',
        'authService'
    ];

    function run($rootScope, authService) {
        // Put the authService on $rootScope so its methods
        // can be accessed from the nav bar
        $rootScope.authService = authService;

        // check if we already have an access token in local storage
        var alreadyAuth = authService.isAuthenticated();
        $rootScope.isAuthenticated = alreadyAuth;

        // look for a new access token in the URL
        //  used when we get the callback from auth0 hosted login page
        authService.setupAuth();
    }
})();
