(function () {

    angular
        .module('app')
        .service('readersService', readersService);

    readersService.$inject = [];


    function readersService() {

        function createFileReader() {
            if (typeof FileReader === 'undefined') {
                throw new Error('File upload is not supported in this browser.');
            }
            return new FileReader();
        }

        return {
            createFileReader
        };
    }
})();
