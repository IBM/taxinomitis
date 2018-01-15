(function () {

    angular
        .module('app')
        .controller('AdminController', AdminController);

        AdminController.$inject = [
        'authService', 'usersService',
        '$stateParams'
    ];

    function AdminController(authService, usersService, $stateParams) {

        var vm = this;
        vm.authService = authService;

        vm.orderBy = 'supervisors[0].created';

        vm.filters = {
            managed : 'all',
            credentials : 'all',
            demo : 'all',
            active : 'all',
            dale : 'all'
        };

        // vm.newtenant = {
        //     classid : '',
        //     username : '',
        //     email : '',
        //     projecttypes : {
        //         text : false,
        //         images : false,
        //         numbers : false
        //     },
        //     maxusers : 5
        // };

        vm.filter = function (item) {
            var passFilter = true;
            if (passFilter && vm.filters.managed !== 'all') {
                if (vm.filters.managed === 'yes') {
                    passFilter = item.is_managed;
                }
                else if (vm.filters.managed === 'no') {
                    passFilter = !(item.is_managed);
                }
            }
            if (passFilter && vm.filters.credentials !== 'all') {
                if (vm.filters.credentials === 'none') {
                    passFilter = (item.credentials.total === 0);
                }
                else if (vm.filters.credentials === 'setup') {
                    passFilter = (item.credentials.total > 0);
                }
            }
            if (passFilter && vm.filters.demo !== 'all') {
                if (vm.filters.demo === 'demo') {
                    passFilter = (item.id === 'demo');
                }
                else if (vm.filters.demo === 'exclude') {
                    passFilter = (item.id !== 'demo');
                }
            }
            if (passFilter && vm.filters.active !== 'all') {
                if (vm.filters.active === '2018') {
                    passFilter = (item.supervisors[0].last_login &&
                                  new Date(item.supervisors[0].last_login) > new Date('2018-01-01'));
                }
                else if (vm.filters.active === 'multiple') {
                    passFilter = item.supervisors[0].logins_count > 1;
                }
                else if (vm.filters.active === 'once') {
                    passFilter = item.supervisors[0].logins_count > 0;
                }
                else if (vm.filters.active === 'never') {
                    passFilter = item.supervisors[0].logins_count === 0;
                }
            }
            if (passFilter && vm.filters.dale !== 'all') {
                if (vm.filters.dale === 'exclude') {
                    passFilter = (item.supervisors[0].username !== 'dale' &&
                                  item.supervisors[0].username !== 'demo' &&
                                  item.supervisors[0].username !== 'dalelane');
                }
            }
            return passFilter;
        };


        vm.createManagedTenant = function () {
            console.log(vm.newtenant);
        };


        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                if (profile.role === 'siteadmin') {
                    usersService.getClassesList(profile)
                        .then(function (tenants) {
                            vm.tenants = tenants;
                        });
                }
            });

    }
}());
