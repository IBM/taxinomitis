(function () {

    angular
        .module('app', ['ngMaterial', 'ngMessages', 'ngSanitize', 'auth0.lock', 'angular-jwt', 'ui.router', 'duScroll', 'webcam', 'pascalprecht.translate', 'yaru22.angular-timeago'])
        .config(config);

    config.$inject = [
        '$stateProvider',
        'lockProvider',
        '$urlRouterProvider',
        'jwtOptionsProvider',
        '$httpProvider',
        '$translateProvider',
        '$mdThemingProvider'
    ];

    function config($stateProvider, lockProvider, $urlRouterProvider, jwtOptionsProvider, $httpProvider, $translateProvider, $mdThemingProvider) {

        // theme has been hard-coded in the angular-material folder, so
        //  no need to dynamically generate the theme CSS and add it to
        //  the page head
        $mdThemingProvider.disableTheming();

        $stateProvider
            .state('home', {
                url: '',
                templateUrl: 'static/components/welcome/welcome.html'
            })
            .state('welcome', {
                url: '/welcome',
                templateUrl: 'static/components/welcome/welcome.html'
            })
            .state('login', {
                url: '/login',
                controller: 'LoginController',
                templateUrl: 'static/components/login/login.html',
                controllerAs: 'vm',
                params: {
                    DEPLOYMENT : '<%= DEPLOYMENT %>'
                }
            })
            .state('signup', {
                url: '/signup',
                controller: 'SignupController',
                templateUrl: 'static/components/signup/signup.html',
                controllerAs: 'vm',
                params: {
                    DEPLOYMENT : '<%= DEPLOYMENT %>'
                }
            })
            .state('about', {
                url: '/about',
                templateUrl: 'static/components/about/about.html'
            })
            .state('news', {
                url: '/news',
                templateUrl: 'static/components/news/news.html'
            })
            .state('help', {
                url: '/help',
                templateUrl: 'static/components/help/help.html'
            })
            .state('apikeysguide', {
                url: '/apikeys-guide',
                templateUrl: 'static/components/apikeysguide/guide.html'
            })
            .state('worksheets', {
                url: '/worksheets',
                controller: 'WorksheetsController',
                templateUrl: 'static/components/worksheets/worksheets.html',
                controllerAs: 'vm'
            })
            .state('teacher', {
                url: '/teacher',
                controller: 'TeacherController',
                templateUrl: 'static/components/teacher/teacher.html',
                controllerAs: 'vm'
            })
            .state('teacher_restrictions', {
                url: '/teacher/restrictions',
                controller: 'TeacherRestrictionsController',
                templateUrl: 'static/components/teacher_restrictions/teacher_restrictions.html',
                controllerAs: 'vm'
            })
            .state('teacher_apikeys', {
                url: '/teacher/apikeys',
                controller: 'TeacherApiKeysController',
                templateUrl: 'static/components/teacher_apikeys/teacher_apikeys.html',
                controllerAs: 'vm'
            })
            .state('teacher_students', {
                url: '/teacher/students',
                controller: 'TeacherStudentsController',
                templateUrl: 'static/components/teacher_students/teacher_students.html',
                controllerAs: 'vm'
            })
            .state('teacher_supervision', {
                url: '/teacher/projects',
                controller: 'TeacherProjectsController',
                templateUrl: 'static/components/teacher_supervision/teacher_supervision.html',
                controllerAs: 'vm'
            })
            .state('teacher_review_training', {
                url: '/teacher/projects/:userId/:projectId/training',
                controller: 'TrainingController',
                templateUrl: 'static/components/training/training.html',
                controllerAs: 'vm',
                params: {
                    review: true
                }
            })
            .state('newproject', {
                url: '/newproject',
                controller: 'NewProjectController',
                templateUrl: 'static/components/newproject/newproject.html',
                controllerAs: 'vm'
            })
            .state('importdataset', {
                url: '/importdataset',
                controller: 'DatasetsController',
                templateUrl: 'static/components/datasets/datasets.html',
                controllerAs: 'vm'
            })
            .state('projects', {
                url: '/projects',
                controller: 'ProjectsController',
                templateUrl: 'static/components/projects/projects.html',
                controllerAs: 'vm',
                params: {
                    id: null
                }
            })
            .state('mlproject', {
                url: '/mlproject/:userId/:projectId',
                controller: 'ProjectController',
                templateUrl: 'static/components/mlproject/mlproject.html',
                controllerAs: 'vm'
            })
            .state('mlproject_training', {
                url: '/mlproject/:userId/:projectId/training',
                controller: 'TrainingController',
                templateUrl: 'static/components/training/training.html',
                controllerAs: 'vm',
                params: {
                    review: false
                }
            })
            .state('mlproject_models', {
                url: '/mlproject/:userId/:projectId/models',
                controller: 'ModelsController',
                templateUrl: 'static/components/models/models.html',
                controllerAs: 'vm'
            })
            .state('mlproject_model_describe', {
                url: '/mlproject/:userId/:projectId/models/:modelId',
                controller: 'ModelDescribeController',
                templateUrl: 'static/components/describemodel/describemodel.html',
                controllerAs: 'vm'
            })
            .state('mlproject_text_model_describe', {
                url: '/mlproject/:userId/:projectId/models/text/:modelId',
                controller: 'ModelTextDescribeController',
                templateUrl: 'static/components/describetextmodel/describemodel.html',
                controllerAs: 'vm'
            })
            .state('mlproject_makes', {
                url: '/mlproject/:userId/:projectId/makes',
                controller: 'MakesController',
                templateUrl: 'static/components/makes/makes.html',
                controllerAs: 'vm'
            })
            .state('mlproject_scratch', {
                url: '/mlproject/:userId/:projectId/scratch',
                controller: 'ScratchController',
                templateUrl: 'static/components/scratch/scratch.html',
                controllerAs: 'vm'
            })
            .state('mlproject_scratch3', {
                url: '/mlproject/:userId/:projectId/scratch3',
                controller: 'Scratch3Controller',
                templateUrl: 'static/components/scratch3/scratch3.html',
                controllerAs: 'vm'
            })
            .state('mlproject_python', {
                url: '/mlproject/:userId/:projectId/python',
                controller: 'PythonController',
                templateUrl: 'static/components/python/python.html',
                controllerAs: 'vm'
            })
            .state('mlproject_python_local', {
                url: '/mlproject/:userId/:projectId/pythonlocal',
                controller: 'PythonLocalController',
                templateUrl: 'static/components/pythonlocal/python.html',
                controllerAs: 'vm'
            })
            .state('mlproject_appinventor', {
                url: '/mlproject/:userId/:projectId/appinventor',
                controller: 'AppInventorController',
                templateUrl: 'static/components/appinventor/appinventor.html',
                controllerAs: 'vm'
            })
            .state('links', {
                url: '/links',
                templateUrl: 'static/components/links/links.html#top'
            })
            .state('stories', {
                url: '/stories/:storyId',
                controller: 'StoriesController',
                templateUrl: 'static/components/stories/stories.html'
            })
            .state('pretrained', {
                url: '/pretrained',
                controller: 'PretrainedController',
                templateUrl: 'static/components/pretrained/pretrained.html',
                controllerAs: 'vm'
            })
            .state('404', {
                url: '/404',
                templateUrl: 'static/components/404/404.html'
            })
            .state('siteadmin', {
                url: '/siteadmin',
                controller: 'AdminController',
                templateUrl: 'static/components/admin/admin.html',
                controllerAs: 'vm'
            })
            .state('book', {
                url: '/book',
                templateUrl: 'static/components/book/book.html',
            })
            .state('debug', {
                url: '/debug',
                templateUrl: 'static/components/debug/debug.html',
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
            tokenGetter: ['options', 'storageService', function (options, storageService) {
                if (options && options.url.substr(options.url.length - 5) == '.html') {
                    return null;
                }
                return storageService.getItem('id_token');
            }],
            unauthenticatedRedirector: ['authService', function (authService) {
                authService.handleUnauthenticated();
            }]
        });

        $httpProvider.interceptors.push('jwtInterceptor');

        $translateProvider
            .useSanitizeValueStrategy('sanitizeParameters')
            .useStaticFilesLoader({
                prefix: 'static/languages/',
                suffix: '.json?v=86'
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
                else if (lang.indexOf('de') === 0) {
                    lang = 'de';
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
                else if (lang.indexOf('ro') === 0) {
                    lang = 'ro';
                }
                else if (lang.trim() === '') {
                    lang = 'en';
                }

                return lang;
            })
            .fallbackLanguage('en');
    }
})();
