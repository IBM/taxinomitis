(function () {

    angular
        .module('app')
        .service('utilService', utilService);

    utilService.$inject = [
        '$q', 'loggerService'
    ];

    function utilService($q, loggerService) {

        function loadScript(url) {
            return $q(function (resolve, reject) {
                var id = 'mlforkids-script-' + url;
                if (document.getElementById(id)) {
                    resolve();
                }
                else {
                    loggerService.debug('[ml4kutils] loading script', url);

                    var scriptObj = document.createElement('script');
                    scriptObj.id = id;
                    scriptObj.type = 'text/javascript';
                    scriptObj.src = url;

                    scriptObj.onreadystatechange = resolve;
                    scriptObj.onload = resolve;
                    scriptObj.onerror = reject;

                    document.head.appendChild(scriptObj);
                }
            });
        }

        function loadImageProjectSupport() {
            return loadScript('/static/bower_components/blueimp-canvas-to-blob/js/canvas-to-blob.min.js');
        }
        function loadNumberProjectSupport() {
            return loadScript('/static/bower_components/tfjs-tfdf/tf-tfdf.min.js');
        }

        function isInternetExplorer() {
            var userAgent = navigator.userAgent;
            return userAgent &&
                   (userAgent.indexOf('MSIE') >= 0 || userAgent.indexOf('Trident') >= 0);
        }

        function loadTensorFlow() {
            return loadScript('/static/bower_components/tfjs/tf.min.js?v=156');
        }



        var GOOGLE_IMAGE_URL_REGEX = /^https:\/\/lh[1-9]\.google(?:usercontent)?\.com\/.*/;

        function isGoogleFilesUrl(url) {
            return GOOGLE_IMAGE_URL_REGEX.test(url);
        }

        return {
            loadScript : loadScript,
            loadTensorFlow : loadTensorFlow,
            loadImageProjectSupport : loadImageProjectSupport,
            loadNumberProjectSupport : loadNumberProjectSupport,
            isInternetExplorer : isInternetExplorer,
            isGoogleFilesUrl : isGoogleFilesUrl
        };
    }

})();
