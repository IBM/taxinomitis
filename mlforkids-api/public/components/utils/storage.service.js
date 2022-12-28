(function () {

    angular
        .module('app')
        .service('storageService', storageService);

    storageService.$inject = [
        'loggerService',
        '$window',
        '$q'
    ];

    function storageService(loggerService, $window, $q) {

        var clearFn;
        var setItemFn;
        var getItemFn;
        var removeItemFn;

        function clear() {
            if (!clearFn) {
                confirmLocalStorage();
            }
            clearFn();
        }
        function setItem(key, val) {
            if (!setItemFn) {
                confirmLocalStorage();
            }
            setItemFn(key, val);
        }
        function getItem(key) {
            if (!getItemFn) {
                confirmLocalStorage();
            }
            return getItemFn(key);
        }
        function removeItem(key) {
            if (!removeItemFn) {
                confirmLocalStorage();
            }
            removeItemFn(key);
        }


        function setupTemporaryLocalStorage() {
            $window._tempLocalStorage = {};
            clearFn = function () {
                $window._tempLocalStorage = {};
            };
            setItemFn = function (key, val) {
                $window._tempLocalStorage[key] = val;
            };
            getItemFn = function (key) {
                return $window._tempLocalStorage[key];
            };
            removeItemFn = function (key) {
                delete $window._tempLocalStorage[key];
            };
        }
        function setupLocalStorage() {
            clearFn = $window.localStorage.clear.bind(localStorage);
            setItemFn = $window.localStorage.setItem.bind(localStorage);
            getItemFn = $window.localStorage.getItem.bind(localStorage);
            removeItemFn = $window.localStorage.removeItem.bind(localStorage);
        }


        function confirmLocalStorage() {
            loggerService.debug('[ml4kutils] Confirming local storage is available');

            // some browsers allow localStorage to be disabled
            //
            // Safari, in Private Browsing Mode, looks like it supports localStorage but all calls to setItem
            // throw QuotaExceededError. If it looks like localStorage isn't working, we use a local object

            var localStorageAvailable = false;

            try {
                if ($window.localStorage)
                {
                    loggerService.debug('[ml4kutils] Testing local storage');
                    $window.localStorage.setItem('confirmLocalStorage', 1);
                    $window.localStorage.removeItem('confirmLocalStorage');

                    loggerService.debug('[ml4kutils] Confirmed local storage available');
                    localStorageAvailable = true;
                }
            }
            catch (e) {
                loggerService.error('[ml4kutils] Failed local storage verification');
                loggerService.error(e);
            }

            if (localStorageAvailable) {
                setupLocalStorage();
            }
            else {
                setupTemporaryLocalStorage();
            }
        }





        return {
            confirmLocalStorage,

            clear,
            setItem,
            getItem,
            removeItem
        };
    }
})();