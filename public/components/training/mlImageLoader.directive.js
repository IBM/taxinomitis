(function () {

    angular
        .module('app')
        .directive('mlImageLoader', mlImageLoader);


    function mlImageLoader() {

        function cancel(evt) {
            if (evt.preventDefault) {
                evt.preventDefault();
            }
            evt.dataTransfer.dropEffect = 'copy';
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
            var tmp = document.implementation.createHTMLDocument();
            tmp.body.innerHTML = str;
            return tmp;
        }


        var GOOG_IMG_REGEX = /^https:\/\/www\.google\.co[a-z.]+\/imgres\?(imgurl=.*)/;


        function handleDrop(evt, label, scope) {
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
            if (evt.dataTransfer.types) {
                var src = evt.dataTransfer.getData('text/uri-list');
                var googleImagesCheck = src.match(GOOG_IMG_REGEX);
                if (googleImagesCheck) {
                    var googleImagesUrl = googleImagesCheck[1];
                    var googleImgsUrlParms = parseUrl(googleImagesUrl);
                    data = googleImgsUrlParms.imgurl;
                }
                else {
                    var linksrc = evt.dataTransfer.getData('text/html');
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
            }
            else {
                scope.getController().displayAlert('warnings', 400, {
                    message : isSafari() ?
                        'Dragging pictures does not work in Safari. Use a different browser, or use the "Add example" button instead.' :
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
            jqlElement.addEventListener('dragenter', cancel);
            jqlElement.addEventListener('drop', function (evt) {
                handleDrop(evt, label, scope);
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
