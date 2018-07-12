module.exports = function(grunt) {

    grunt.initConfig({
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
        }
    });

    grunt.loadNpmTasks('gruntify-eslint');
    grunt.loadNpmTasks('grunt-ts');
    grunt.loadNpmTasks('grunt-tslint');
    grunt.loadNpmTasks('grunt-mocha-test');

    grunt.registerTask('compile', ['ts', 'tslint:all', 'eslint']);
    grunt.registerTask('test', ['mochaTest']);


    grunt.registerTask('default', ['compile', 'test']);
};
