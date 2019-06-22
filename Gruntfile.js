module.exports = function(grunt) {

    // something unique to protect against problems from browsers
    //  caching old versions of JS
    const now = new Date();
    const VERSION = now.getTime();

    const DEPLOYMENT = process.env.DEPLOYMENT ? process.env.DEPLOYMENT : '';
    let additionalVariables;
    if (process.env.DEPLOYMENT === 'machinelearningforkids.co.uk') {
        additionalVariables = 'auth0-variables.js';
    }
    else {
        additionalVariables = 'auth0-dev-variables.js';
    }


    grunt.initConfig({
        clean : {
            ts : ['./dist'],
            web : ['./web']
        },
        ts : {
            options : {
                fast : 'never'
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
                    timeout : 60000,
                    bail : true
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
                src : 'public/twitter-card.html',
                dest : 'web/dynamic/twitter-card.html'
            },
            crossdomain : {
                src : 'public/crossdomain.xml',
                dest : 'web/dynamic/crossdomain.xml'
            },
            scratchx : {
                expand : true,
                cwd : 'public/scratchx',
                src : '**',
                dest : 'web/scratchx'
            },
            scratchxhelp : {
                expand : true,
                cwd : 'public/components/help',
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
                cwd : 'public/components/help',
                src : ['help-scratch3*',
                       'help-scratch.css'],
                dest : 'web/scratch3'
            },
            datasets : {
                expand : true,
                cwd : 'public/datasets',
                src : '**',
                dest : 'web/datasets'
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
            }
        },
        concat : {
            jsapp : {
                src : [
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
        }
    });

    grunt.loadNpmTasks('gruntify-eslint');
    grunt.loadNpmTasks('grunt-ts');
    grunt.loadNpmTasks('grunt-tslint');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-simple-nyc');
    grunt.loadNpmTasks('grunt-bower-install-simple');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-postcss');




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
    // install Scratch into the deployment
    grunt.registerTask('scratch2', ['copy:scratchx', 'copy:scratchxhelp', 'copy:crossdomain']);
    grunt.registerTask('scratch3', ['copy:scratch3', 'copy:scratch3help']);
    grunt.registerTask('scratch', ['scratch2', 'scratch3']);
    // copy static resources into the deployment
    grunt.registerTask('datasets', ['copy:datasets']);
    grunt.registerTask('twitter', ['copy:twittercard']);
    grunt.registerTask('images', ['copy:images']);
    grunt.registerTask('staticfiles', ['datasets', 'twitter', 'images']);
    // minify the CSS
    grunt.registerTask('css', ['cssmin', 'postcss:dist']);
    // prepare the JavaScript
    grunt.registerTask('javascript', ['copy:jsapp', 'copy:apprunner', 'copy:languages']);
    // prepare the HTML
    grunt.registerTask('html', ['copy:indexhtml', 'copy:componentshtml']);
    // bring the UI together
    grunt.registerTask('ui', ['css', 'javascript', 'html', 'concat:jsapp']);
    // prepare the main web app
    grunt.registerTask('frontend', ['bower', 'scratch', 'staticfiles', 'ui']);



    // do everything - compile back-end code, test it, build the web site
    grunt.registerTask('default', ['compile', 'test', 'frontend']);
};
