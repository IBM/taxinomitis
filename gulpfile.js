const gulp = require('gulp');
const bower = require('gulp-bower');
const istanbul = require('gulp-istanbul');
const mocha = require('gulp-mocha');
const eslint = require('gulp-eslint');
const tslint = require('gulp-tslint');
const ts = require('gulp-typescript');
const del = require('del');



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
    jstest : ['dist/tests/**/*.js']
};



gulp.task('clean', () => {
    const tsProject = ts.createProject('tsconfig.json');
    const target = tsProject.config.compilerOptions.outDir;
    return del([target]);
});

gulp.task('bower', function() {
    return bower({ cwd : './public' });
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
        timeout : 30000,
        bail : true
    };

    const istanbulOptions = {
        dir : 'coverage/mocha'
    };

    const coverageOptions = { thresholds : { global : 80 }};

    return gulp.src(paths.jstest)
        .pipe(mocha(mochaOptions))
        .pipe(istanbul.writeReports(istanbulOptions))
        .pipe(istanbul.enforceThresholds(coverageOptions));
});

gulp.task('build', ['clean', 'bower', 'compile']);
gulp.task('default', ['build', 'lint', 'test']);
