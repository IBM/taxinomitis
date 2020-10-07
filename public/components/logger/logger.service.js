(function () {

    angular
        .module('app')
        .service('loggerService', loggerService);

    loggerService.$inject = ['$log', '$location', '$rootScope', '$window'];


    function loggerService($log, $location, $rootScope, $window) {

        var logs = [];

        function capture() {
            for (var i = 0; i < arguments.length; i++) {
                var nextarg = arguments[i];
                if (typeof nextarg !== 'string') {
                    nextarg = JSON.stringify(nextarg);
                }
                logs.push(Date.now() + ' ' + nextarg + '\n');
            }
        }

        function downloadLog() {
            var blob = new Blob(logs, { type: 'text/plain' });
            if ($window.navigator.msSaveOrOpenBlob) {
                $window.navigator.msSaveBlob(blob, 'mlforkids.log');
            }
            else {
                var elem = document.createElement('a');
                elem.href = $window.URL.createObjectURL(blob);
                elem.download = 'mlforkids.log';
                document.body.appendChild(elem);
                elem.click();
                document.body.removeChild(elem);
            }
        }

        $log.debug('[ml4klog] Initialising logger service');

        var urlParms = $location.search();
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
