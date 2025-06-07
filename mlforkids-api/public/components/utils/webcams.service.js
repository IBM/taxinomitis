(function () {
    angular
        .module('app')
        .service('webcamsService', webcamsService);

    webcamsService.$inject = [ 'loggerService' ];

    function webcamsService(loggerService) {

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
                return Promise.resolve(webcams);
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
                        webcams = getDefaultWebcamOptions();
                        return webcams;
                    });
            }
        }

        return {
            getDevices
        };
    }
})();