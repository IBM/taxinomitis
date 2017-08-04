(function () {

    angular
        .module('app')
        .directive('mlImageOnError', mlImageOnError);

    function mlImageOnError() {

        function link (scope, jqlElements, attrs) {
            jqlElements.bind('error', function () {
                scope.$apply(attrs.mlImageOnError);
            });
        }

        return {
            link : link
        };
    }
}());
