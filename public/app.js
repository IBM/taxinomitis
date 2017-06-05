(function () {

    angular
        .module('app', ['ngMaterial', 'auth0.lock', 'angular-jwt', 'ui.router'])
        .config(config);

    config.$inject = [
        '$stateProvider',
        'lockProvider',
        '$urlRouterProvider',
        'jwtOptionsProvider',
        '$httpProvider',
    ];

    function config($stateProvider, lockProvider, $urlRouterProvider, jwtOptionsProvider, $httpProvider) {

        $stateProvider
            .state('welcome', {
                url: '/welcome',
                controller: 'WelcomeController',
                templateUrl: 'components/welcome/welcome.html',
                controllerAs: 'vm'
            })
            .state('login', {
                url: '/login',
                controller: 'LoginController',
                templateUrl: 'components/login/login.html',
                controllerAs: 'vm'
            })
            .state('students', {
                url: '/students',
                controller: 'StudentsController',
                templateUrl: 'components/students/students.html',
                controllerAs: 'vm'
            })
            .state('projects', {
                url: '/projects',
                controller: 'ProjectsController',
                templateUrl: 'components/projects/projects.html',
                controllerAs: 'vm'
            })
            .state('mlproject', {
                url: '/mlproject/:projectId',
                controller: 'ProjectController',
                templateUrl: 'components/mlproject/mlproject.html',
                controllerAs: 'vm'
            })
            .state('mlproject_training', {
                url: '/mlproject/:projectId/training',
                controller: 'TrainingController',
                templateUrl: 'components/training/training.html',
                controllerAs: 'vm'
            })
            .state('mlproject_models', {
                url: '/mlproject/:projectId/models',
                controller: 'ModelsController',
                templateUrl: 'components/models/models.html',
                controllerAs: 'vm'
            })
            .state('mlproject_test', {
                url: '/mlproject/:projectId/test',
                controller: 'TestController',
                templateUrl: 'components/test/test.html',
                controllerAs: 'vm'
            })
            .state('mlproject_scratch', {
                url: '/mlproject/:projectId/scratch',
                controller: 'ScratchController',
                templateUrl: 'components/scratch/scratch.html',
                controllerAs: 'vm'
            });


        lockProvider.init({
            clientID: AUTH0_CLIENT_ID,
            domain: AUTH0_DOMAIN,
            options: {
                _idTokenVerification: false,

                // assuming school computers are shared so doing this is bad
                rememberLastLogin: false,

                languageDictionary: {
                    title: 'Log in to ML for kids',
                },

                // this is needed so the API can get profile info from the token
                auth: {
                    params: {
                        scope: 'openid email app_metadata'
                    }
                },

                // don't ask for email address as identifier, as we're assuming
                //  kids won't have email addresses so we don't want to confuse
                //  matters by asking for it now
                usernameStyle: 'username',

                // we'll put this on the welcome screen, as we want to limit this
                //  to teachers only
                allowForgotPassword: false
            }
        });


        $urlRouterProvider.otherwise('/welcome');

        jwtOptionsProvider.config({
            tokenGetter: ['options', function (options) {
                if (options && options.url.substr(options.url.length - 5) == '.html') {
                    return null;
                }
                return localStorage.getItem('id_token');
            }],
            whiteListedDomains: ['localhost'],
            unauthenticatedRedirectPath: '/login'
        });

        $httpProvider.interceptors.push('jwtInterceptor');
    }

})();
