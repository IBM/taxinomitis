(function () {

    angular
        .module('app')
        .service('cleanupService', cleanupService);

    cleanupService.$inject = [
        'loggerService',
        'modelService',
        'storageService'
    ];


    function cleanupService(loggerService, modelService, storageService) {


        function deleteProject(project) {
            loggerService.debug('[ml4kstorage] cleaning up local storage for project', project);

            // clear up models stored on the browser
            if (project.type === 'sounds') {
                modelService.deleteModel('sounds', project.id);
            }
            else if (project.type === 'imgtfjs') {
                modelService.deleteModel('images', project.id);
            }
            else if (project.type === 'regression') {
                modelService.deleteModel('regression', project.id);
            }
            else if (project.type === 'numbers') {
                modelService.deleteModel('numbers', project.id);
            }
            // else if (project.type === 'language' && project.modeltype === 'toy') {
            //     browserStorageService.deleteAsset('language-model-' + project.id);
            // }

            // clear up any test data stored on the browser
            storageService.removeItem('testdata://' + project.id);
        }



        return {
            deleteProject
        };
    }
})();