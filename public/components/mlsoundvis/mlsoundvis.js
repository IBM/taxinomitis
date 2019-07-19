angular.module('app')
    .directive('mlsoundvis', function () {

        return {
            template: '<canvas width="150" height="100"></canvas>',

            restrict: 'E',

            scope: {
                spectogram : '<',
                modelinfo : '<',
                datatype : '<'
            },

            link: function ($scope, element, attrs, controller, transcludeFn) {

                if ($scope.datatype !== 'sounds') {
                    return;
                }

                var min = Infinity;
                var max = -Infinity;
                for (var i = 0; i < $scope.spectogram.length; i++) {
                    var num = $scope.spectogram[i];
                    if (num > -Infinity) {
                        min = Math.min(num, min);
                        max = Math.max(num, max);
                    }
                }
                if (min >= max) {
                    console.log('Invalid data range supplied');
                    return;
                }

                var canvas = element[0].firstChild;
                var context = canvas.getContext('2d');
                context.clearRect(0, 0, canvas.width, canvas.height);

                var fftSize = $scope.modelinfo.fftSize;

                var numFrames = $scope.spectogram.length / fftSize;

                var pixelsPerCol = canvas.width / numFrames;
                var pixelsPerRow = canvas.height / fftSize;

                // for each column...
                for (i = 0; i < numFrames; ++i) {
                    var x = pixelsPerCol * i;

                    // get values for the column
                    var columnValues = $scope.spectogram.slice(i * fftSize, (i + 1) * fftSize);
                    if (columnValues[0] > -Infinity) {

                        // for each row in the column
                        for (var j = 0; j < fftSize; ++j) {
                            var y = canvas.height - (j + 1) * pixelsPerRow;

                            var colour = (columnValues[j] - min) / (max - min);
                            colour = Math.pow(colour, 3);
                            colour = Math.round(255 * colour);

                            var fillStyle = 'rgb(' + (255 - colour) + ',' + (255 - colour) + ',' + colour + ')';
                            context.fillStyle = fillStyle;
                            context.fillRect(x, y, pixelsPerCol, pixelsPerRow);
                        }
                    }
                }
            }
        };
    });
