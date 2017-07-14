(function () {

    angular
        .module('app', ['ngMaterial', 'ngAnimate', 'ngMessages', 'auth0.lock', 'angular-jwt', 'ui.router'])
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
                templateUrl: 'components-<%= VERSION %>/welcome/welcome.html',
                controllerAs: 'vm'
            })
            .state('login', {
                url: '/login',
                controller: 'LoginController',
                templateUrl: 'components-<%= VERSION %>/login/login.html',
                controllerAs: 'vm'
            })
            .state('about', {
                url: '/about',
                controller: 'AboutController',
                templateUrl: 'components-<%= VERSION %>/about/about.html',
                controllerAs: 'vm'
            })
            .state('help', {
                url: '/help',
                controller: 'HelpController',
                templateUrl: 'components-<%= VERSION %>/help/help.html',
                controllerAs: 'vm'
            })
            .state('worksheets', {
                url: '/worksheets',
                controller: 'WorksheetsController',
                templateUrl: 'components-<%= VERSION %>/worksheets/worksheets.html',
                controllerAs: 'vm'
            })
            .state('teacher', {
                url: '/teacher',
                controller: 'TeacherController',
                templateUrl: 'components-<%= VERSION %>/teacher/teacher.html',
                controllerAs: 'vm',
                params: {
                    VERSION : <%= VERSION %>
                }
            })
            .state('projects', {
                url: '/projects',
                controller: 'ProjectsController',
                templateUrl: 'components-<%= VERSION %>/projects/projects.html',
                controllerAs: 'vm',
                params: {
                    VERSION : <%= VERSION %>
                }
            })
            .state('mlproject', {
                url: '/mlproject/:projectId',
                controller: 'ProjectController',
                templateUrl: 'components-<%= VERSION %>/mlproject/mlproject.html',
                controllerAs: 'vm'
            })
            .state('mlproject_training', {
                url: '/mlproject/:projectId/training',
                controller: 'TrainingController',
                templateUrl: 'components-<%= VERSION %>/training/training.html',
                controllerAs: 'vm',
                params: {
                    VERSION : <%= VERSION %>
                }
            })
            .state('mlproject_models', {
                url: '/mlproject/:projectId/models',
                controller: 'ModelsController',
                templateUrl: 'components-<%= VERSION %>/models/models.html',
                controllerAs: 'vm'
            })
            .state('mlproject_scratch', {
                url: '/mlproject/:projectId/scratch',
                controller: 'ScratchController',
                templateUrl: 'components-<%= VERSION %>/scratch/scratch.html',
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
                allowForgotPassword: false,
                allowSignUp : false
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
