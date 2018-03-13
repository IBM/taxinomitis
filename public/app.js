(function () {

    angular
        .module('app', ['ngMaterial', 'ngAnimate', 'ngMessages', 'ngSanitize', 'auth0.lock', 'angular-jwt', 'ui.router', 'duScroll', 'webcam'])
        .config(config);

    config.$inject = [
        '$stateProvider',
        '$locationProvider',
        'lockProvider',
        '$urlRouterProvider',
        'jwtOptionsProvider',
        '$httpProvider',
    ];

    function config($stateProvider, $locationProvider, lockProvider, $urlRouterProvider, jwtOptionsProvider, $httpProvider) {

        $stateProvider
            .state('home', {
                url: '',
                templateUrl: 'static/components-<%= VERSION %>/welcome/welcome.html'
            })
            .state('welcome', {
                url: '/welcome',
                templateUrl: 'static/components-<%= VERSION %>/welcome/welcome.html'
            })
            .state('login', {
                url: '/login',
                controller: 'LoginController',
                templateUrl: 'static/components-<%= VERSION %>/login/login.html',
                controllerAs: 'vm',
                params: {
                    VERSION : <%= VERSION %>
                }
            })
            .state('signup', {
                url: '/signup',
                controller: 'SignupController',
                templateUrl: 'static/components-<%= VERSION %>/signup/signup.html',
                controllerAs: 'vm',
                params: {
                    VERSION : <%= VERSION %>
                }
            })
            .state('about', {
                url: '/about',
                templateUrl: 'static/components-<%= VERSION %>/about/about.html'
            })
            .state('news', {
                url: '/news',
                templateUrl: 'static/components-<%= VERSION %>/news/news.html'
            })
            .state('help', {
                url: '/help',
                templateUrl: 'static/components-<%= VERSION %>/help/help.html'
            })
            .state('worksheets', {
                url: '/worksheets',
                controller: 'WorksheetsController',
                templateUrl: 'static/components-<%= VERSION %>/worksheets/worksheets.html',
                controllerAs: 'vm',
                params: {
                    VERSION : <%= VERSION %>
                }
            })
            .state('teacher', {
                url: '/teacher',
                controller: 'TeacherController',
                templateUrl: 'static/components-<%= VERSION %>/teacher/teacher.html',
                controllerAs: 'vm',
                params: {
                    VERSION : <%= VERSION %>
                }
            })
            .state('newproject', {
                url: '/newproject',
                controller: 'NewProjectController',
                templateUrl: 'static/components-<%= VERSION %>/newproject/newproject.html',
                controllerAs: 'vm',
                params: {
                    VERSION : <%= VERSION %>
                }
            })
            .state('projects', {
                url: '/projects',
                controller: 'ProjectsController',
                templateUrl: 'static/components-<%= VERSION %>/projects/projects.html',
                controllerAs: 'vm'
            })
            .state('mlproject', {
                url: '/mlproject/:userId/:projectId',
                controller: 'ProjectController',
                templateUrl: 'static/components-<%= VERSION %>/mlproject/mlproject.html',
                controllerAs: 'vm'
            })
            .state('mlproject_training', {
                url: '/mlproject/:userId/:projectId/training',
                controller: 'TrainingController',
                templateUrl: 'static/components-<%= VERSION %>/training/training.html',
                controllerAs: 'vm',
                params: {
                    VERSION : <%= VERSION %>
                }
            })
            .state('mlproject_models', {
                url: '/mlproject/:userId/:projectId/models',
                controller: 'ModelsController',
                templateUrl: 'static/components-<%= VERSION %>/models/models.html',
                controllerAs: 'vm',
                params: {
                    VERSION : <%= VERSION %>
                }
            })
            .state('mlproject_scratch', {
                url: '/mlproject/:userId/:projectId/scratch',
                controller: 'ScratchController',
                templateUrl: 'static/components-<%= VERSION %>/scratch/scratch.html',
                controllerAs: 'vm'
            })
            .state('siteadmin', {
                url: '/siteadmin',
                controller: 'AdminController',
                templateUrl: 'static/components-<%= VERSION %>/admin/admin.html',
                controllerAs: 'vm'
            })
            .state('404', {
                url: '/404',
                templateUrl: 'static/components-<%= VERSION %>/404/404.html'
            });


        lockProvider.init({
            clientID : AUTH0_CLIENT_ID,
            domain : AUTH0_DOMAIN,
            options : {
                autoclose : true,
                auth : {
                    responseType: 'token id_token',
                    audience: 'https://' + AUTH0_DOMAIN + '/userinfo',
                    redirectUrl: AUTH0_CALLBACK_URL,
                    params: {
                        scope: 'openid email app_metadata'
                    }
                },
                theme : {
                    logo : 'static/images/mlforkids-logo.jpg',
                    primaryColor : '#337ab7'
                },

                // assuming school computers are shared so doing this would be bad
                rememberLastLogin: false,

                // don't ask for email address as identifier, as we're assuming
                //  kids won't have email addresses so we don't want to confuse
                //  matters by asking for it now
                usernameStyle: 'username',

                // password-reset is for teachers only, so we'll have a separate
                //  way to get to this, and disable it on the default login popup
                allowForgotPassword : false,

                // we don't want people creating their own accounts
                allowSignUp : false
            }
        });



        $urlRouterProvider.otherwise('/404');

        jwtOptionsProvider.config({
            tokenGetter: ['options', function (options) {
                if (options && options.url.substr(options.url.length - 5) == '.html') {
                    return null;
                }

                // window.localStorageObj is created in auth.service.js
                //  It will be localStorage if available, or a local in-memory shim otherwise
                return window.localStorageObj.getItem('id_token');
            }],
            whiteListedDomains: ['localhost'],
            unauthenticatedRedirectPath: '/login'
        });

        $httpProvider.interceptors.push('jwtInterceptor');
    }
})();
