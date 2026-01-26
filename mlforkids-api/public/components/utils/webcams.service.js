(function () {
    angular
        .module('app')
        .service('webcamsService', webcamsService);

    webcamsService.$inject = [ 'loggerService', '$q' ];

    function webcamsService(loggerService, $q) {

        var webcams;

        function getDefaultWebcamOptions() {
            return [
                { facingMode : 'user' },
                { facingMode : 'environment' }
            ];
        }

        function getDevices() {
            if (webcams) {
                loggerService.debug('[ml4kwebcams] returning cached webcam devices list');
                return $q.resolve(webcams);
            }
            else if (!navigator.mediaDevices) {
                loggerService.error('[ml4kwebcams] navigator.mediaDevices undefined');
                webcams = [];
                return $q.resolve(webcams);
            }
            else {
                loggerService.debug('[ml4kwebcams] listing webcam devices');
                return navigator.mediaDevices.enumerateDevices()
                    .then((devices) => {
                        const videoDevicesWithIds = devices
                            .filter(d => d.kind === 'videoinput')
                            .filter(d => d.deviceId)
                            .map((d) => { return { deviceId : d.deviceId }; });
                        loggerService.debug('[ml4ktraining] webcams', videoDevicesWithIds);

                        if (videoDevicesWithIds.length === 0) {
                            webcams = getDefaultWebcamOptions();
                        }
                        else {
                            webcams = videoDevicesWithIds;
                        }
                        return webcams;
                    })
                    .catch((err) => {
                        loggerService.error('[ml4kwebcams] listing webcams error', err);
                        if (navigator.mediaDevices) {
                            webcams = getDefaultWebcamOptions();
                        }
                        else {
                            webcams = [];
                        }
                        return webcams;
                    });
            }
        }

        return {
            getDevices
        };
    }
})();