(function () {

    angular
        .module('app')
        .service('sitealertsService', sitealertsService);

    sitealertsService.$inject = [
        '$http', '$rootScope', '$interval', 'loggerService',
        'authService'
    ];

    function sitealertsService($http, $rootScope, $interval, loggerService, authService) {

        function logError(err) {
            loggerService.error(err);
            delete $rootScope.siteAlert;
        }

        function init() {
            $rootScope.clearSiteAlert = function () {
                delete $rootScope.siteAlert;
            };

            fetchSiteAlert({}, 'init');

            $rootScope.$on('authStateChange', fetchSiteAlert);
            $interval(fetchSiteAlert, 1800000, 0, true, 'timer');
        }

        function getAlerts(endpoint, tenant, userid) {
            loggerService.debug('[ml4kalert] getting alerts', endpoint, tenant, userid);
            var url = '/api/sitealerts/public';
            if (endpoint === 'student') {
                url = '/api/sitealerts/alerts/' + tenant + '/students/' + userid;
            }
            else if (endpoint === 'supervisor') {
                url = '/api/sitealerts/alerts/' + tenant + '/supervisors/' + userid;
            }
            return $http.get(url)
                .then(function (resp) {
                    var msgs = resp.data;
                    if (msgs && msgs.length > 0 &&
                        msgs[0].message && msgs[0].severity)
                    {
                        $rootScope.siteAlert = msgs[0];

                        $rootScope.inMaintenanceMode = ($rootScope.siteAlert &&
                            $rootScope.siteAlert.message === 'Machine Learning for Kids is temporarily unavailable for scheduled maintenance');
                    }
                    else {
                        delete $rootScope.siteAlert;
                    }
                })
                .catch(logError);
        }

        function fetchSiteAlert(evtObj, evt) {
            if ($rootScope.isAuthenticated) {
                return authService.getProfileDeferred()
                    .then(function (profile) {
                        if (profile && profile.role) {
                            return getAlerts(profile.role, profile.tenant, profile.user_id);
                        }
                        else {
                            return logError('Invalid profile');
                        }
                    })
                    .catch(logError);
            }
            else {
                return getAlerts('public');
            }
        }

        function createAlert (details) {
            return $http.post('/api/sitealerts', details);
        }

        function refreshServer () {
            return $http.put('/api/sitealerts/actions/refresh');
        }

        return {
            init : init,
            createAlert : createAlert,
            refreshServer : refreshServer
        };
    }
})();
