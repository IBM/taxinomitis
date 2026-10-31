describe('txtService', function () {

    var $rootScope;
    var txtService;
    var readersServiceMock;

    var fakeReader;

    beforeEach(function () {
        fakeReader = { readAsText : function () {} };
        readersServiceMock = jasmine.createSpyObj('readersService', ['createFileReader']);
        readersServiceMock.createFileReader.and.returnValue(fakeReader);

        module('app', function ($provide) {
            $provide.value('readersService', readersServiceMock);
            $provide.value('loggerService', jasmine.createSpyObj('loggerService', ['debug', 'error']));
        });

        inject(function (_$rootScope_, _txtService_) {
            $rootScope = _$rootScope_;
            txtService = _txtService_;
        });
    });

    function readFile(contents) {
        var result;
        var error;
        txtService.getContents([ { name : 'test.txt' } ]).then(
            function (files) { result = files; },
            function (err) { error = err; }
        );
        fakeReader.onload({ target : { result : contents } });
        $rootScope.$digest();
        return { result, error };
    }


    it('returns the contents of text files', function () {
        var read = readFile('hello world');

        expect(read.error).toBeUndefined();
        expect(read.result).toEqual([ { type : 'text', title : 'test.txt', contents : 'hello world' } ]);
    });

    it('rejects files that are not text files', function () {
        var read = readFile('PK\u0003\u0004[Content_Types].xml');

        expect(read.result).toBeUndefined();
        expect(read.error.message).toBe(txtService.NOT_TEXT_FILE);
    });
});
