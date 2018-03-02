(function () {

    angular
        .module('app')
        .controller('LoginController', LoginController);

    LoginController.$inject = [
        'authService', '$location'
    ];

    function LoginController(authService, $location) {
        var vm = this;
        vm.authService = authService;

        vm.selectedTab = 'login';
        readFocusFromUrl();

        vm.sendEmail = function () {
            window.location = 'mailto:dale.lane@uk.ibm.com?subject=New%20MLforKids%20class%20account&body=___PLEASE%20FILL%20IN%20THIS%20TEMPLATE___%0A%0APlease%20can%20you%20setup%20a%20new%20class%20account%20for%20my%20group.%20%0A%0AI%20need%20it%20from%20___THIS%20DATE___%20to%20___THAT%20DATE___%20for%20my%20group%20of%20___THIS%20MANY___%20students.%20%0A%0AI%20run%20___DESCRIPTION%20OF%20CODING%20GROUP%20AND%20THE%20STUDENTS%20I%20WORK%20WITH___.%0A%0AThanks%20very%20much!%0A%0A___WHO%20I%20AM___';
        };


        function readFocusFromUrl() {
            var urlParms = $location.search();
            if (urlParms && urlParms.tab) {
                switch (urlParms.tab) {
                    case 'login':
                    case 'reset':
                    case 'signup':
                    case 'newstudent':
                        vm.selectedTab = urlParms.tab;
                        break;
                }
            }
        }
    }
}());
