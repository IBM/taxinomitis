(function () {
    angular
        .module('app')
        .service('txtService', txtService);

    txtService.$inject = [
        'loggerService', 'readersService',
        '$q'
    ];

    function txtService(loggerService, readersService, $q) {

        function readFile(file) {
            loggerService.debug('[ml4ktxt] reading txt file', file.name);
            return $q((resolve, reject) => {
                try {
                    const reader = readersService.createFileReader();
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
                }
                catch (readerErr) {
                    loggerService.error('[ml4ktxt] FileReader not supported', readerErr);
                    reject(readerErr);
                }
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