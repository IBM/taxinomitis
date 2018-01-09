angular.module('app')
    .directive('httpSrc', [
        '$http', function ($http) {
            var directive = {
                link: link,
                restrict: 'A'
            };
            return directive;

            function link(scope, element, attrs) {
                var requestConfig = {
                    method: 'Get',
                    url: attrs.httpSrc,
                    responseType: 'arraybuffer',
                    cache: 'true'
                };

                $http(requestConfig)
                    .then(function(response) {
                        var contentType = response.headers('content-type');

                        var arr = new Uint8Array(response.data);

                        var raw = '';
                        var i, j, subArray, chunk = 5000;
                        for (i = 0, j = arr.length; i < j; i += chunk) {
                            subArray = arr.subarray(i, i + chunk);
                            raw += String.fromCharCode.apply(null, subArray);
                        }

                        var b64 = btoa(raw);

                        attrs.$set('src', 'data:' + contentType + ';base64,' + b64);
                    });
            }
        }
    ]);
