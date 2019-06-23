const gulp = require('gulp');
const bower = require('gulp-bower');
const mocha = require('gulp-mocha');
const tslint = require('gulp-tslint');
const ts = require('gulp-typescript');
const cleanCSS = require('gulp-clean-css');
const concat = require('gulp-concat');
const minify = require('gulp-uglify');
const template = require('gulp-template');
const autoprefixer = require('gulp-autoprefixer');
const rename = require('gulp-rename');
const ngAnnotate = require('gulp-ng-annotate');
const sequence = require('gulp-sequence');
const sourcemaps = require('gulp-sourcemaps');
const del = require('del');


// something unique to protect against problems from browsers
//  caching old versions of JS
const now = new Date();
const VERSION = now.getTime();

const DEPLOYMENT = process.env.DEPLOYMENT;


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

gulp.task('twitter', function() {
    return gulp.src('public/twitter-card.html').pipe(gulp.dest('web/dynamic'));
});

gulp.task('crossdomain', function() {
    return gulp.src('public/crossdomain.xml').pipe(gulp.dest('web/dynamic'));
});

gulp.task('scratchxinstall', ['crossdomain'], function() {
    return gulp.src([
        'public/scratchx/**',
        'public/components/help/help-scratch2*',
        'public/components/help/help-scratch.css'
    ]).pipe(gulp.dest('web/scratchx'));
});

gulp.task('scratch3install', ['crossdomain'], function() {
    return gulp.src([
        'public/scratch3/**',
        'public/components/help/help-scratch3*',
        'public/components/help/help-scratch.css'
    ]).pipe(gulp.dest('web/scratch3'));
});

gulp.task('datasets', function() {
    return gulp.src('public/datasets/**').pipe(gulp.dest('web/datasets'));
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
            .pipe(template({ VERSION, DEPLOYMENT }))
            .pipe(rename('app-' + VERSION + '.js'))
            .pipe(gulp.dest('web/static'));
});

gulp.task('angularcomponents', ['jsapp'], () => {
    return gulp.src('public/components/**')
            .pipe(gulp.dest('web/static/components-' + VERSION));
});

gulp.task('languages', [], () => {
    return gulp.src('public/languages/**')
            .pipe(gulp.dest('web/static/languages-' + VERSION));
});

gulp.task('images', () => {
    return gulp.src('public/images/*').pipe(gulp.dest('web/static/images'));
});

function concatAndMinifiyWebJs (isForProd) {
    let additionalVariables;
    if (process.env.DEPLOYMENT === 'machinelearningforkids.co.uk') {
        if (isForProd) {
            additionalVariables = ['public/auth0-prod-variables.js'];
        }
        else {
            additionalVariables = ['public/auth0-variables.js'];
        }
    }
    else {
        additionalVariables = ['public/auth0-dev-variables.js'];
    }
    const webJsWithAuth = additionalVariables.concat(paths.webjs);

    return gulp.src(webJsWithAuth)
            .pipe(sourcemaps.init())
                .pipe(ngAnnotate())
                .pipe(concat('mlapp.js'))
                .pipe(minify())
                .pipe(rename({ extname : '-' + VERSION + '.min.js' }))
            .pipe(sourcemaps.write('.'))
            .pipe(gulp.dest('web/static'));
}

gulp.task('minifyjs', () => {
    return concatAndMinifiyWebJs(false);
});
gulp.task('minifyprodjs', () => {
    return concatAndMinifiyWebJs(true);
});

function prepareHtml (isForProd) {
    const options = { VERSION, DEPLOYMENT };
    if (isForProd) {
        options.USE_IN_PROD_ONLY = '         ';
        options.AFTER_USE_IN_PROD_ONLY = '          ';
    }
    else {
        options.USE_IN_PROD_ONLY = '<!--';
        options.AFTER_USE_IN_PROD_ONLY = '-->';
    }

    return gulp.src('public/index.html')
            .pipe(template(options))
            .pipe(gulp.dest('web/dynamic'));
}

gulp.task('html', () => {
    return prepareHtml(false);
});
gulp.task('prodhtml', ['twitter'], () => {
    return prepareHtml(true);
});


gulp.task('tslint', () => {
    const tslintOptions = { formatter : 'verbose' };

    return gulp.src(paths.ts)
        .pipe(tslint(tslintOptions))
        .pipe(tslint.report());
});

gulp.task('lint', ['tslint']);

gulp.task('test', () => {
    const mochaOptions = {
        reporter : 'spec',
        timeout : 60000
    };

    return gulp.src(paths.jstest)
        .pipe(mocha(mochaOptions));
});

gulp.task('web', ['css', 'minifyjs', 'images', 'html', 'angularcomponents', 'languages', 'datasets', 'scratchxinstall', 'scratch3install']);
gulp.task('build', ['web', 'compile']);

gulp.task('default', sequence('build', 'lint', 'test'));


gulp.task('buildprod', sequence(
    'clean',
    'bower',
    ['css', 'minifyprodjs', 'images', 'prodhtml', 'angularcomponents', 'languages', 'datasets', 'scratchxinstall', 'scratch3install'],
    'compile',
    'lint'));
