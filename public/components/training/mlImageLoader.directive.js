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


        var GOOG_IMG_REGEX = /^https:\/\/www\.google\.co[a-z.]+\/imgres\?(imgurl=.*)/;


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


        function handleDrop(evt, label, scope) {
            if (!evt.dataTransfer) {
                return false;
            }

            if (evt.preventDefault) {
                evt.preventDefault();
            }

            if (evt.dataTransfer.files && evt.dataTransfer.files.length > 0) {
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

                if (src && typeof src === 'string' && src.substr(0, 10) === 'data:image') {
                    return reportInvalidImageType(scope);
                }
                var googleImagesCheck = src.match(GOOG_IMG_REGEX);
                if (googleImagesCheck) {
                    var googleImagesUrl = googleImagesCheck[1];
                    var googleImgsUrlParms = parseUrl(googleImagesUrl);
                    data = googleImgsUrlParms.imgurl;
                }
                else {
                    var type = getType(evt.dataTransfer.types, 'text/html');
                    var linksrc = evt.dataTransfer.getData(type);
                    var parsed = parseHTML(linksrc);
                    var img = parsed.querySelector('img');
                    if (img) {
                        data = img.src;
                    }
                }
            }
            else {
                data = evt.dataTransfer.getData('Text');
            }


            if (data) {
                scope.getController().addConfirmedTrainingData(data, label);
                scope.$apply();
            }
            else {
                scope.getController().displayAlert('warnings', 400, {
                    message : isSafari() ?
                        'Dragging pictures does not work in Safari. Use a different browser, or use the "www" button instead.' :
                        'Drag a picture from another web page into one of the training buckets'
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

        function isSafari() {
            return navigator.userAgent.indexOf('Safari') >= 0;
        }

        return {
            link : link
        };
    }
}());
