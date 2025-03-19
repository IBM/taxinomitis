(function () {

    angular
        .module('app')
        .controller('DebugApisController', DebugApisController);

    DebugApisController.$inject = [
        '$scope', '$http'
    ];

    function DebugApisController($scope, $http) {
        $scope.apioutput = { text : "API OUTPUT\n" };

        function debugobj (jsonresponse) {
            console.log(jsonresponse);
            $scope.$applyAsync(() => {
                $scope.apioutput.text += (JSON.stringify(jsonresponse) + "\n");
            });
        }
        function debugstr (txt) {
            console.log(txt);
            $scope.$applyAsync(() => {
                $scope.apioutput.text += (txt + "\n");
            });
        }
        function divider (title) {
            debugstr('-------------------------------------------------------');
            debugstr(title);
            debugstr('-------------------------------------------------------');
        }
        function handleErr (err) {
            debugobj(err.data);
        }

        $scope.geterror = function (errcode) {
            divider(errcode);

            $http.get('/api/debug/errors/' + errcode)
                .then(function (resp) {
                    debug(resp.data);
                })
                .catch (function (err) {
                    handleErr(err);
                });
        };
    }
}());
