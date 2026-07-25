describe('scratchService', function () {

    var $httpBackend;
    var scratchService;

    beforeEach(module('app'));

    beforeEach(inject(function (_$httpBackend_, _scratchService_) {
        $httpBackend = _$httpBackend_;
        scratchService = _scratchService_;
    }));

    afterEach(function () {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });


    describe('newTfjsExtension', function () {

        it('posts the model info and returns the response data', function () {
            var modelinfo = { modelurl : 'https://example.com/model.json', modeltype : 'teachablemachineimage' };
            var extensionInfo = { url : '/api/scratch/extension1.js' };

            $httpBackend.expectPOST('/api/scratchtfjs/extensions', modelinfo).respond(200, extensionInfo);

            var result;
            scratchService.newTfjsExtension(modelinfo).then(function (r) { result = r; });
            $httpBackend.flush();

            expect(result).toEqual(extensionInfo);
        });

    });

});
