(function () {

    angular
        .module('app')
        .controller('DatasetsController', DatasetsController);

        DatasetsController.$inject = [
            'authService',
            'projectsService',
            '$state', '$translate', '$mdDialog', '$stateParams'
        ];


    function DatasetsController(authService, projectsService, $state, $translate, $mdDialog, $stateParams) {

        var vm = this;
        vm.authService = authService;

        vm.creating = false;
        vm.loading = true;

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

            if (errObj &&
                status === 403 &&
                errObj.error === 'Support for images projects is not enabled for your class' &&
                vm.profile.tenant === 'session-users')
            {
                errObj.message = 'You can\'t train machine learning models to recognise images with "Try it now". ' +
                                 'You will be able to create images projects if you login with a regular account. ' +
                                 'See the "Help" page for more details about the differences between creating an account and using "Try it now".';
            }

            vm[type].push({
                alertid : alertId++,
                message : errObj.message || errObj.error || 'Unknown error',
                status : status
            });
        }

        vm.datasets = [];

        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                $translate([
                    'DATASETS.DATA.TITANIC.TITLE', 'DATASETS.DATA.TITANIC.SUMMARY', 'DATASETS.DATA.TITANIC.DESCRIPTION', 'DATASETS.DATA.TITANIC.DETAILS',
                    'DATASETS.DATA.UKNEWSPAPERS.TITLE', 'DATASETS.DATA.UKNEWSPAPERS.SUMMARY', 'DATASETS.DATA.UKNEWSPAPERS.DESCRIPTION', 'DATASETS.DATA.UKNEWSPAPERS.DETAILS',
                    'DATASETS.DATA.CATSANDDOGS.TITLE', 'DATASETS.DATA.CATSANDDOGS.SUMMARY', 'DATASETS.DATA.CATSANDDOGS.DESCRIPTION', 'DATASETS.DATA.CATSANDDOGS.DETAILS',
                    'DATASETS.DATA.PHISHING.TITLE', 'DATASETS.DATA.PHISHING.SUMMARY', 'DATASETS.DATA.PHISHING.DESCRIPTION', 'DATASETS.DATA.PHISHING.DETAILS'
                ]).then(function (translations) {
                    vm.datasets = [
                        {
                            id: 'titanic',
                            title: translations['DATASETS.DATA.TITANIC.TITLE'],
                            summary: translations['DATASETS.DATA.TITANIC.SUMMARY'],
                            description: translations['DATASETS.DATA.TITANIC.DESCRIPTION'],
                            details: translations['DATASETS.DATA.TITANIC.DETAILS'],
                            type: 'numbers',
                            image: 'static/images/dataset-titanic.png'
                        },
                        {
                            id: 'uk-newspaper-headlines',
                            title: translations['DATASETS.DATA.UKNEWSPAPERS.TITLE'],
                            summary: translations['DATASETS.DATA.UKNEWSPAPERS.SUMMARY'],
                            description: translations['DATASETS.DATA.UKNEWSPAPERS.DESCRIPTION'],
                            details: translations['DATASETS.DATA.UKNEWSPAPERS.DETAILS'],
                            type: 'text',
                            image: 'static/images/dataset-ukheadlines.png'
                        },
                        {
                            id: 'cats-and-dogs',
                            title: translations['DATASETS.DATA.CATSANDDOGS.TITLE'],
                            summary: translations['DATASETS.DATA.CATSANDDOGS.SUMMARY'],
                            description: translations['DATASETS.DATA.CATSANDDOGS.DESCRIPTION'],
                            details: translations['DATASETS.DATA.CATSANDDOGS.DETAILS'],
                            type: 'images',
                            image: 'static/images/dataset-catsanddogs.png'
                        },
                        {
                            id: 'phishing',
                            title: translations['DATASETS.DATA.PHISHING.TITLE'],
                            summary: translations['DATASETS.DATA.PHISHING.SUMMARY'],
                            description: translations['DATASETS.DATA.PHISHING.DESCRIPTION'],
                            details: translations['DATASETS.DATA.PHISHING.DETAILS'],
                            type: 'numbers',
                            image: 'static/images/dataset-catsanddogs.png'
                        }
                    ];

                    vm.loading = false;
                });
            })
            .catch(function (err) {
                displayAlert('errors', err.status, err.data);
            });


        vm.displayDataset = function (ev, dataset) {
            if (vm.creating) {
                return;
            }

            $mdDialog.show({
                locals : {
                    dataset : dataset
                },
                controller : function ($scope, locals) {
                    $scope.dataset = locals.dataset;
                    $scope.hide = function() {
                        $mdDialog.hide();
                    };
                    $scope.confirm = function() {
                        $mdDialog.hide($scope.dataset);
                    };
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                },
                templateUrl : 'static/components-' + $stateParams.VERSION + '/datasets/dataset.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (datasetToImport) {
                    vm.importProject(datasetToImport);
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };




        vm.importProject = function (dataset) {
            if (vm.creating) {
                return;
            }

            vm.creating = true;

            projectsService.createProject({ type : dataset.type, dataset : dataset.id },
                                          vm.profile.user_id,
                                          vm.profile.tenant)
                .then(function () {
                    $state.go('projects');
                })
                .catch(function (err) {
                    displayAlert('errors', err.status, err.data);

                    vm.creating = false;
                });
        };


    }
}());
