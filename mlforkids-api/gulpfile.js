const gulp = require('gulp');
const bower = require('gulp-bower');
const mocha = require('gulp-mocha');
const ts = require('gulp-typescript');
const cleanCSS = require('gulp-clean-css');
const concat = require('gulp-concat');
const minify = require('gulp-uglify');
const template = require('gulp-template');
const autoprefixer = require('gulp-autoprefixer');
const rename = require('gulp-rename');
const ngAnnotate = require('gulp-ng-annotate');
const sourcemaps = require('gulp-sourcemaps');
const download = require('gulp-download2');
const jsonminify = require('gulp-jsonminify');
const htmlminify = require('gulp-htmlmin');
const del = require('del');


const DEPLOYMENT = process.env.DEPLOYMENT;
console.log('Building for ' + DEPLOYMENT);

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
    html : ['public/components/**/*.html'],
    webjs : [
        'public/init.js',
        'public/app.run.js',
        'public/components/**/*.js',
    ]
};

const htmlMinifyOptions = {
    collapseWhitespace: true,
    conservativeCollapse: true,
    removeComments : true
};


gulp.task('clean', () => {
    const tsProject = ts.createProject('tsconfig.json');
    const target = tsProject.config.compilerOptions.outDir;
    return del([target, './web']);
});

gulp.task('bower', function() {
    return bower({ cwd : './public', directory : '../web/static/bower_components' });
});
gulp.task('custombootstrap', function() {
    return gulp.src('public/third-party/bootstrap/**')
                .pipe(gulp.dest('web/static/bower_components/bootstrap/dist'));
});
gulp.task('customangularmaterial', function() {
    return gulp.src('public/third-party/angular-material/*.css')
                .pipe(cleanCSS())
                .pipe(gulp.dest('web/static/bower_components/angular-material'));
});
gulp.task('boweroverrides', gulp.parallel('custombootstrap', 'customangularmaterial'));

gulp.task('twitter', function() {
    return gulp.src('public/static-files/twitter-card.html').pipe(gulp.dest('web/dynamic'));
});

gulp.task('tensorflowjs', function() {
    return gulp.src([
        'node_modules/@tensorflow/tfjs/dist/tf.min.js',
        'node_modules/@tensorflow/tfjs/dist/tf.min.js.map'
    ]).pipe(gulp.dest('web/static/bower_components/tensorflowjs'));
});
gulp.task('tensorflowposenet', function() {
    return gulp.src([
        'node_modules/@tensorflow-models/posenet/dist/posenet.min.js'
    ]).pipe(gulp.dest('web/static/bower_components/tensorflow-models/posenet'));
});
gulp.task('posenetmodel', function() {
    const files = [
        { url : 'https://storage.googleapis.com/tfjs-models/savedmodel/posenet/mobilenet/float/075/model-stride16.json', file : 'model-multiplier75-stride16.json' },
        { url : 'https://storage.googleapis.com/tfjs-models/savedmodel/posenet/mobilenet/float/075/group1-shard1of2.bin', file : 'group1-shard1of2.bin' },
        { url : 'https://storage.googleapis.com/tfjs-models/savedmodel/posenet/mobilenet/float/075/group1-shard2of2.bin', file : 'group1-shard2of2.bin' }
    ];
    return download(files)
        .pipe(gulp.dest('web/static/bower_components/tensorflow-models/posenet'));
});
gulp.task('tensorflowspeechcommands', function() {
    return gulp.src([
        'node_modules/@tensorflow-models/speech-commands/dist/speech-commands.min.js'
    ]).pipe(gulp.dest('web/static/bower_components/tensorflow-models/speech-commands'));
});
gulp.task('tensorflowspeechcommands-scratch', function() {
    return gulp.src([
        'node_modules/@tensorflow-models/speech-commands/dist/speech-commands.min.js'
    ]).pipe(gulp.dest('web/static/bower_components/tensorflow-models/speech-commands-scratch'));
});
gulp.task('speechcommandsmodel', function() {
    const files = [
        { url : 'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/metadata.json', file : 'metadata.json' },
        { url : 'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/model.json', file : 'model.json' },
        { url : 'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/group1-shard1of2', file : 'group1-shard1of2' },
        { url : 'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/group1-shard2of2', file : 'group1-shard2of2' }
    ];
    return download(files)
        .pipe(gulp.dest('web/static/bower_components/tensorflow-models/speech-commands'));
});
gulp.task('speechcommandsmodel-scratch', function() {
    const files = [
        { url : 'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/metadata.json', file : 'metadata.json' },
        { url : 'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/model.json', file : 'model.json' },
        { url : 'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/group1-shard1of2', file : 'group1-shard1of2' },
        { url : 'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/group1-shard2of2', file : 'group1-shard2of2' }
    ];
    return download(files)
        .pipe(gulp.dest('web/static/bower_components/tensorflow-models/speech-commands-scratch'));
});
gulp.task('tensorflowfacelandmarks', function() {
    return gulp.src([
        'node_modules/@tensorflow-models/face-landmarks-detection/dist/face-landmarks-detection.min.js'
    ]).pipe(gulp.dest('web/static/bower_components/tensorflow-models/face-landmarks-detection'));
});
gulp.task('tensorflowfacemesh', function() {
    return gulp.src([
        'node_modules/@mediapipe/face_mesh/*'
    ]).pipe(gulp.dest('web/static/bower_components/tensorflow-models/face-mesh'));
});

