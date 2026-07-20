// Minimal stand-in for the real 'app' module (defined in public/app.js).
//
// The real module depends on ngMaterial, ui.router, pascalprecht.translate
// and other third-party libraries that would otherwise need to be loaded
// just to satisfy Angular's module registration - even though unit tests
// provide their own mocks for every service a controller injects.
//
// This file must be loaded (via karma.conf.js) before any component source
// files, since those files call angular.module('app').controller(...) etc.
// at load time and expect the module to already exist.
(function () {
    angular.module('app', []);
}());
