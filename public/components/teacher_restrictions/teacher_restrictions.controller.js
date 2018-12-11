(function () {

    angular
        .module('app')
        .controller('TeacherRestrictionsController', TeacherRestrictionsController);

    TeacherRestrictionsController.$inject = [
        'authService',
        'usersService',
        '$stateParams', '$mdDialog'
    ];

    function TeacherRestrictionsController(authService, usersService, $stateParams, $mdDialog) {

        var vm = this;
        vm.authService = authService;

        vm.saving = false;

        var alertId = 1;
        vm.errors = [];
        vm.warnings = [];
        vm.dismissAlert = function (type, errIdx) {
            vm[type].splice(errIdx, 1);
        };
        function displayAlert(type, status, errObj) {
            if (!errObj) {
                errObj = {};
            }
            var newId = alertId++;
            vm[type].push({
                alertid : newId,
                message : errObj.message || errObj.error || 'Unknown error',
                status : status
            });
            return newId;
        }


        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                if (profile.role === 'supervisor') {

                    usersService.getClassPolicy(profile)
                        .then(function (policy) {
                            vm.policy = policy;
                        })
                        .catch(function (err) {
                            displayAlert('errors', err.status, err.data);
                        });
                }
            })
            .catch(function (err) {
                displayAlert('errors', err.status, err.data);
            });

        vm.modifyExpiry = function (ev) {
            var initialtextexpiry = vm.policy.textClassifierExpiry;
            var initialimageexpiry = vm.policy.imageClassifierExpiry;

            $mdDialog.show({
                controller : function ($scope, $mdDialog) {
                    $scope.initialtextexpiry = initialtextexpiry;
                    $scope.initialimageexpiry = initialimageexpiry;

                    $scope.textexpiry = vm.policy.textClassifierExpiry;
                    $scope.imageexpiry = vm.policy.imageClassifierExpiry;

                    $scope.hoursfilter = function (hours) {
                        if (hours === 1) {
                            return '1 hour';
                        }
                        else if (hours < 24) {
                            return hours + ' hours';
                        }
                        else if (hours === 24) {
                            return '1 day';
                        }
                        else if (hours < 168) {
                            return Math.floor(hours / 24) + ' days, ' + (hours % 24) + ' hours';
                        }
                        else if (hours === 168) {
                            return '1 week';
                        }
                        else {
                            return '1 week, ' +
                                   Math.floor((hours - 168) / 24) + ' days, ' + (hours % 24) + ' hours';
                        }
                    };

                    $scope.hide = function () {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function () {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function (resp) {
                        $mdDialog.hide(resp);
                    };
                },
                templateUrl : 'static/components-' + $stateParams.VERSION + '/teacher_restrictions/modifyexpiry.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (expiries) {
                    vm.saving = true;
                    vm.policy.textClassifierExpiry = '...';
                    vm.policy.imageClassifierExpiry = '...';

                    usersService.modifyClassPolicy(vm.profile, expiries.textexpiry, expiries.imageexpiry)
                        .then(function (tenantinfo) {
                            vm.saving = false;
                            vm.policy.textClassifierExpiry = tenantinfo.textClassifierExpiry;
                            vm.policy.imageClassifierExpiry = tenantinfo.imageClassifierExpiry;
                        })
                        .catch(function (err) {
                            vm.saving = false;
                            displayAlert('errors', err.status, err.data);
                            vm.policy.textClassifierExpiry = initialtextexpiry;
                            vm.policy.imageClassifierExpiry = initialimageexpiry;
                        });
                },
                function() {
                    // cancelled. do nothing
                }
            )
        };
    }
}());
