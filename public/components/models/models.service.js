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




        return {
            getStatus : getStatus,
            generateProjectSummary : generateProjectSummary
        };
    }
})();
