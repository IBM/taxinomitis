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

                $scope.getBarHeight = function(value) {
                    return (value / $scope.maxValue * 100) + '%';
                };
            }
        };
    });