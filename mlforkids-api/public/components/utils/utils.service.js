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
            return loadScript('/static/bower_components/ydf-inference/jszip.min.js?v=1')
                .then(() => {
                    return loadScript('/static/bower_components/ydf-inference/inference.js?v=1');
                })
                .then(() => {
                    return YDFInference();
                });
        }

        function loadWebLlmProjectSupport() {
            loggerService.debug('[ml4kutils] loading web-llm script');
            return import("https://esm.run/@mlc-ai/web-llm")
                .then((module) => {
                    loggerService.debug('[ml4kutils] loaded web-llm script');
                    return module;
                });
        }

        function isInternetExplorer() {
            var userAgent = navigator.userAgent;
            return userAgent &&
                   (userAgent.indexOf('MSIE') >= 0 || userAgent.indexOf('Trident') >= 0);
        }

        function loadTensorFlow() {
            return loadScript('/static/bower_components/tfjs/tf.min.js?v=2');
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
            loadWebLlmProjectSupport : loadWebLlmProjectSupport,
            isInternetExplorer : isInternetExplorer,
            isGoogleFilesUrl : isGoogleFilesUrl
        };
    }

})();
