(function () {

    angular
        .module('app')
        .controller('LoginController', LoginController);

    LoginController.$inject = [
        'authService'
    ];

    function LoginController(authService) {
        var vm = this;
        vm.authService = authService;

        vm.selectedTab = 'login';

        vm.sendEmail = function () {
            window.location = 'mailto:dale.lane@uk.ibm.com?subject=New%20MLforKids%20class%20account&body=Please%20can%20you%20setup%20a%20new%20class%20account%20for%20my%20group.%20%0A%0AI%20need%20it%20from%20<THIS%20DATE>%20to%20<THAT%20DATE>%20for%20my%20group%20of%20<THIS%20MANY>%20students.%20%0A%0AI%20run%20<DESCRIPTION%20OF%20CODING%20GROUP%20AND%20THE%20STUDENTS%20I%20WORK%20WITH>.%0A%0AThanks%20very%20much!%0A%0A<WHO%20I%20AM>';
        };
    }

}());