gulp.task('imagerecognitionmodel', function() {
    const files = [
        { url : 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json', file : 'model.json' }
    ];
    for (var x = 1; x <= 55; x++) {
        const filename = 'group' + x + '-shard1of1';
        files.push({
            url : 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/' + filename,
            file : filename
        });
    }
    return download(files)
        .pipe(gulp.dest('web/static/bower_components/tensorflow-models/image-recognition'));
});
gulp.task('imagerecognitionmodel-scratch', function() {
    const files = [
        { url : 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json', file : 'model.json' }
    ];
    for (var x = 1; x <= 55; x++) {
        const filename = 'group' + x + '-shard1of1';
        files.push({
            url : 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/' + filename,
            file : filename
        });
    }
    return download(files)
        .pipe(gulp.dest('web/static/bower_components/tensorflow-models/image-recognition-scratch'));
});

gulp.task('tensorflowhandposemodel', function() {
    return gulp.src([
        'node_modules/@tensorflow-models/handpose/dist/handpose.min.js'
    ]).pipe(gulp.dest('web/static/bower_components/tensorflow-models/handpose'));
});
gulp.task('tfjs',
    gulp.parallel('tensorflowjs',
        'tensorflowspeechcommands', 'tensorflowspeechcommands-scratch',
        'speechcommandsmodel', 'speechcommandsmodel-scratch',
        'tensorflowposenet', 'posenetmodel',
        'tensorflowfacelandmarks', 'tensorflowfacemesh',
        'tensorflowhandposemodel',
        'imagerecognitionmodel', 'imagerecognitionmodel-scratch'));

gulp.task('scratchblocks', function() {
    return gulp.src('public/third-party/scratchblocks-v3.1-min.js').pipe(gulp.dest('web/static'));
});

gulp.task('crossdomain', function() {
    return gulp.src('public/static-files/crossdomain.xml').pipe(gulp.dest('web/dynamic'));
});

gulp.task('robotstxt', function() {
    return gulp.src([
        'public/static-files/robots.txt',
        'public/static-files/sitemap.xml',
        'public/images/favicon.ico'
    ]).pipe(gulp.dest('web/dynamic'));
});

gulp.task('stories', function() {
    return gulp.src([
        'public/static-files/stories/*'
    ]).pipe(gulp.dest('web/static/stories'));
});

gulp.task('scratchxinstall', gulp.series('crossdomain', function() {
    return gulp.src([
        'public/scratchx/**',
        'public/scratch-components/help-scratch2*',
        'public/scratch-components/help-scratch.css'
    ]).pipe(gulp.dest('web/scratchx'));
}));

gulp.task('scratch3install', gulp.series('crossdomain', function() {
    return gulp.src([
        'public/scratch3/**',
        'public/scratch-components/help-scratch3*',
        'public/scratch-components/help-scratch.css',
        'public/scratch-components/teachablemachinepose.html'
    ]).pipe(gulp.dest('web/scratch3'));
}));

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



function prepareHtml (isForProd) {
    const options = { DEPLOYMENT };
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
            .pipe(htmlminify(htmlMinifyOptions))
            .pipe(gulp.dest('web/dynamic'));
}

gulp.task('html', () => {
    return prepareHtml(false);
});
gulp.task('prodhtml', gulp.series('twitter', () => {
    return prepareHtml(true);
}));


gulp.task('css', gulp.series('html', () => {
    return gulp.src(paths.css)
            .pipe(cleanCSS())
            .pipe(autoprefixer())
            .pipe(concat('style.min.css'))
            .pipe(gulp.dest('web/static'));
}));

gulp.task('jsapp', () => {
    return gulp.src('public/app.js')
            .pipe(template({ DEPLOYMENT }))
            .pipe(rename('app.js'))
            .pipe(gulp.dest('web/static'));
});

gulp.task('angularcomponents', gulp.series('jsapp', () => {
    return gulp.src(paths.html)
            .pipe(htmlminify(htmlMinifyOptions))
            .pipe(gulp.dest('web/static/components'));
}));

gulp.task('languages', () => {
    return gulp.src('public/languages/**')
        .pipe(gulp.dest('web/static/languages'));
});

gulp.task('prodlanguages', () => {
    return gulp.src('public/languages/**')
        .pipe(jsonminify())
        .pipe(gulp.dest('web/static/languages'));
});

gulp.task('images', () => {
    return gulp.src('public/images/*').pipe(gulp.dest('web/static/images'));
});

function concatAndMinifiyWebJs (isForProd) {
    let additionalVariables;
    if (process.env.DEPLOYMENT === 'machinelearningforkids.co.uk') {
        if (isForProd) {
            additionalVariables = [
                // google analytics support
                'public/prod-analytics.js',
                // sentry alerting support
                'public/prod-sentry.js',
                // uses prod auth0 environment
                'public/auth0-prod-variables.js'
            ];
        }
        else {
            // uses dev/staging auth0 environment
            additionalVariables = ['public/auth0-variables.js'];
        }
    }
    else {
        // disables auth0 integration
        additionalVariables = ['public/auth0-dev-variables.js'];
    }
    const webJsWithAuth = additionalVariables.concat(paths.webjs);

    return gulp.src(webJsWithAuth)
            .pipe(sourcemaps.init())
                .pipe(ngAnnotate())
                .pipe(concat('mlapp.js'))
                .pipe(minify())
                .pipe(rename({ extname : '.min.js' }))
            .pipe(sourcemaps.write('.'))
            .pipe(gulp.dest('web/static'));
}

gulp.task('minifyjs', () => {
    return concatAndMinifiyWebJs(false);
});
gulp.task('minifyprodjs', () => {
    return concatAndMinifiyWebJs(true);
});


gulp.task('test', () => {
    const mochaOptions = {
        reporter : 'spec',
        timeout : 60000
    };

    return gulp.src(paths.jstest)
        .pipe(mocha(mochaOptions));
});

gulp.task('scratch', gulp.parallel('scratchxinstall', 'scratch3install', 'scratchblocks'));

gulp.task('web',
    gulp.series(
        'css',
        'minifyjs',
        'images',
        'html',
        'angularcomponents',
        'prodlanguages'));

gulp.task('uidependencies',
    gulp.series('bower', 'tfjs', 'boweroverrides'));

gulp.task('build',
    gulp.parallel('web', 'compile'));

gulp.task('default', gulp.series('build', 'test'));


gulp.task('buildprod',
    gulp.series(
        'clean',
        'uidependencies',
        gulp.parallel(
            'robotstxt',
            'css',
            'minifyprodjs',
            'images',
            'prodhtml',
            'angularcomponents',
            'prodlanguages',
            'scratchblocks',
            'stories'),
        'compile'));
