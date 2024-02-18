(function () {

    angular
        .module('app')
        .service('imageToolsService', imageToolsService);

    imageToolsService.$inject = [
        '$q'
    ];

    function imageToolsService($q) {

        const MAX_SIZE = 224;

        function getDataFromImageSource(imagesource, format) {
            return $q(function (resolve) {
                // --- calculate dimensions of the image
                var width = imagesource.width;
                var height = imagesource.height;
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height = height * (MAX_SIZE / width);
                        width = MAX_SIZE;
                    }
                }
                else if (height > MAX_SIZE) {
                    width = width * (MAX_SIZE / height);
                    height = MAX_SIZE;
                }

                // --- resize the image
                var hiddenCanvas = document.createElement('canvas');
                hiddenCanvas.width = width;
                hiddenCanvas.height = height;
                var ctx = hiddenCanvas.getContext('2d');
                ctx.drawImage(imagesource, 0, 0, width, height);

                // --- get resized image data
                hiddenCanvas.toBlob(function (output) {
                    resolve(output);
                }, format);
            });
        }



        function getDataFromFile(file) {
            return $q(function (resolve) {
                var imageFileReader = new FileReader();
                imageFileReader.readAsDataURL(file);
                imageFileReader.onloadend = function() {
                    var resizedImg = document.createElement("img");
                    resizedImg.onload = function () {
                        getDataFromImageSource(resizedImg, file.type)
                            .then(function (data) {
                                resolve(data);
                            });
                    };
                    resizedImg.src = imageFileReader.result;
                };
            });
        }



        function resizeImageElement(element) {
            var hiddenCanvas = document.createElement('canvas');
            hiddenCanvas.width = MAX_SIZE;
            hiddenCanvas.height = MAX_SIZE;

            var sourceWidth = element.videoWidth || element.width;
            var sourceHeight = element.videoHeight || element.height;

            var ctx = hiddenCanvas.getContext('2d');
            ctx.drawImage(element,
                0, 0, sourceWidth, sourceHeight,
                0, 0, MAX_SIZE, MAX_SIZE);

            return hiddenCanvas;
        }



        return {
            getDataFromFile,
            getDataFromImageSource,
            resizeImageElement
        };
    }
})();