angular.module('app')
    .directive('mldatatable', function () {
        return {
            restrict: 'E',
            scope: {
                project: '=',
                training: '=',
                mode: '=',
                setMode: '=',
                onDeleteItem: '='
            },
            controller: [
                '$scope',

                function mlDataTableController($scope) {
                    $scope.sortCol = 'id';
                    $scope.sort = function (col, dir) {
                        $scope.sortCol = (dir === 'desc' ? '-' : '') + col;
                    };
                    $scope.isOutputColumn = function (item) {
                        return item.output;
                    };
                }
            ],
            templateUrl: 'static/components/mldatatable/mldatatable.html'
        };
    });