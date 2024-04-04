(function () {

    angular
        .module('app')
        .controller('ModelDescribeController', ModelDescribeController);

        ModelDescribeController.$inject = [
            'authService', 'loggerService', 'browserStorageService',
            '$sce', '$stateParams', '$scope', '$timeout', '$interval', '$document'
        ];

    function ModelDescribeController(authService, loggerService, browserStorageService, $sce, $stateParams, $scope, $timeout, $interval, $document) {
        var vm = this;
        vm.authService = authService;


        $scope.loading = true;

        $scope.projectId = $stateParams.projectId;
        $scope.userId = $stateParams.userId;
        $scope.modelId = $stateParams.modelId;

        $scope.modelinfo = undefined;

        var alertId = 1;
        vm.errors = [];
        vm.warnings = [];
        vm.dismissAlert = function (type, errIdx) {
            vm[type].splice(errIdx, 1);
        };
        function displayAlert(type, status, errObj) {
            loggerService.error(errObj);

            if (!errObj) {
                errObj = {};
            }

            // create alert and display it
            var newId = alertId++;
            var newAlert = {
                code : errObj.code,
                alertid : newId,
                message : errObj.message || errObj.error || 'Unknown error',
                status : status
            };
            vm[type].push(newAlert);

            return newId;
        }

        function scrollToNewItem(itemId) {
            $timeout(function () {
                var newItem = document.getElementById(itemId);
                $document.duScrollToElementAnimated(angular.element(newItem));
            }, 0);
        }


        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                return browserStorageService.retrieveAsset($scope.projectId + '-viz');
            })
            .then((svgblob) => {
                return svgblob.text();
            })
            .then((svg) => {
                $scope.svgdiagram = $sce.trustAsHtml(svg);
                $scope.loading = false;
                $scope.modelinfo = true;
            })
            .catch(function (err) {
                var errId = displayAlert('errors', err.status, err.data);
                scrollToNewItem('errors' + errId);
                $scope.loading = false;
            });

        //-------------------------------------------------------------------------------
        // Moving the decision tree graphic around
        //-------------------------------------------------------------------------------

        var operation;

        vm.stop = function() {
            if (operation) {
                $interval.cancel(operation);
                clearInterval(operation);
                operation = undefined;
            }
        };

        var REPEAT_INTERVAL = 50;
        var SCROLL_PIXELS = 20;
        var scale = 1;


        vm.grow = function() {
            vm.stop();
            var image = document.getElementById("mlforkidsmodelvizimghost").childNodes[0];
            operation = $interval(function () {
                scale += 0.1;
                image.style.transform = `scale(${scale})`;
            }, REPEAT_INTERVAL);
        };

        vm.shrink = function() {
            vm.stop();
            var image = document.getElementById("mlforkidsmodelvizimghost").childNodes[0];
            operation = $interval(function () {
                if (scale > 0.2) {
                    scale -= 0.1;
                    image.style.transform = `scale(${scale})`;
                }
            }, REPEAT_INTERVAL);
        };

        vm.goleft = function() {
            vm.stop();
            var container = document.getElementById("mlforkidsmodelvizimghost");
            operation = $interval(function () {
                container.scrollLeft += SCROLL_PIXELS;
            }, REPEAT_INTERVAL);
        };
        vm.goright = function() {
            vm.stop();
            var container = document.getElementById("mlforkidsmodelvizimghost");
            operation = $interval(function () {
                container.scrollLeft -= SCROLL_PIXELS;
            }, REPEAT_INTERVAL);
        };
        vm.goup = function() {
            vm.stop();
            var container = document.getElementById("mlforkidsmodelvizimghost");
            operation = $interval(function () {
                container.scrollTop -= SCROLL_PIXELS;
            }, REPEAT_INTERVAL);
        };
        vm.godown = function() {
            vm.stop();
            var container = document.getElementById("mlforkidsmodelvizimghost");
            operation = $interval(function () {
                container.scrollTop += SCROLL_PIXELS;
            }, REPEAT_INTERVAL);
        };



        //-------------------------------------------------------------------------------

    }
}());
