(function () {
    angular
        .module('app')
        .service('downloadService', downloadService);

    downloadService.$inject = [
        '$window'
    ];

    function downloadService($window) {

        function downloadFile(data, type, filename) {
            if (!data) {
                // nothing to download - silently return
                return;
            }

            var blob = new Blob(data, { type });
            if ($window.navigator.msSaveOrOpenBlob) {
                $window.navigator.msSaveBlob(blob, filename);
            }
            else {
                var elem = document.createElement('a');
                elem.href = $window.URL.createObjectURL(blob);
                elem.download = filename;
                document.body.appendChild(elem);
                elem.click();
                document.body.removeChild(elem);
            }
        }

        return {
            downloadFile
        };
    }
})();