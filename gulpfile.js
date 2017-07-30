const gulp = require('gulp');
const bower = require('gulp-bower');
const istanbul = require('gulp-istanbul');
const mocha = require('gulp-mocha');
const eslint = require('gulp-eslint');
const tslint = require('gulp-tslint');
const ts = require('gulp-typescript');
const cleanCSS = require('gulp-clean-css');
const concat = require('gulp-concat');
const minify = require('gulp-minify');
const template = require('gulp-template');
const autoprefixer = require('gulp-autoprefixer');
const rename = require('gulp-rename');
const ngAnnotate = require('gulp-ng-annotate');
const sequence = require('gulp-sequence');
const del = require('del');


// something unique to protect against problems from browsers
//  caching old versions of JS
const now = new Date();
const VERSION = now.getTime();


const paths = {
    json : ['src/**/*.json'],
    ts : ['src/**/*.ts'],
    tstest : ['src/tests/**/*.ts'],
    js : ['dist/**/*.js'],
    jslib : [
        'dist/lib/**/*.js', '!dist/lib/app.js',

        // files with type definitions only - not testable
        '!dist/lib/**/*-types.js',
    ],
    jstest : ['dist/tests/**/*.js'],
    css : ['public/app.css', 'public/components/**/*.css'],
    webjs : [
        'public/app.run.js',
        'public/components/**/*.js',
    ]
};



gulp.task('clean', () => {
    const tsProject = ts.createProject('tsconfig.json');
    const target = tsProject.config.compilerOptions.outDir;
    return del([target, './web']);
});

gulp.task('bower', function() {
    return bower({ cwd : './public', directory : '../web/static/bower_components' });
});

gulp.task('crossdomain', function() {
    return gulp.src('public/crossdomain.xml').pipe(gulp.dest('web/dynamic'));
});

gulp.task('scratchxinstall', ['crossdomain'], function() {
    return gulp.src('public/scratchx/**').pipe(gulp.dest('web/scratchx'));
});

gulp.task('compile', () => {
    let errors = false;

    const tsProject = ts.createProject('tsconfig.json');
    const target = tsProject.config.compilerOptions.outDir;

    const tsResult = tsProject.src()
        .pipe(tsProject())
        .on('error', () => { errors = true; });
    return tsResult.js
        .pipe(gulp.dest(target))
        .on('finish', () => { errors && process.exit(1); });
});

gulp.task('css', ['html'], () => {
    return gulp.src(paths.css)
            .pipe(cleanCSS())
            .pipe(autoprefixer())
            .pipe(concat('style-' + VERSION + '.min.css'))
            .pipe(gulp.dest('web/static'));
});

gulp.task('jsapp', () => {
    return gulp.src('public/app.js')
            .pipe(template({ VERSION }))
            .pipe(rename('app-' + VERSION + '.js'))
            .pipe(gulp.dest('web/static'));
});

gulp.task('angularcomponents', ['jsapp'], () => {
    return gulp.src('public/components/**')
            .pipe(gulp.dest('web/static/components-' + VERSION));
});

gulp.task('images', () => {
    return gulp.src('public/images/*').pipe(gulp.dest('web/static/images'));
});

function concatAndMinifiyWebJs (isForProd) {
    const webJsWithAuth = (isForProd ? [ 'public/auth0-prod-variables.js' ] : [ 'public/auth0-variables.js']).concat(paths.webjs);

    return gulp.src(webJsWithAuth)
            .pipe(ngAnnotate())
            .pipe(concat('mlapp.js'))
            .pipe(minify({ ext : { min : '-' + VERSION + '.min.js' }}))
            .pipe(gulp.dest('web/static'));
}

gulp.task('minifyjs', () => {
    return concatAndMinifiyWebJs(false);
});
gulp.task('minifyprodjs', () => {
    return concatAndMinifiyWebJs(true);
});

function prepareHtml (isForProd) {
    const options = { VERSION };
    if (isForProd) {
        options.BEFORE_ANALYTICS = '         ';
        options.AFTER_ANALYTICS = '          ';
    }
    else {
        options.BEFORE_ANALYTICS = '<!--';
        options.AFTER_ANALYTICS = '-->';
    }

    return gulp.src('public/index.html')
            .pipe(template(options))
            .pipe(gulp.dest('web/dynamic'));
}

gulp.task('html', () => {
    return prepareHtml(false);
});
gulp.task('prodhtml', () => {
    return prepareHtml(true);
});


gulp.task('tslint', () => {
    const tslintOptions = { formatter : 'verbose' };

    return gulp.src(paths.ts)
        .pipe(tslint(tslintOptions))
        .pipe(tslint.report());
});

gulp.task('eslint', ['compile'], () => {
    return gulp.src(paths.js)
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.task('lint', ['tslint', 'eslint']);

gulp.task('coverage', ['compile'], () => {
    return gulp.src(paths.jslib)
        .pipe(istanbul({ includeUntested : true }))
        .pipe(istanbul.hookRequire());
});

gulp.task('test', ['coverage'], () => {
    const mochaOptions = {
        reporter : 'spec',
        timeout : 60000,
        bail : true
    };

    const istanbulOptions = {
        dir : 'coverage/mocha'
    };

    const coverageOptions = { thresholds : { global : 90 }};

    return gulp.src(paths.jstest)
        .pipe(mocha(mochaOptions))
        .pipe(istanbul.writeReports(istanbulOptions))
        .pipe(istanbul.enforceThresholds(coverageOptions));
});

gulp.task('web', ['css', 'minifyjs', 'images', 'html', 'angularcomponents', 'scratchxinstall']);
gulp.task('build', ['web', 'compile']);

gulp.task('default', sequence('build', 'lint', 'test'));


gulp.task('buildprod', sequence(
    'clean',
    'bower',
    ['css', 'minifyprodjs', 'images', 'prodhtml', 'angularcomponents', 'scratchxinstall'],
    'compile',
    'lint'));
