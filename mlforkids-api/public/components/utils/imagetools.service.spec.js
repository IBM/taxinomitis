describe('imageToolsService', function () {

    var $rootScope;
    var imageToolsService;
    var readersServiceMock;

    var fakeReader;
    var fakeImg;
    var fakeCanvas;
    var fakeCtx;
    var originalCreateElement;

    beforeEach(function () {
        fakeReader = { readAsDataURL : function () {}, result : 'data:image/png;base64,ZmFrZQ==' };
        readersServiceMock = jasmine.createSpyObj('readersService', ['createFileReader']);
        readersServiceMock.createFileReader.and.returnValue(fakeReader);

        module('app', function ($provide) {
            $provide.value('readersService', readersServiceMock);
        });

        inject(function (_$rootScope_, _imageToolsService_) {
            $rootScope = _$rootScope_;
            imageToolsService = _imageToolsService_;
        });

        fakeImg = { width : 300, height : 200 };

        fakeCtx = jasmine.createSpyObj('ctx', ['drawImage']);
        fakeCanvas = {
            getContext : function () { return fakeCtx; },
            toBlob : function (callback) { callback({ fake : 'blob' }); }
        };

        originalCreateElement = document.createElement;
        spyOn(document, 'createElement').and.callFake(function (tagName) {
            if (tagName === 'img') {
                return fakeImg;
            }
            if (tagName === 'canvas') {
                return fakeCanvas;
            }
            return originalCreateElement.call(document, tagName);
        });
    });


    it('resolves with the resized image data for a valid image', function () {
        var file = { type : 'image/png' };

        var result;
        var error;
        imageToolsService.getDataFromFile(file).then(
            function (data) { result = data; },
            function (err) { error = err; }
        );

        imageFileReaderLoaded();
        fakeImg.onload();
        $rootScope.$digest();

        expect(error).toBeUndefined();
        expect(result).toEqual({ fake : 'blob' });
    });


    it('rejects instead of hanging when the file cannot be decoded as an image', function () {
        var file = { type : 'image/png' };

        var result;
        var error;
        imageToolsService.getDataFromFile(file).then(
            function (data) { result = data; },
            function (err) { error = err; }
        );

        imageFileReaderLoaded();
        fakeImg.onerror(new Error('image decode failed'));
        $rootScope.$digest();

        expect(result).toBeUndefined();
        expect(error).toBeDefined();
    });


    it('rejects instead of hanging when the browser does not support reading the file', function () {
        var file = { type : 'image/png' };
        var unsupportedErr = new Error('File upload is not supported in this browser.');
        readersServiceMock.createFileReader.and.callFake(function () {
            throw unsupportedErr;
        });

        var result;
        var error;
        imageToolsService.getDataFromFile(file).then(
            function (data) { result = data; },
            function (err) { error = err; }
        );

        $rootScope.$digest();

        expect(result).toBeUndefined();
        expect(error).toBe(unsupportedErr);
    });


    it('rejects instead of hanging when the FileReader itself fails to read the file', function () {
        var file = { type : 'image/png' };
        var readErr = new Error('could not read file');

        var result;
        var error;
        imageToolsService.getDataFromFile(file).then(
            function (data) { result = data; },
            function (err) { error = err; }
        );

        fakeReader.onerror(readErr);
        $rootScope.$digest();

        expect(result).toBeUndefined();
        expect(error).toBe(readErr);
    });


    it('rejects instead of hanging when resizing the image fails', function () {
        var file = { type : 'image/png' };
        fakeCtx.drawImage.and.callFake(function () {
            throw new Error('drawImage failed');
        });

        var result;
        var error;
        imageToolsService.getDataFromFile(file).then(
            function (data) { result = data; },
            function (err) { error = err; }
        );

        imageFileReaderLoaded();
        fakeImg.onload();
        $rootScope.$digest();

        expect(result).toBeUndefined();
        expect(error).toBeDefined();
    });


    it('rejects instead of hanging when the canvas cannot produce image data', function () {
        var file = { type : 'image/png' };
        fakeCanvas.toBlob = function (callback) { callback(null); };

        var result;
        var error;
        imageToolsService.getDataFromFile(file).then(
            function (data) { result = data; },
            function (err) { error = err; }
        );

        imageFileReaderLoaded();
        fakeImg.onload();
        $rootScope.$digest();

        expect(result).toBeUndefined();
        expect(error).toBeDefined();
    });


    it('resolves without error for an image reported with zero dimensions', function () {
        var file = { type : 'image/png' };
        fakeImg.width = 0;
        fakeImg.height = 0;

        var result;
        var error;
        imageToolsService.getDataFromFile(file).then(
            function (data) { result = data; },
            function (err) { error = err; }
        );

        imageFileReaderLoaded();
        fakeImg.onload();
        $rootScope.$digest();

        expect(error).toBeUndefined();
        expect(result).toEqual({ fake : 'blob' });
    });


    function imageFileReaderLoaded() {
        fakeReader.onloadend();
    }

});
