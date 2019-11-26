(function () {

    angular
        .module('app', ['ngMaterial', 'ngAnimate', 'ngMessages', 'ngSanitize', 'auth0.lock', 'angular-jwt', 'ui.router', 'duScroll', 'webcam', 'pascalprecht.translate', 'angularMoment'])
        .config(config);

    config.$inject = [
        '$stateProvider',
        'lockProvider',
        '$urlRouterProvider',
        'jwtOptionsProvider',
        '$httpProvider',
        '$translateProvider'
    ];

    function config($stateProvider, lockProvider, $urlRouterProvider, jwtOptionsProvider, $httpProvider, $translateProvider) {

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
                    DEPLOYMENT : '<%= DEPLOYMENT %>'
                }
            })
            .state('signup', {
                url: '/signup',
                controller: 'SignupController',
                templateUrl: 'static/components-<%= VERSION %>/signup/signup.html',
                controllerAs: 'vm',
                params: {
                    DEPLOYMENT : '<%= DEPLOYMENT %>'
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
            .state('apikeysguide', {
                url: '/apikeys-guide',
                templateUrl: 'static/components-<%= VERSION %>/apikeysguide/guide.html'
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
                controllerAs: 'vm'
            })
            .state('teacher_restrictions', {
                url: '/teacher/restrictions',
                controller: 'TeacherRestrictionsController',
                templateUrl: 'static/components-<%= VERSION %>/teacher_restrictions/teacher_restrictions.html',
                controllerAs: 'vm',
                params: {
                    VERSION : <%= VERSION %>
                }
            })
            .state('teacher_apikeys', {
                url: '/teacher/apikeys',
                controller: 'TeacherApiKeysController',
                templateUrl: 'static/components-<%= VERSION %>/teacher_apikeys/teacher_apikeys.html',
                controllerAs: 'vm',
                params: {
                    VERSION : <%= VERSION %>
                }
            })
            .state('teacher_students', {
                url: '/teacher/students',
                controller: 'TeacherStudentsController',
                templateUrl: 'static/components-<%= VERSION %>/teacher_students/teacher_students.html',
                controllerAs: 'vm',
                params: {
                    VERSION : <%= VERSION %>
                }
            })
            .state('teacher_supervision', {
                url: '/teacher/projects',
                controller: 'TeacherProjectsController',
                templateUrl: 'static/components-<%= VERSION %>/teacher_supervision/teacher_supervision.html',
                controllerAs: 'vm'
            })
            .state('newproject', {
                url: '/newproject',
                controller: 'NewProjectController',
                templateUrl: 'static/components-<%= VERSION %>/newproject/newproject.html',
                controllerAs: 'vm'
            })
            .state('importdataset', {
                url: '/importdataset',
                controller: 'DatasetsController',
                templateUrl: 'static/components-<%= VERSION %>/datasets/datasets.html',
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
            .state('mlproject_model_describe', {
                url: '/mlproject/:userId/:projectId/models/:modelId',
                controller: 'ModelDescribeController',
                templateUrl: 'static/components-<%= VERSION %>/describemodel/describemodel.html',
                controllerAs: 'vm',
                params: {
                    VERSION : <%= VERSION %>
                }
            })
            .state('mlproject_makes', {
                url: '/mlproject/:userId/:projectId/makes',
                controller: 'MakesController',
                templateUrl: 'static/components-<%= VERSION %>/makes/makes.html',
                controllerAs: 'vm'
            })
            .state('mlproject_scratch', {
                url: '/mlproject/:userId/:projectId/scratch',
                controller: 'ScratchController',
                templateUrl: 'static/components-<%= VERSION %>/scratch/scratch.html',
                controllerAs: 'vm'
            })
            .state('mlproject_scratch3', {
                url: '/mlproject/:userId/:projectId/scratch3',
                controller: 'Scratch3Controller',
                templateUrl: 'static/components-<%= VERSION %>/scratch3/scratch3.html',
                controllerAs: 'vm'
            })
            .state('mlproject_python', {
                url: '/mlproject/:userId/:projectId/python',
                controller: 'PythonController',
                templateUrl: 'static/components-<%= VERSION %>/python/python.html',
                controllerAs: 'vm'
            })
            .state('mlproject_appinventor', {
                url: '/mlproject/:userId/:projectId/appinventor',
                controller: 'AppInventorController',
                templateUrl: 'static/components-<%= VERSION %>/appinventor/appinventor.html',
                controllerAs: 'vm'
            })
            .state('links', {
                url: '/links',
                templateUrl: 'static/components-<%= VERSION %>/links/links.html#top'
            })
            .state('404', {
                url: '/404',
                templateUrl: 'static/components-<%= VERSION %>/404/404.html'
            })
            .state('siteadmin', {
                url: '/siteadmin',
                controller: 'AdminController',
                templateUrl: 'static/components-<%= VERSION %>/admin/admin.html',
                controllerAs: 'vm'
            });


        if (AUTH0_CLIENT_ID) {
            const lockProviderOptions = {
                clientID : AUTH0_CLIENT_ID,
                domain : AUTH0_CUSTOM_DOMAIN,
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
                        logo : 'static/images/mlforkids-logo.svg',
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
            };
            if (AUTH0_CDN_BASE) {
                lockProviderOptions.options.configurationBaseUrl = AUTH0_CDN_BASE;
            }

            lockProvider.init(lockProviderOptions);
        }



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
            unauthenticatedRedirector: ['authService', function (authService) {
                authService.handleUnauthenticated();
            }]
        });

        $httpProvider.interceptors.push('jwtInterceptor');

        $translateProvider
            .useSanitizeValueStrategy('sanitizeParameters')
            .useStaticFilesLoader({
                prefix: 'static/languages-<%= VERSION %>/',
                suffix: '.json'
            })
            .determinePreferredLanguage(function () {
                var lang = navigator.userLanguage || navigator.language;

                // if it is set via query, use that
                const queries = document.location.search.substr(1).split('&');
                for (var i = 0; i < queries.length; i++) {
                    var query = queries[0];
                    if (query.indexOf('lang=') === 0) {
                        lang = query.substr('lang='.length);
                        break;
                    }
                }

                lang = lang.toLowerCase();

                // shorten en-XX to en
                if (lang.indexOf('en') === 0) {
                    lang = 'en';
                }
                else if (lang.indexOf('es') === 0) {
                    lang = 'es';
                }
                else if (lang.indexOf('zh') === 0) {
                    if (lang.indexOf('zh-tw') === 0) {
                        lang = 'zh-tw';
                    }
                    else {
                        lang = 'zh-cn';
                    }
                }
                else if (lang.indexOf('fr') === 0) {
                    lang = 'fr';
                }
                else if (lang.indexOf('ko') === 0) {
                    lang = 'ko';
                }
                else if (lang.indexOf('nl') === 0) {
                    lang = 'nl-be';
                }
                else if (lang.indexOf('ja') === 0) {
                    lang = 'ja';
                }
                else if (lang.indexOf('el') === 0) {
                    lang = 'el';
                }
                else if (lang.indexOf('it') === 0) {
                    lang = 'it';
                }
                else if (lang.indexOf('cs') === 0) {
                    lang = 'cs';
                }
                else if (lang.indexOf('ar') === 0) {
                    lang = 'ar';
                }
                else if (lang.indexOf('hr') === 0) {
                    lang = 'hr';
                }
                else if (lang.indexOf('pl') === 0) {
                    lang = 'pl';
                }
                else if (lang.indexOf('ru') === 0) {
                    lang = 'ru';
                }

                return lang;
            })
            .fallbackLanguage('en');
    }
})();
