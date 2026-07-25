module.exports = function (config) {
    config.set({
        basePath : '',
        frameworks : ['jasmine'],

        files : [
            // jQuery + Bootstrap must load before Angular, matching production
            // (public/index.html) - some regressions (e.g. the collapsible
            // group panels in teacher_students) only show up because of how
            // Bootstrap's real jQuery event delegation interacts with
            // Angular's DOM updates, and can't be caught with jqLite alone.
            'public/bower_components/jquery/dist/jquery.js',
            'public/bower_components/bootstrap/dist/js/bootstrap.js',

            'public/bower_components/angular/angular.js',
            'node_modules/angular-mocks/angular-mocks.js',

            // defines the global `Sentry` var (as `null`) that some controllers
            // reference directly - without this, referencing it in a test that
            // exercises a 500-status error path throws a ReferenceError
            'public/init.js',

            'test/karma/fake-app-module.js',

            'public/components/datasets/*.js',
            'public/components/languagemodel/*.js',
            'public/components/makes/*.js',
            'public/components/models/*.js',
            'public/components/newproject/*.js',
            'public/components/pretrained/*.js',
            'public/components/projects/*.js',
            'public/components/scratch3/*.js',
            'public/components/teacher_apikeys/*.js',
            'public/components/teacher_students/*.js',
            'public/components/training/*.js',
            'public/components/worksheets/*.js',
            'public/components/utils/*.js',
            'public/third-party/webcam-directive/*.js',

            // loaded into $templateCache (via ngHtml2JsPreprocessor below) so
            // DOM-level tests can compile fragments of the *real* template
            // instead of a hand-copied - and driftable - duplicate of it
            'public/components/teacher_students/teacher_students.html',
            'public/components/training/training.html'
        ],

        exclude : [],

        preprocessors : {
            'public/components/teacher_students/teacher_students.html' : ['ng-html2js'],
            'public/components/training/training.html' : ['ng-html2js']
        },

        ngHtml2JsPreprocessor : {
            moduleName : 'ml4kTemplates'
        },

        reporters : ['progress'],

        port : 9876,
        colors : true,
        logLevel : config.LOG_INFO,
        autoWatch : false,

        browsers : ['ChromeHeadless'],
        singleRun : true,
        concurrency : Infinity
    });
};
