(function () {

    angular
        .module('app')
        .service('modelService', modelService);

    modelService.$inject = [
    ];


    function modelService() {

        function allModelsAreTraining (models) {
            return models &&
                   models.length > 0 &&
                   !(models.some(function (model) { return model.status !== 'Training'; }));
        }
        function allModelsAreGood (models) {
            return models &&
                   models.length > 0 &&
                   !(models.some(function (model) { return model.status !== 'Available'; }));
        }

        function getStatus(models) {
            if (allModelsAreTraining(models)) {
                return 'training';
            }
            if (allModelsAreGood(models)) {
                return 'ready';
            }
            if (models.length === 0) {
                return 'idle';
            }
            return 'error';
        }


        function generateProjectSummary(labels) {
            if (labels.length > 0) {
                var summary = '';
                switch (labels.length) {
                    case 1:
                        summary = labels[0];
                        break;
                    case 2:
                        summary = labels[0] + ' or ' + labels[1];
                        break;
                    case 3:
                        summary = labels[0] + ', ' +
                                  labels[1] + ' or ' +
                                  labels[2];
                        break;
                    default:
                        summary = labels[0] + ', ' +
                                  labels[1] + ' or ' +
                                  (labels.length - 2) + ' other classes';
                        break;
                }
                return summary;
            }
        }



        function getMinimumTrainingItems(projectType) {
            if (projectType === 'images') {
                return 10;
            }
            else if (projectType === 'sounds') {
                return 8;
            }
            else {
                return 5;
            }
        }


        function reviewTrainingData(trainingDataCountsByLabel, projectType) {
            var no_data = true;
            var insufficient_data = 0;
            var MIN = getMinimumTrainingItems(projectType);

            var labelslist = Object.keys(trainingDataCountsByLabel);

            var trainingcounts = labelslist.map(function (label) {
                var count = trainingDataCountsByLabel[label];
                if (count > 0) {
                    no_data = false;
                }
                if (count < MIN) {
                    insufficient_data += 1;
                }
                return { label : label, count : count };
            });

            var trainingdatastatus;
            if (no_data) {
                trainingdatastatus = 'no_data';
            }
            else {
                if (insufficient_data > 1 ||
                    insufficient_data === labelslist.length ||
                    labelslist.length < 2 ||
                    (projectType === 'sounds' && insufficient_data > 0))
                {
                    trainingdatastatus = 'insufficient_data';
                }
                else {
                    trainingdatastatus = 'data';
                }
            }

            return {
                counts : trainingcounts,
                status : trainingdatastatus
            };
        }



        return {
            getStatus : getStatus,
            generateProjectSummary : generateProjectSummary,
            reviewTrainingData : reviewTrainingData
        };
    }
})();
