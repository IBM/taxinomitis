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

            'test/karma/fake-app-module.js',

            'public/components/projects/*.js',
            'public/components/newproject/*.js',
            'public/components/teacher_students/*.js',
            'public/components/utils/*.js',
            'public/third-party/webcam-directive/*.js',

            // loaded into $templateCache (via ngHtml2JsPreprocessor below) so
            // DOM-level tests can compile fragments of the *real* template
            // instead of a hand-copied - and driftable - duplicate of it
            'public/components/teacher_students/teacher_students.html'
        ],

        exclude : [],

        preprocessors : {
            'public/components/teacher_students/teacher_students.html' : ['ng-html2js']
        },

        ngHtml2JsPreprocessor : {
            moduleName : 'teacherStudentsTemplates'
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
