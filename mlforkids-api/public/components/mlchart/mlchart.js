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
                $scope.yAxisLabels = [];
                for (let i = $scope.yAxisTicks; i >= 0; i--) {
                    $scope.yAxisLabels.push($scope.maxValue * i / $scope.yAxisTicks);
                }
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
                scope.$watch('mlchartBarHeight', function(value) {
                    if (value !== undefined && scope.maxValue) {
                        const heightPercent = (value / scope.maxValue * 100);
                        element[0].style.setProperty('--bar-height', heightPercent + '%');
                    }
                });
            }
        };
    });