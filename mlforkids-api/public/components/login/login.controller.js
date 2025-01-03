(function () {

    angular
        .module('app')
        .controller('LoginController', LoginController);

    LoginController.$inject = [
        'authService', 'loggerService', 'browserStorageService',
        '$location', '$stateParams', '$document', '$scope',
        '$timeout', '$state', '$mdDialog'
    ];

    function LoginController(authService, loggerService, browserStorageService, $location, $stateParams, $document, $scope, $timeout, $state, $mdDialog) {
        var vm = this;
        vm.authService = authService;

        vm.loginstate = 'login';
        readFocusFromUrl();

        vm.sendEmail = function (ev) {
            $mdDialog.show({
                templateUrl : 'static/components/login/signup.tmpl.html',
                autoWrap : false,
                targetEvent : ev,
                controller : function ($scope) {
                    $scope.close = function() {
                        $mdDialog.hide();
                    };
                }
            });
        };

        vm.deployment = $stateParams.DEPLOYMENT;

        vm.startTryItNowSession = function (ev) {
            loggerService.debug('[ml4klogin] starting Try It Now');
            $scope.failure = null;

            authService.createSessionUser()
                .then(function (/* newUser */) {
                    // can't rely on session users to log out,
                    //  so we clean up after the last session user
                    //  when the next one logs in
                    return attemptSessionUserCleanup();
                })
                .then(function () {
                    $timeout(function () {
                        $state.go('projects');
                    });
                })
                .catch(function (err) {
                    loggerService.error('[ml4klogin] session creation failed', err);

                    var errObj = err.data;

                    $scope.failure = {
                        message : getErrorMessage(errObj),
                        status : err.status
                    };
                    $timeout(function () {
                        var newItem = document.getElementById('sessionuserfailure');
                        $document.duScrollToElementAnimated(angular.element(newItem));
                    }, 0);
                });
        };


        function attemptSessionUserCleanup () {
            return browserStorageService.deleteSessionUserProjects()
                .catch(function (err) {
                    loggerService.error('[ml4klogin] failed to cleanup session user resources', err);
                    return;
                });
        }


        function getErrorMessage (errObj) {
            if (errObj && errObj.error) {
                if (errObj.error === 'Class full') {
                    return 'There are too many students trying the site. Sorry, but there is a limit for how many students can use "Try it now" at once. Please do try later - or create yourself an account and log on now!';
                }
                else {
                    return errObj.error;
                }
            }
            if (errObj && errObj.message) {
                return errObj.message;
            }
            return 'Unknown error';
        }

        function readFocusFromUrl() {
            var urlParms = $location.search();
            if (urlParms && urlParms.tab) {
                switch (urlParms.tab) {
                    case 'login':
                    case 'reset':
                    case 'signup':
                    case 'teachersignup':
                    case 'newstudent':
                    case 'whyregister':
                        vm.loginstate = urlParms.tab;
                        break;
                }
            }
        }
    }
}());
