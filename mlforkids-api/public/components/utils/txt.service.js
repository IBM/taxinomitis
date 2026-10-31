(function () {
    angular
        .module('app')
        .service('txtService', txtService);

    txtService.$inject = [
        'loggerService', 'readersService', 'plainTextService',
        '$q'
    ];

    function txtService(loggerService, readersService, plainTextService, $q) {

        function readFile(file) {
            loggerService.debug('[ml4ktxt] reading txt file', file.name);
            return $q((resolve, reject) => {
                try {
                    const reader = readersService.createFileReader();
                    reader.onload = (evt) => {
                        if (!plainTextService.isPlainText(evt.target.result)) {
                            loggerService.error('[ml4ktxt] not a text file', file.name);
                            return reject(new Error(plainTextService.NOT_TEXT_FILE));
                        }
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
            NOT_TEXT_FILE : plainTextService.NOT_TEXT_FILE,
            getContents
        };
    }
})();