module.exports = function(grunt) {

    // something unique to protect against problems from browsers
    //  caching old versions of JS
    const now = new Date();
    const VERSION = now.getTime();


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
                    timeout : 20000
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
            datasets : {
                expand : true,
                cwd : 'public/datasets',
                src : '**',
                dest : 'web/datasets'
            },
            jsapp : {
                src : 'public/app.js',
                dest : 'web/static/app-' + VERSION + '.js',
                options : {
                    process : function (content, srcpath) {
                        return grunt.template.process(content, { data : { VERSION }})
                    }
                }
            },
            components : {
                expand : true,
                cwd : 'public/components',
                src : '**',
                dest : 'web/static/components-' + VERSION,
                options : {
                    process : function (content, srcpath) {
                        return grunt.template.process(content, { data : { VERSION }})
                    }
                }
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
    // install Scratchx into the deployment
    grunt.registerTask('scratchx', ['copy:scratchx', 'copy:crossdomain']);
    // copy the datasets mini-site into the deployment
    grunt.registerTask('datasets', ['copy:datasets']);
    // copy the Twitter card into the deployment
    grunt.registerTask('twitter', ['copy:twittercard']);
    // minify the CSS
    grunt.registerTask('css', ['cssmin', 'postcss:dist']);
    // prepare the main app
    grunt.registerTask('uiapp', ['copy:jsapp', 'copy:components', 'copy:languages', 'copy:images']);



    //
    grunt.registerTask('frontendfiles', ['bower', 'scratchx', 'datasets', 'twitter']);

    grunt.registerTask('default', ['compile', 'test']);
};
