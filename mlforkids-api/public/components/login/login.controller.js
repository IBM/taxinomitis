(function () {

    angular
        .module('app')
        .controller('LoginController', LoginController);

    LoginController.$inject = [
        'authService', 'loggerService', '$location', '$stateParams',
        '$document', '$scope', '$timeout', '$state', '$translate', '$mdDialog'
    ];

    function LoginController(authService, loggerService, $location, $stateParams, $document, $scope, $timeout, $state, $translate, $mdDialog) {
        var vm = this;
        vm.authService = authService;

        vm.loginstate = 'login';
        readFocusFromUrl();

        vm.sendEmail = function (ev) {
            var lang = $translate.use();
            if (lang === 'ar') {
                $mdDialog.show(
                    $mdDialog.alert()
                        .title('How to ask Dale to create a managed class account for you')
                        .htmlContent('<div>If you are a teacher or you run a not-for-profit coding group for children, please email me at dale.lane@uk.ibm.com with : <ul><li>your name and title</li><li>the name and web address of your school or coding group</li><li>the number of students in your group</li></ul></div>')
                        .ok('OK')
                        .targetEvent(ev)
                    );
            }
            else {
                window.location = 'mailto:dale.lane@uk.ibm.com?subject=New%20MLforKids%20class%20account&body=___PLEASE%20FILL%20IN%20THIS%20TEMPLATE___%0A%0APlease%20can%20you%20setup%20a%20new%20class%20account%20for%20my%20group.%20%0A%0AI%20need%20it%20for%20my%20group%20of%20___THIS%20MANY___%20students.%20%0A%0AI%20run%20___NAME%20OF%20SCHOOL%20%2F%20DESCRIPTION%20OF%20CODING%20GROUP___.%20%0A%0AYou%20can%20find%20us%20at%20___WEB%20ADDRESS%20FOR%20SCHOOL%20OR%20CODING%20GROUP___.%0A%0AThanks%20very%20much!%0A%0A___WHO%20I%20AM___';
            }
        };

        vm.deployment = $stateParams.DEPLOYMENT;

        vm.startTryItNowSession = function (ev) {
            loggerService.debug('[ml4klogin] starting Try It Now');
            $scope.failure = null;

            authService.createSessionUser()
                .then(function (/* newUser */) {
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
