(function () {
    angular
        .module('app')
        .service('csvService', csvService);

    csvService.$inject = [
        'utilService',
        'loggerService',
        '$q'
    ];

    function csvService(utilService, loggerService, $q) {

        function loadCsvParser() {
            return utilService.loadScript('/static/bower_components/papaparse/papaparse.min.js');
        }

        const CSV_PARSE_CONFIG = {
            // auto-detect delimiter
            delimiter: '',
            // header rows are required
            header: true,
            // attempt to cast numeric values
            dynamicTyping: true,
            // don't include empty rows in parsed output
            skipEmptyLines: true,
            // parse all rows
            preview: 0,
            // use a webworker to do the parsing so the UI doesn't freeze
            worker: true,
            // comments not supported
            comments: false
        };

        function parseFile(file) {
            return loadCsvParser()
                .then(function () {
                    loggerService.debug('[ml4kcsv] loading csv file');
                    return $q(function (resolve, reject) {
                        var config = Object.assign({
                            complete: resolve,
                            error: reject
                        }, CSV_PARSE_CONFIG);
                        Papa.parse(file, config);
                    });
                });
        }

        function exportFile(objects, columns) {
            return loadCsvParser()
                .then(function () {
                    loggerService.debug('[ml4kcsv] creating csv file');
                    return Papa.unparse(objects, { columns });
                });
        }

        return {
            parseFile,
            exportFile
        };
    }
})();