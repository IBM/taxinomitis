module.exports = function(grunt) {

    // something unique to protect against problems from browsers
    //  caching old versions of JS
    const now = new Date();
    const VERSION = now.getTime();

    const DEPLOYMENT = process.env.DEPLOYMENT ? process.env.DEPLOYMENT : '';
    let additionalVariables;
    if (process.env.DEPLOYMENT === 'machinelearningforkids.co.uk') {
        // uses dev/staging auth0 environment
        additionalVariables = 'auth0-variables.js';
    }
    else {
        // disables auth0 integration
        additionalVariables = 'auth0-dev-variables.js';
    }


    // ----

    const mlModelFilesToDownload = {
        './speech-commands/metadata.json' : 'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/metadata.json',
        './speech-commands/model.json' : 'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/model.json',
        './speech-commands/group1-shard1of2' : 'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/group1-shard1of2',
        './speech-commands/group1-shard2of2' : 'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/group1-shard2of2',
        './posenet/model-multiplier75-stride16.json' : 'https://storage.googleapis.com/tfjs-models/savedmodel/posenet/mobilenet/float/075/model-stride16.json',
        './posenet/group1-shard1of2.bin' : 'https://storage.googleapis.com/tfjs-models/savedmodel/posenet/mobilenet/float/075/group1-shard1of2.bin',
        './posenet/group1-shard2of2.bin' : 'https://storage.googleapis.com/tfjs-models/savedmodel/posenet/mobilenet/float/075/group1-shard2of2.bin',
        './image-recognition/model.json' : 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json',
    };
    for (var x = 1; x <= 55; x++) {
        const filename = 'group' + x + '-shard1of1';
        mlModelFilesToDownload['./image-recognition/' + filename] = 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/' + filename;
    }

    // ----

    grunt.initConfig({
        clean : {
            ts : ['./dist'],
            web : ['./web']
        },
        ts : {
            options : {
                fast : 'never',
                additionalFlags: '--useUnknownInCatchVariables false'
            },
            default : {
                tsconfig : './tsconfig.json'
            }
        },
        tslint : {
            options : {
                configuration : './tslint.json',
                project : './tsconfig.json'
            },
            all : {
                src : [
                    'src/**/*.ts',
                    '!node_modules/**/*.ts'
                ]
            }
        },
        eslint : {
            options : {
                configFile : './.eslintrc.json'
            },
            target : [ 'dist/**/*.js' ]
        },
        mochaTest : {
            test : {
                options : {
                    timeout : 60000
                    // bail : true
                },
                src : ['dist/tests/**/*.js']
            }
        },
        nyc : {
            cover : {
                options : {
                    cwd : './dist',
                    include : ['lib/**'],
                    exclude : ['tests/**'],
                    reporter: ['lcov', 'text-summary'],
                    reportDir : '../coverage'
                },
                cmd : false,
                args : ['grunt', 'mochaTest']
            }
        },
        'bower-install-simple' : {
            options : {
                cwd : './public',
                directory : '../web/static/bower_components'
            },
            prod : {
                options : {
                    production : true
                }
            },
            dev : {
                options : {
                    production : false
                }
            }
        },
        copy : {
            twittercard : {
                src : 'public/static-files/twitter-card.html',
                dest : 'web/dynamic/twitter-card.html'
            },
            crossdomain : {
                src : 'public/static-files/crossdomain.xml',
                dest : 'web/dynamic/crossdomain.xml'
            },
            robotstxt : {
                expand : true,
                src : ['public/static-files/robots.txt',
                       'public/static-files/sitemap.xml' ],
                dest : 'web/dynamic'
            },
            scratchx : {
                expand : true,
                cwd : 'public/scratchx',
                src : '**',
                dest : 'web/scratchx'
            },
            scratchxhelp : {
                expand : true,
                cwd : 'public/scratch-components',
                src : ['help-scratch2*',
                       'help-scratch.css'],
                dest : 'web/scratchx'
            },
            scratch3 : {
                expand : true,
                cwd : 'public/scratch3',
                src : '**',
                dest : 'web/scratch3'
            },
            scratch3help : {
                expand : true,
                cwd : 'public/scratch-components',
                src : ['help-scratch3*',
                       'help-scratch.css',
                       'teachablemachinepose.html'],
                dest : 'web/scratch3'
            },
            indexhtml : {
                src : 'public/index.html',
                dest : 'web/dynamic/index.html',
                options : {
                    process : function (content) {
                        return grunt.template.process(content, { data : {
                            VERSION, DEPLOYMENT,
                            USE_IN_PROD_ONLY : '<!--', AFTER_USE_IN_PROD_ONLY : '-->'
                        }});
                    }
                }
            },
            jsapp : {
                src : 'public/app.js',
                dest : 'web/static/app-' + VERSION + '.js',
                options : {
                    process : function (content, srcpath) {
                        return grunt.template.process(content, { data : { VERSION, DEPLOYMENT }})
                    }
                }
            },
            scratchblocks : {
                src : 'public/third-party/scratchblocks-v3.1-min.js',
                dest : 'web/static/scratchblocks-v3.1-min.js'
            },
            apprunner : {
                expand : true,
                cwd : 'public/',
                src : [additionalVariables, 'app.run.js'],
                dest : 'web/static/components-' + VERSION,
                options : {
                    process : function (content, srcpath) {
                        return grunt.template.process(content, { data : { VERSION, DEPLOYMENT }})
                    }
                }
            },
            componentshtml : {
                expand : true,
                cwd : 'public/components',
                src : ['**/*.html'],
                dest : 'web/static/components-' + VERSION
            },
            languages : {
                expand : true,
                cwd : 'public/languages',
                src : '**',
                dest : 'web/static/languages-' + VERSION
            },
            images : {
                expand : true,
                cwd : 'public/images',
                src : '**',
                dest : 'web/static/images'
            },
            tensorflowjs : {
                expand : true,
                cwd : 'node_modules/@tensorflow/tfjs/dist',
                src : [ 'tf.min.js', 'tf.min.js.map' ],
                dest : 'web/static/bower_components/tensorflowjs'
            },
            tensorflowspeechcommands : {
                expand : true,
                cwd : 'node_modules/@tensorflow-models/speech-commands/dist',
                src : [ 'speech-commands.min.js' ],
                dest : 'web/static/bower_components/tensorflow-models/speech-commands'
            },
            tensorflowposenet : {
                expand : true,
                cwd : 'node_modules/@tensorflow-models/posenet/dist',
                src : [ 'posenet.min.js' ],
                dest : 'web/static/bower_components/tensorflow-models/posenet'
            },
            tensorflowhandpose : {
                expand : true,
                cwd : 'node_modules/@tensorflow-models/handpose/dist',
                src : [ 'handpose.min.js' ],
                dest : 'web/static/bower_components/tensorflow-models/handpose'
            },
            tensorflowfacelandmarks : {
                expand : true,
                cwd : 'node_modules/@tensorflow-models/face-landmarks-detection/dist',
                src : [ 'face-landmarks-detection.min.js' ],
                dest : 'web/static/bower_components/tensorflow-models/face-landmarks-detection'
            },
            angularmaterial : {
                expand : true,
                cwd : 'public/third-party/angular-material',
                src : [ 'angular-material.theme.min.css' ],
                dest : 'web/static/bower_components/angular-material'
            }
        },
        downloadfile : {
            options : {
                dest : './web/static/bower_components/tensorflow-models',
                overwriteEverytime : false
            },
            files: mlModelFilesToDownload
        },
        concat : {
            jsapp : {
                src : [
                    'public/init.js',
                    'public/app.run.js',
                    'public/' + additionalVariables,
                    'public/components/**/*.js'
                ],
                dest : 'web/static/mlapp-' + VERSION + '.min.js'
            }
        },
        cssmin : {
            target : {
                files : [
                    {
                        src : ['public/app.css', 'public/components/**/*.css'],
                        dest : 'web/static/style-' + VERSION + '.min.css'
                    }
                ]
            }
        },
        postcss : {
            options : {
                map : false,
                processors: [
                    require('autoprefixer')
                ]
            },
            dist : {
                src : 'web/static/style*css'
            }
        },
        mkdir : {
            tfjsmodels : {
                options : {
                    create : [ './web/static/bower_components/tensorflow-models/image-recognition' ]
                }
            }
        }
    });

    grunt.loadNpmTasks('gruntify-eslint');
    grunt.loadNpmTasks('grunt-ts');
    grunt.loadNpmTasks('grunt-tslint');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-simple-nyc');
    grunt.loadNpmTasks('grunt-bower-install-simple');
    grunt.loadNpmTasks('grunt-downloadfile');
    grunt.loadNpmTasks('grunt-mkdir');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('@lodder/grunt-postcss');




    //-----------------------------------
    // back-end tasks
    //-----------------------------------
    // compile the typescript code and run the linter
    grunt.registerTask('compile', ['ts', 'tslint:all', 'eslint']);
    // run the back-end unit and integration tests, with coverage
    grunt.registerTask('test', ['nyc:cover']);


    //-----------------------------------
    // front-end tasks
    //-----------------------------------
    // fetch UI third-party dependencies
    grunt.registerTask('bower', ['bower-install-simple']);
    grunt.registerTask('tfjs', ['mkdir:tfjsmodels', 'copy:tensorflowjs', 'copy:tensorflowspeechcommands', 'copy:tensorflowposenet', 'copy:tensorflowhandpose', 'copy:tensorflowfacelandmarks', 'downloadfile']);
    grunt.registerTask('boweroverrides', ['copy:angularmaterial']);
    grunt.registerTask('uidependencies', ['bower', 'tfjs', 'boweroverrides']);
    // install Scratch into the deployment
    grunt.registerTask('scratch2', ['copy:scratchx', 'copy:scratchxhelp', 'copy:crossdomain']);
    grunt.registerTask('scratch3', ['copy:scratch3', 'copy:scratch3help']);
    grunt.registerTask('scratch', ['scratch2', 'scratch3']);
    // copy static resources into the deployment
    grunt.registerTask('twitter', ['copy:twittercard']);
    grunt.registerTask('images', ['copy:images']);
    grunt.registerTask('robotstxt', ['copy:robotstxt']);
    grunt.registerTask('staticfiles', ['twitter', 'images', 'robotstxt']);
    // minify the CSS
    grunt.registerTask('css', ['cssmin', 'postcss:dist']);
    // prepare the JavaScript
    grunt.registerTask('javascript', ['copy:jsapp', 'copy:apprunner', 'copy:languages', 'copy:scratchblocks']);
    // prepare the HTML
    grunt.registerTask('html', ['copy:indexhtml', 'copy:componentshtml']);
    // bring the UI together
    grunt.registerTask('ui', ['css', 'javascript', 'html', 'concat:jsapp']);
    // prepare the main web app
    grunt.registerTask('frontend', ['uidependencies', 'scratch', 'staticfiles', 'ui']);



    // do everything - compile back-end code, test it, build the web site
    grunt.registerTask('default', ['compile', 'test', 'frontend']);
};
