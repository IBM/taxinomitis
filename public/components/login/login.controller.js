(function () {

    angular
        .module('app')
        .controller('LoginController', LoginController);

    LoginController.$inject = [
        'authService', '$location', '$stateParams',
        '$document', '$scope', '$timeout', '$state',
        '$mdDialog'
    ];

    function LoginController(authService, $location, $stateParams, $document, $scope, $timeout, $state, $mdDialog) {
        var vm = this;
        vm.authService = authService;

        vm.loginstate = 'login';
        readFocusFromUrl();

        vm.sendEmail = function () {
            window.location = 'mailto:dale.lane@uk.ibm.com?subject=New%20MLforKids%20class%20account&body=___PLEASE%20FILL%20IN%20THIS%20TEMPLATE___%0A%0APlease%20can%20you%20setup%20a%20new%20class%20account%20for%20my%20group.%20%0A%0AI%20need%20it%20for%20my%20group%20of%20___THIS%20MANY___%20students.%20%0A%0AI%20run%20___NAME%20OF%20SCHOOL%20%2F%20DESCRIPTION%20OF%20CODING%20GROUP___.%20%0A%0AYou%20can%20find%20us%20at%20___WEB%20ADDRESS%20FOR%20SCHOOL%20OR%20CODING%20GROUP___.%0A%0AThanks%20very%20much!%0A%0A___WHO%20I%20AM___';
        };

        vm.outOfOffice = function (ev) {
            var confirm = $mdDialog.confirm()
                                .title('Happy Holidays!')
                                .htmlContent('<div class="outofoffice">I am on vacation, so I won\'t be available to set up ' +
                                                                        'classes until I get back in the New Year. </div>' +
                                             '<div class="outofoffice">You can set up your own class while I\'m away if you ' +
                                                                        'can\'t wait until I get back, or use "Try it now" to ' +
                                                                        'use the site without registering in the meantime.</div>' +
                                             '<div class="outofoffice">-- Dale</div>')
                            // .title('I need a bit of a break, sorry!')
                            // .htmlContent('<div class="outofoffice">I originally added this idea of a "Managed" class ' +
                            //                                         'to help teachers who found the signup process too ' +
                            //                                         'complicated or time-consuming. It means teachers have ' +
                            //                                         'been able to send me an email to ask me to do it for ' +
                            //                                         'them, and for the last couple of years I\'ve been ' +
                            //                                         'happy to do it to help many schools get started.</div>' +
                            //              '<div class="outofoffice">However, in recent months, this has increased ' +
                            //                                         'so much that I\'m spending hours doing this ' +
                            //                                         'every day. It\'s the main reason why I haven\'t been ' +
                            //                                         'able to add any significant new features or fixes to this ' +
                            //                                         'site recently.</div>' +
                            //              '<div class="outofoffice">I need to take a break from this. You are free to create yourself ' +
                            //                                         'a class account during this time - the only thing that is ' +
                            //                                         'pausing is my offer to email me to ask me to do it for you.</div>' +
                            //              '<div class="outofoffice">Sorry for any difficulty this causes.</div>' +
                            //              '<div class="outofoffice">-- Dale</div>')
                            .targetEvent(ev)
                            .ok('OK');
            $mdDialog.show(confirm)
                .then(function () {

                      },
                      function () {});
        };

        vm.deployment = $stateParams.DEPLOYMENT;

        vm.startTryItNowSession = function (ev) {
            $scope.failure = null;

            authService.createSessionUser()
                .then(function (/* newUser */) {
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
