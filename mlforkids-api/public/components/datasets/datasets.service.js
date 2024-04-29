(function () {

    angular
        .module('app')
        .service('datasetsService', datasetsService);

    datasetsService.$inject = [
        '$http', 'browserStorageService'
    ];

    function datasetsService($http, browserStorageService) {

        function getDataset(type, id) {
            const url = '/static/datasets/' + type + '/' + id + '.json';
            return $http.get(url)
                .then((resp) => {
                    return resp.data;
                })
                .then((dataset) => {
                    const trainingdata = [];
                    const labels = Object.keys(dataset.data);
                    if (type === 'imgtfjs') {
                        for (const rawlabel of labels) {
                            const label = browserStorageService.sanitizeLabel(rawlabel);
                            dataset.data[rawlabel].forEach((imageurl) => {
                                trainingdata.push({ imageurl, label });
                            });
                        }
                    }
                    else if (type === 'text') {
                        for (const rawlabel of labels) {
                            const label = browserStorageService.sanitizeLabel(rawlabel);
                            dataset.data[rawlabel].forEach((textdata) => {
                                trainingdata.push({ textdata, label });
                            });
                        }
                    }
                    else if (type === 'numbers') {
                        const fieldnames = dataset.metadata.fields.map(field => field.name);
                        for (const rawlabel of labels) {
                            const label = browserStorageService.sanitizeLabel(rawlabel);
                            if (dataset.data[rawlabel].length > 0) {
                                trainingdata.push({
                                    label,
                                    numbers : dataset.data[rawlabel].map((values) => {
                                        const value = {};
                                        fieldnames.forEach((fieldname, idx) => {
                                            value[fieldname] = values[idx];
                                        });
                                        return value;
                                    })
                                });
                            }
                        }
                    }
                    return {
                        language : dataset.metadata.language,
                        fields : dataset.metadata.fields,
                        trainingdata,
                        labels : labels.map(browserStorageService.sanitizeLabel)
                    };
                });
        }

        return {
            getDataset
        };
    }
})();