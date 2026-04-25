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
            .state('mlproject_regression_model_describe', {
                url: '/mlproject/:userId/:projectId/models/regression/:modelId',
                controller: 'RegressionDescribeController',
                templateUrl: 'static/components/describeregression/describemodel.html',
                controllerAs: 'vm'
            })
            .state('mlproject_image_model_describe', {
                url: '/mlproject/:userId/:projectId/models/images/:modelId',
                controller: 'ImageDescribeController',
                templateUrl: 'static/components/describeimagemodel/describemodel.html',
                controllerAs: 'vm'
            })
            .state('mlproject_sound_model_describe', {
                url: '/mlproject/:userId/:projectId/models/sound/:modelId',
                controller: 'SoundDescribeController',
                templateUrl: 'static/components/describesoundmodel/describemodel.html',
                controllerAs: 'vm'
            })
            .state('mlproject_makes', {
                url: '/mlproject/:userId/:projectId/makes',
                controller: 'MakesController',
                templateUrl: 'static/components/makes/makes.html',
                controllerAs: 'vm'
            })
            .state('mlproject_scratch3', {
                url: '/mlproject/:userId/:projectId/scratch3',
                controller: 'Scratch3Controller',
                templateUrl: 'static/components/scratch3/scratch3.html',
                controllerAs: 'vm'
            })
            .state('mlproject_slm', {
                url: '/mlproject/:userId/:projectId/languagemodel',
                controller: 'LanguageModelController',
                templateUrl: 'static/components/languagemodel/languagemodel.html',
                controllerAs: 'vm'
            })
            .state('mlproject_colab', {
                url: '/mlproject/:userId/:projectId/colab',
                controller: 'ColabController',
                templateUrl: 'static/components/colab/colab.html',
                controllerAs: 'vm'
            })
            .state('mlproject_replit', {
                url: '/mlproject/:userId/:projectId/replit',
                controller: 'ReplitController',
                templateUrl: 'static/components/replit/replit.html',
                controllerAs: 'vm'
            })
            .state('mlproject_python_text', {
                url: '/mlproject/:userId/:projectId/pythontext',
                controller: 'PythonTextController',
                templateUrl: 'static/components/pythontext/pythontext.html',
                controllerAs: 'vm'
            })
            .state('mlproject_python_numbers', {
                url: '/mlproject/:userId/:projectId/pythonnumbers',
                controller: 'PythonNumbersController',
                templateUrl: 'static/components/pythonnumbers/pythonnumbers.html',
                controllerAs: 'vm'
            })
            .state('mlproject_python_images', {
                url: '/mlproject/:userId/:projectId/pythonimages',
                controller: 'PythonImagesController',
                templateUrl: 'static/components/pythonimages/pythonimages.html',
                controllerAs: 'vm'
            })
            .state('mlproject_edublocks', {
                url: '/mlproject/:userId/:projectId/edublocks',
                controller: 'EdublocksController',
                templateUrl: 'static/components/edublocks/edublocks.html',
                controllerAs: 'vm'
            })
            .state('mlproject_appinventor', {
                url: '/mlproject/:userId/:projectId/appinventor',
                controller: 'AppInventorController',
                templateUrl: 'static/components/appinventor/appinventor.html',
                controllerAs: 'vm'
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
            .state('resetstorage', {
                url: '/reset-storage',
                controller: 'ResetStorageController',
                templateUrl: 'static/components/resetstorage/resetstorage.html',
                controllerAs: 'vm'
            })
            .state('debugapis', {
                url: '/debug-apis',
                controller: 'DebugApisController',
                templateUrl: 'static/components/debugapi/debugapi.html',
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
            whiteListedDomains: AUTH0_WHITELISTED_DOMAINS,
            tokenGetter: ['options', 'storageService', function (options, storageService) {
                if (options && options.url.substring(options.url.length - 5) == '.html') {
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
                suffix: '.json?v=334'
            })
            .determinePreferredLanguage(function () {
                var lang = navigator.userLanguage || navigator.language;

                // if an override is set in a query parameter, use that instead
                const queries = document.location.search.substring(1).split('&');
                for (var i = 0; i < queries.length; i++) {
                    var query = queries[i];
                    if (query && query.indexOf('lang=') === 0) {
                        lang = query.substring('lang='.length);
                        break;
                    }
                }

                // default to English if not specified by either browser or query parameter
                if (!lang || lang.trim() === '') {
                    lang = 'en';
                }
                else {
                    lang = lang.toLowerCase().trim();

                    var normalizedLang = 'en';
                    // maps language prefixes to normalized codes
                    //  order matters: more specific variants must come before generic ones
                    var languageMap = {
                        'en': 'en',
                        'ar': 'ar',
                        'es': 'es',
                        'de': 'de',
                        'zh-tw': 'zh-tw',
                        'zh': 'zh-cn',
                        'tr': 'tr',
                        'it': 'it',
                        'pt-br': 'pt-br',
                        'pt': 'pt',
                        'fr': 'fr',
                        'ko': 'ko',
                        'nl': 'nl-be',
                        'ja': 'ja',
                        'el': 'el',
                        'cs': 'cs',
                        'hr': 'hr',
                        'pl': 'pl',
                        'ru': 'ru',
                        'ro': 'ro',
                        'hu': 'hu',
                        'uk': 'uk',
                        'vi': 'vi',
                        'cy': 'cy',
                        'fa': 'fa',
                        'hy': 'hy',
                        'sv': 'sv-se',
                        'si': 'si-lk'
                    };

                    for (var prefix in languageMap) {
                        if (lang.indexOf(prefix) === 0) {
                            normalizedLang = languageMap[prefix];
                            break;
                        }
                    }

                    lang = normalizedLang;
                }

                return lang;
            })
            .fallbackLanguage('en');
    }
})();
