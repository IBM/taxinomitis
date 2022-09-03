(function () {

    angular
        .module('app')
        .controller('PretrainedController', PretrainedController);

    PretrainedController.$inject = [
        'scratchService', 'loggerService',
        '$mdDialog',
        '$location', '$window'
    ];

    function PretrainedController(scratchService, loggerService, $mdDialog, $location, $window) {
        var vm = this;

        var siteUrl = $location.protocol() + '://' + $location.host();
        if ($location.port()) {
            siteUrl = siteUrl + ':' + $location.port();
        }

        vm.openTensorFlowDialog = function (ev) {
            $mdDialog.show({
                controller : function ($scope) {
                    $scope.siteurl = siteUrl;
                    $scope.modeljson = '';
                    $scope.scratchkey = ':scratchkey';
                    $scope.modeltypeid = 10;
                    $scope.validating = false;

                    $scope.hide = function() {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function() {
                        $scope.validating = true;
                        scratchService.newTfjsExtension({
                            modelurl : $scope.modeljson,
                            modeltype : $scope.modeltypeid === 10 ? 'teachablemachineimage' : 'graphdefimage'
                        }).then(function (extensionInfo) {
                            $window.open('https://scratch.machinelearningforkids.co.uk?url=' + siteUrl + extensionInfo.url, '_blank');
                            $scope.validating = false;
                            $mdDialog.hide();
                        }).catch(function (err) {
                            loggerService.debug('[ml4kpretrn] Model not found', err);
                            $scope.error = true;
                            $scope.validating = false;
                        });
                    };
                    $scope.generateScratchKey = function(modelJsonUrl, modelTypeId) {
                        $scope.error = false;
                        $scope.scratchkey = encodeURIComponent(JSON.stringify({
                            modelurl : modelJsonUrl,
                            modeltypeid : modelTypeId
                        }));
                    };
                },
                templateUrl : 'static/components/pretrained/tfjs.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            });
        };
    }

}());
