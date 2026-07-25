describe('datasetsService', function () {

    var $httpBackend;
    var datasetsService;
    var browserStorageServiceMock;

    beforeEach(function () {
        browserStorageServiceMock = jasmine.createSpyObj('browserStorageService', ['sanitizeLabel']);
        browserStorageServiceMock.sanitizeLabel.and.callFake(function (label) {
            return label.replace(/[^\w.]/g, '_');
        });

        module('app', function ($provide) {
            $provide.value('browserStorageService', browserStorageServiceMock);
        });

        inject(function (_$httpBackend_, _datasetsService_) {
            $httpBackend = _$httpBackend_;
            datasetsService = _datasetsService_;
        });
    });

    afterEach(function () {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });


    describe('getDataset', function () {

        it('converts an imgtfjs dataset into flat training data, sanitizing labels', function () {
            $httpBackend.expectGET('/static/datasets/imgtfjs/pokemon.json?v=2').respond(200, {
                metadata : { language : 'en', fields : [] },
                data : {
                    'cat pics' : [ 'http://example.com/cat1.jpg', 'http://example.com/cat2.jpg' ],
                    'dog pics' : [ 'http://example.com/dog1.jpg' ]
                }
            });

            var result;
            datasetsService.getDataset('imgtfjs', 'pokemon').then(function (r) { result = r; });
            $httpBackend.flush();

            expect(result.language).toBe('en');
            expect(result.labels).toEqual([ 'cat_pics', 'dog_pics' ]);
            expect(result.trainingdata).toEqual([
                { imageurl : 'http://example.com/cat1.jpg', label : 'cat_pics' },
                { imageurl : 'http://example.com/cat2.jpg', label : 'cat_pics' },
                { imageurl : 'http://example.com/dog1.jpg', label : 'dog_pics' }
            ]);
        });

        it('converts a text dataset into flat training data, sanitizing labels', function () {
            $httpBackend.expectGET('/static/datasets/text/song-lyrics.json?v=2').respond(200, {
                metadata : { language : 'en', fields : [] },
                data : {
                    'happy!' : [ 'la la la' ],
                    'sad!' : [ 'boo hoo' ]
                }
            });

            var result;
            datasetsService.getDataset('text', 'song-lyrics').then(function (r) { result = r; });
            $httpBackend.flush();

            expect(result.labels).toEqual([ 'happy_', 'sad_' ]);
            expect(result.trainingdata).toEqual([
                { textdata : 'la la la', label : 'happy_' },
                { textdata : 'boo hoo', label : 'sad_' }
            ]);
        });

        it('converts a numbers dataset into per-label grouped training data', function () {
            $httpBackend.expectGET('/static/datasets/numbers/titanic.json?v=2').respond(200, {
                metadata : {
                    language : 'en',
                    fields : [ { name : 'age' }, { name : 'fare' } ]
                },
                data : {
                    survived : [ [ 22, 7.25 ], [ 38, 71.28 ] ],
                    died : [ [ 45, 10 ] ]
                }
            });

            var result;
            datasetsService.getDataset('numbers', 'titanic').then(function (r) { result = r; });
            $httpBackend.flush();

            expect(result.labels).toEqual([ 'survived', 'died' ]);
            expect(result.trainingdata).toEqual([
                { label : 'survived', numbers : [ { age : 22, fare : 7.25 }, { age : 38, fare : 71.28 } ] },
                { label : 'died', numbers : [ { age : 45, fare : 10 } ] }
            ]);
        });

        it('excludes numbers labels that have no rows', function () {
            $httpBackend.expectGET('/static/datasets/numbers/titanic.json?v=2').respond(200, {
                metadata : { language : 'en', fields : [ { name : 'age' } ] },
                data : {
                    survived : [ [ 22 ] ],
                    died : []
                }
            });

            var result;
            datasetsService.getDataset('numbers', 'titanic').then(function (r) { result = r; });
            $httpBackend.flush();

            expect(result.trainingdata.length).toBe(1);
            expect(result.trainingdata[0].label).toBe('survived');
            // died has no rows, so is skipped from trainingdata, but is still
            // reported in labels (it comes from Object.keys(dataset.data))
            expect(result.labels).toEqual([ 'survived', 'died' ]);
        });

    });

});
