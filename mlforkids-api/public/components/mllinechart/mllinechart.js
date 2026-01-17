(function () {
    angular.module('app')
        .directive('mllinechart', function () {
            return {
                templateUrl: 'static/components/mllinechart/mllinechart.html',
                restrict: 'E',

                scope: {
                    chartData: '=',   // { epochs: [], training: [], validation: [] }
                    title: '@',
                    xlabel: '@',
                    ylabel: '@'
                },

                link: function ($scope, element, attrs) {
                    console.log($scope.title);

                    $scope.$watch('chartData', function (newData) {
                        if (newData && newData.epochs && newData.epochs.length > 0) {
                            $scope.prepareChart(newData);
                        }
                    }, true);

                    $scope.prepareChart = function (data) {
                        var width = 800;
                        var height = 500;
                        var padding = { top: 10, right: 40, bottom: 20, left: 80 };
                        var chartWidth = width - padding.left - padding.right;
                        var chartHeight = height - padding.top - padding.bottom - 100;

                        var allLossValues = data.training.concat(data.validation);
                        var minLoss = Math.min.apply(null, allLossValues);
                        var maxLoss = Math.max.apply(null, allLossValues);

                        var lossRange = maxLoss - minLoss;
                        var yMin = Math.max(0, minLoss - lossRange * 0.1);
                        var yMax = maxLoss + lossRange * 0.1;

                        var maxEpoch = Math.max.apply(null, data.epochs);

                        var xScale = function (epoch) {
                            return (epoch / maxEpoch) * chartWidth;
                        };

                        var yScale = function (loss) {
                            return chartHeight - ((loss - yMin) / (yMax - yMin)) * chartHeight;
                        };

                        var trainingPath = '';
                        for (var i = 0; i < data.epochs.length; i++) {
                            var x = xScale(data.epochs[i]);
                            var y = yScale(data.training[i]);
                            trainingPath += (i === 0 ? 'M' : 'L') + x + ',' + y + ' ';
                        }

                        var validationPath = '';
                        for (var i = 0; i < data.epochs.length; i++) {
                            var x = xScale(data.epochs[i]);
                            var y = yScale(data.validation[i]);
                            validationPath += (i === 0 ? 'M' : 'L') + x + ',' + y + ' ';
                        }

                        // Generate y-axis labels (5 ticks)
                        var yAxisLabels = [];
                        for (var i = 0; i <= 5; i++) {
                            var value = yMin + (yMax - yMin) * (i / 5);
                            yAxisLabels.push({
                                value: value.toFixed(3),
                                y: yScale(value)
                            });
                        }

                        // Generate x-axis labels (show every 20th epoch or so)
                        var xAxisLabels = [];
                        var step = Math.ceil(maxEpoch / 10);
                        for (var i = 0; i <= maxEpoch; i += step) {
                            xAxisLabels.push({
                                value: i,
                                x: xScale(i)
                            });
                        }
                        // add the last epoch
                        if (xAxisLabels[xAxisLabels.length - 1].value !== maxEpoch) {
                            xAxisLabels.push({
                                value: maxEpoch,
                                x: xScale(maxEpoch)
                            });
                        }

                        $scope.chartDimensions = {
                            width: width,
                            height: height,
                            padding: padding,
                            chartWidth: chartWidth,
                            chartHeight: chartHeight
                        };

                        $scope.trainingPath = trainingPath;
                        $scope.validationPath = validationPath;
                        $scope.yAxisLabels = yAxisLabels;
                        $scope.xAxisLabels = xAxisLabels;

                        $scope.finalTrainingLoss = data.training[data.training.length - 1].toFixed(3);
                        $scope.finalValidationLoss = data.validation[data.validation.length - 1].toFixed(3);
                    };
                }
            };
        });
})();
