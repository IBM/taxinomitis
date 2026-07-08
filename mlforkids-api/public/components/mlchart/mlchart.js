angular.module('app')
    .directive('mlchart', function () {
        return {
            templateUrl: 'static/components/mlchart/mlchart.html',
            restrict: 'E',

            scope : {
                chartData: '=',
                maxValue: '=',
                yAxisTicks: '=',
                selectedColumn: '='
            },

            link : function ($scope, element, attrs, controller, transcludeFn) {
                $scope.$watch('maxValue', function (maxValue) {
                    $scope.yAxisLabels = [];
                    for (let i = $scope.yAxisTicks; i >= 0; i--) {
                        $scope.yAxisLabels.push(Math.round(maxValue * i / $scope.yAxisTicks * 100) / 100);
                    }
                });
            }
        };
    })
    .directive('mlchartBarHeight', function () {
        return {
            restrict: 'A',
            scope: {
                mlchartBarHeight: '=',
                maxValue: '='
            },
            link: function (scope, element, attrs) {
                scope.$watchGroup(['mlchartBarHeight', 'maxValue'], function() {
                    const value = scope.mlchartBarHeight;
                    if (value !== undefined && scope.maxValue) {
                        const heightPercent = (value / scope.maxValue * 100);
                        element[0].style.setProperty('--bar-height', Math.min(100, heightPercent) + '%');
                        element.toggleClass('mlchart-bar-cropped', heightPercent > 100);
                    }
                });
            }
        };
    });