(function () {

    angular
        .module('app')
        .service('loggerService', loggerService);

    loggerService.$inject = [
        'downloadService',
        '$log', '$location', '$rootScope', '$window'
    ];


    function loggerService(downloadService, $log, $location, $rootScope, $window) {

        var logs = [];

        function capture() {
            for (var i = 0; i < arguments.length; i++) {
                var nextarg = arguments[i];
                if (nextarg instanceof Error) {
                    nextarg = JSON.stringify({
                        name: nextarg.name,
                        message: nextarg.message,
                        stack: nextarg.stack
                    });
                }
                else if (nextarg && nextarg.reason && nextarg.reason.name && nextarg.reason.message) {
                    nextarg = JSON.stringify({
                        name: nextarg.reason.name,
                        message: nextarg.reason.message,
                        stack: nextarg.reason.stack
                    });
                }
                else if (typeof nextarg !== 'string') {
                    nextarg = JSON.stringify(nextarg);
                }
                logs.push(Date.now() + ' ' + nextarg + '\n');
            }
        }

        function downloadLog() {
            logs.push('[ml4klog] site host ');
            logs.push($window.location.href);
            logs.push('\n[ml4klog] url parameters ');
            logs.push(JSON.stringify(urlParms));

            downloadService.downloadFile(logs, 'text/plain', 'mlforkids.log');
        }

        $log.debug('[ml4klog] Initialising logger service');

        window.addEventListener('error', capture);
        window.addEventListener('unhandledrejection', capture);

        var urlParms = $location.search();
        $log.debug('[ml4klog] site host', $window.location.href);
        $log.debug('[ml4klog] url parameters', urlParms);

        if (urlParms && urlParms.debug) {
            logs = [];
            $rootScope.debugLogging = true;
            return {
                error : capture,
                warn : capture,
                debug : capture,

                download : downloadLog
            };
        }
        else {
            logs = [];
            $rootScope.debugLogging = false;
            return {
                error : $log.error,
                warn : $log.warn,
                debug : $log.debug
            };
        }
    }
})();
