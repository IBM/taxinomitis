module.exports = function(grunt) {

    grunt.initConfig({
        eslint : {
            options : {
                configFile : './.eslintrc.json'
            },
            target : [ 'dist/**/*.js' ]
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
        }
    });

    grunt.loadNpmTasks('gruntify-eslint');
    grunt.loadNpmTasks('grunt-ts');
    grunt.loadNpmTasks('grunt-tslint');


    grunt.registerTask('compile', ['ts', 'tslint:all', 'eslint']);


    grunt.registerTask('default', ['compile']);
};
