// Exercises the real router, not a mocked $state.
//
// Cloning a project navigates from the projects page back to the projects
// page, with only the highlight id changing. That is a same-state transition,
// which nothing else in the app does - every other $state.go('projects', ...)
// comes from a different state - so it needs verifying against real ui-router
// rather than assumed to behave like the others.
describe('projects page navigation', function () {

    var $state, $rootScope, $stateParams, $compile;

    var instantiations;
    var uiview;

    beforeEach(function () {
        instantiations = [];

        // the fake app module used by the other specs has no router in it
        var testmodule = angular.module('projectsnavtest', ['ui.router']);

        testmodule.config(['$stateProvider', '$urlRouterProvider',
            function ($stateProvider, $urlRouterProvider) {
                $urlRouterProvider.otherwise('/');

                // matches the real declaration in public/app.js - note that
                //  'id' is NOT part of the url
                $stateProvider
                    .state('home', {
                        url : '/',
                        template : '<div>home</div>'
                    })
                    .state('projects', {
                        url : '/projects',
                        template : '<div>projects</div>',
                        controller : 'FakeProjectsController',
                        params : {
                            id : null
                        }
                    });
            }]);

        testmodule.controller('FakeProjectsController', ['$stateParams', function (sp) {
            // this is what ProjectsController does - reads the highlight id
            //  once, at construction
            instantiations.push(sp.id);
        }]);

        module('projectsnavtest');

        inject(function (_$state_, _$rootScope_, _$stateParams_, _$compile_) {
            $state = _$state_;
            $rootScope = _$rootScope_;
            $stateParams = _$stateParams_;
            $compile = _$compile_;
        });

        // a state's controller is only constructed when its template is
        //  rendered into a ui-view, so the transition alone proves nothing
        uiview = $compile('<div ui-view></div>')($rootScope.$new());
        $rootScope.$digest();
    });

    afterEach(function () {
        uiview.remove();
    });


    it('re-creates the controller when only the highlight id changes', function () {
        $state.go('projects');
        $rootScope.$digest();

        expect(instantiations.length).toBe(1);
        expect(instantiations[0]).toBe(null);

        // this is what happens after a clone
        $state.go('projects', { id : 12 });
        $rootScope.$digest();

        expect(instantiations.length).toBe(2);
        expect(instantiations[1]).toBe(12);
    });


    it('exposes the new id on the global $stateParams', function () {
        $state.go('projects', { id : 12 });
        $rootScope.$digest();

        expect($stateParams.id).toBe(12);
    });


    it('keeps the id an integer, as local project ids are integers', function () {
        // a string id here would silently break the strict-equality highlight
        //  check in projects.html
        $state.go('projects', { id : 12 });
        $rootScope.$digest();

        expect(typeof $stateParams.id).toBe('number');
    });

});
