(function () {

    angular
        .module('app')
        .directive('mlImageLoader', mlImageLoader);


    function mlImageLoader() {

        function cancel(evt) {
            if (evt && evt.preventDefault) {
                evt.preventDefault();
            }
            if (evt && evt.dataTransfer) {
                evt.dataTransfer.dropEffect = 'copy';
            }
            return false;
        }


        function parseUrl(url) {
            var result = {};
            url.split('&').forEach(function(part) {
                if (!part) {
                    return;
                }

                part = part.split('+').join(' ');

                var eq = part.indexOf('=');
                var key = eq > -1 ? part.substr(0, eq) : part;
                var val = eq > -1 ? decodeURIComponent(part.substr(eq + 1)) : '';

                var from = key.indexOf('[');
                if (from === -1) {
                    result[decodeURIComponent(key)] = val;
                }
                else {
                    var to = key.indexOf(']', from);
                    var index = decodeURIComponent(key.substring(from + 1, to));
                    key = decodeURIComponent(key.substring(0, from));

                    if (!result[key]) {
                        result[key] = [];
                    }

                    if (!index) {
                        result[key].push(val);
                    }
                    else {
                        result[key][index] = val;
                    }
                }
            });
            return result;
        }

        function parseHTML(str) {
            var tmp = document.implementation.createHTMLDocument('title');
            tmp.body.innerHTML = str;
            return tmp;
        }


        // is it an image search result from Google?
        var GOOG_IMG_REGEX = /^https:\/\/www\.google\.co[a-z.]+\/imgres\?(imgurl=.*)/;

        // is it an image search result from Baidu?
        var BAIDU_IMG_REGEX = /^https:\/\/timgsa.baidu.com\/timg\?.*/;
        var BAIDU_IMG_SRCH_REGEX = /^https:\/\/image.baidu.com\/search\/detail.*/;

        // is it a URL ending with .png or .jpg ?
        var IMG_URL_REGEX = /^https?:\/\/[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)(\.jpg|\.png)\??.*$/;

        function getType(types, type) {
            if (types && types.indexOf && types.indexOf(type) !== -1) {
                return type;
            }
            else {
                return 'Text';
            }
        }


        function reportInvalidImageType(scope) {
            scope.getController().displayAlert('warnings', 400, {
                message : 'Sorry, that type of image is not supported. You can only use jpg or png pictures'
            });
            scope.$apply();
            return false;
        }

        function urlIsImageData(url) {
            return url && typeof url === 'string' &&
                   (url.substr(0, 10) === 'data:image' ||
                    url.substr(0, 5) === 'blob:' ||
                    url.substr(0, 11) === 'x-raw-image' ||
                    url.substr(0, 5) === 'file:');
        }


        function handleDrop(evt, label, scope) {
            if (!evt || !evt.dataTransfer) {
                return false;
            }

            if (evt.preventDefault) {
                evt.preventDefault();
            }

            if (evt.dataTransfer &&
                evt.dataTransfer.types && evt.dataTransfer.types.length === 1 && evt.dataTransfer.types[0] === 'Files')
            {
                scope.getController().displayAlert('warnings', 400, {
                    message : 'You can\'t upload pictures from your computer. Use pictures that are already online, by dragging them from another web page'
                });
                scope.$apply();
                return false;
            }

            var data;
            if (evt.dataTransfer.types && evt.dataTransfer.types.length > 0) {
                var type = getType(evt.dataTransfer.types, 'text/uri-list');
                var src = evt.dataTransfer.getData(type);

                if (urlIsImageData(src)) {
                    return reportInvalidImageType(scope);
                }
                var googleImagesCheck = src.match(GOOG_IMG_REGEX);
                if (googleImagesCheck) {
                    var googleImagesUrl = googleImagesCheck[1];
                    var googleImgsUrlParms = parseUrl(googleImagesUrl);
                    data = googleImgsUrlParms.imgurl;
                }
                if (!data) {
                    var baiduImagesCheck = src.match(BAIDU_IMG_REGEX);
                    if (baiduImagesCheck) {
                        var baiduUrl = new URL(src);
                        if (baiduUrl &&
                            baiduUrl.searchParams &&
                            baiduUrl.searchParams.has &&
                            baiduUrl.searchParams.has('src'))
                        {
                            data = baiduUrl.searchParams.get('src');
                        }
                    }
                }
                if (!data) {
                    var baiduImageSearchCheck = src.match(BAIDU_IMG_SRCH_REGEX);
                    if (baiduImageSearchCheck) {
                        var baiduSearchUrl = new URL(src);
                        if (baiduSearchUrl &&
                            baiduSearchUrl.searchParams &&
                            baiduSearchUrl.searchParams.has &&
                            baiduSearchUrl.searchParams.has('objurl'))
                        {
                            data = baiduSearchUrl.searchParams.get('objurl');
                        }
                    }
                }
                if (!data) {
                    var htmltype = getType(evt.dataTransfer.types, 'text/html');
                    var linksrc = evt.dataTransfer.getData(htmltype);
                    var parsed = parseHTML(linksrc);
                    var img = parsed.querySelector('img');
                    if (img) {
                        data = img.src;
                    }
                }
                if (!data) {
                    var imageUrlCheck = src.match(IMG_URL_REGEX);
                    if (imageUrlCheck) {
                        data = src;
                    }
                }
            }
            if (!data) {
                data = evt.dataTransfer.getData('Text');
            }


            if (data) {
                if (urlIsImageData(data)) {
                    return reportInvalidImageType(scope);
                }

                scope.getController().addConfirmedTrainingData(data, label);
                scope.$apply();
            }
            else {
                scope.getController().displayAlert('warnings', 400, {
                    message : 'Drag a picture from another web page into one of the training buckets'
                });
                scope.$apply();
            }

            return false;
        }


        function link (scope, jqlElements, attrs) {
            var jqlElement = jqlElements[0];
            var label = scope.$parent.label;

            jqlElement.addEventListener('dragover', cancel);

            var counter = 0;

            jqlElement.addEventListener('dragleave', function (evt) {
                counter -= 1;
                if (counter === 0) {
                    angular.element(evt.target).removeClass('hover');
                }
                return cancel(evt);
            });
            jqlElement.addEventListener('dragenter', function (evt) {
                counter += 1;
                angular.element(evt.target).addClass('hover');
                return cancel(evt);
            });
            jqlElement.addEventListener('drop', function (evt) {
                if (evt && evt.dataTransfer) {
                    counter = 0;
                    angular.element(evt.target).removeClass('hover');
                    jqlElements.removeClass('hover');

                    angular.element(document.querySelector('.trainingbucketitems.hover')).removeClass('hover');

                    return handleDrop(evt, label, scope);
                }
            });
        }

        return {
            link : link
        };
    }
}());
