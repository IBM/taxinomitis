(function () {
    angular
        .module('app')
        .service('txtService', txtService);

    txtService.$inject = [
        'loggerService',
        '$q'
    ];

    function txtService(loggerService, $q) {

        function readFile(file) {
            loggerService.debug('[ml4ktxt] reading txt file', file.name);
            return $q((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    resolve({
                        type : 'text',
                        title : file.name,
                        contents : evt.target.result
                    });
                };
                reader.onerror = (err) => {
                    loggerService.error('[ml4ktxt] failed to read file', err);
                    reject(err);
                };
                reader.readAsText(file);
            });
        }

        function getContents(files) {
            loggerService.debug('[ml4ktxt] reading txt files', files.length);

            const fileReaderPromises = [];
            for (let idx = 0; idx < files.length; idx++) {
                const file = files[idx];
                fileReaderPromises.push(readFile(file));
            }
            return $q.all(fileReaderPromises);
        }

        return {
            getContents
        };
    }
})();