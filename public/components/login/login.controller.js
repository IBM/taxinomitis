(function () {

    angular
        .module('app')
        .controller('LoginController', LoginController);

    LoginController.$inject = [
        'authService', '$location',
        '$document', '$scope', '$timeout', '$state'
    ];

    function LoginController(authService, $location, $document, $scope, $timeout, $state) {
        var vm = this;
        vm.authService = authService;

        vm.loginstate = 'login';
        readFocusFromUrl();

        vm.sendEmail = function () {
            window.location = 'mailto:dale.lane@uk.ibm.com?subject=New%20MLforKids%20class%20account&body=___PLEASE%20FILL%20IN%20THIS%20TEMPLATE___%0A%0APlease%20can%20you%20setup%20a%20new%20class%20account%20for%20my%20group.%20%0A%0AI%20need%20it%20for%20my%20group%20of%20___THIS%20MANY___%20students.%20%0A%0AI%20run%20___DESCRIPTION%20OF%20CODING%20GROUP%20AND%20THE%20STUDENTS%20I%20WORK%20WITH___.%0A%0AThanks%20very%20much!%0A%0A___WHO%20I%20AM___';
        };



        vm.startTryItNowSession = function (ev) {
            $scope.failure = null;

            authService.createSessionUser()
                .then(function (newUser) {
                    $timeout(function () {
                        $state.go('projects');
                    });
                })
                .catch(function (err) {
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
                    return 'There are too many people currently using this feature. Sorry, but I\'m limiting numbers for now. Please try later - or create yourself an account and log on now!';
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
