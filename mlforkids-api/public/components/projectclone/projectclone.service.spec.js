describe('projectCloneService', function () {

    var $httpBackend;
    var $q;
    var $rootScope;
    var projectCloneService;
    var browserStorageServiceMock;
    var loggerServiceMock;
    var storageServiceMock;

    var profile;

    var TRAINING_URL = '/api/classes/class1/students/user1/projects/cloud1/training';

    beforeEach(function () {
        // fresh objects for every test - the service mutates the project
        //  attributes it is given before handing them to browser storage
        profile = { user_id : 'user1', tenant : 'class1' };

        browserStorageServiceMock = jasmine.createSpyObj('browserStorageService', [
            'isSupported', 'addProject', 'bulkAddTrainingData', 'idIsLocal'
        ]);
        // loggerService lives in public/components/logger, which karma.conf.js
        //  doesn't load, so it has to be provided rather than mocked-over
        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error']);
        storageServiceMock = jasmine.createSpyObj('storageService', ['getItem', 'setItem', 'removeItem']);

        module('app', function ($provide) {
            $provide.value('browserStorageService', browserStorageServiceMock);
            $provide.value('loggerService', loggerServiceMock);
            $provide.value('storageService', storageServiceMock);
        });

        inject(function (_$httpBackend_, _$q_, _$rootScope_, _projectCloneService_) {
            $httpBackend = _$httpBackend_;
            $q = _$q_;
            $rootScope = _$rootScope_;
            projectCloneService = _projectCloneService_;
        });

        // stubbed here rather than above, as $q is only available post-inject.
        // isSupported resolves to browserStorageService's own numeric constants
        //  (SUPPORTED_OK = 1, SUPPORTED_NO = -1, SUPPORTED_UNKNOWN = 0), not a
        //  boolean - note that SUPPORTED_NO is truthy
        browserStorageServiceMock.isSupported.and.returnValue($q.resolve(1));
        browserStorageServiceMock.bulkAddTrainingData.and.returnValue($q.resolve());
    });

    afterEach(function () {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });


    describe('cloning a text project', function () {

        var textProject = {
            id : 'cloud1',
            name : 'Sentiment',
            type : 'text',
            language : 'en',
            labels : [ 'happy', 'sad' ]
        };

        it('creates a local project with the same name, type, language and labels', function () {
            browserStorageServiceMock.addProject.and.returnValue($q.resolve({ id : 7 }));

            $httpBackend.expectGET(TRAINING_URL)
                .respond(200,
                    [
                        { id : 'a', label : 'happy', textdata : 'this is great' },
                        { id : 'b', label : 'sad',   textdata : 'this is awful' }
                    ],
                    { 'Content-Range' : 'items 0-1/2' });

            projectCloneService.cloneProject(textProject, profile);

            $httpBackend.flush();

            expect(browserStorageServiceMock.addProject).toHaveBeenCalledTimes(1);

            var created = browserStorageServiceMock.addProject.calls.mostRecent().args[0];
            expect(created.name).toBe('Sentiment');
            expect(created.type).toBe('text');
            expect(created.language).toBe('en');
            expect(created.labels).toEqual([ 'happy', 'sad' ]);
            expect(created.storage).toBe('local');
        });


        it('gives the clone the current user id and class', function () {
            // browserStorageService.getProjects() filters local projects by
            //  userid in javascript - a clone without one is written to
            //  IndexedDB but never appears in the user's project list
            browserStorageServiceMock.addProject.and.returnValue($q.resolve({ id : 7 }));

            $httpBackend.expectGET(TRAINING_URL)
                .respond(200, [], { 'Content-Range' : 'items 0--1/0' });

            projectCloneService.cloneProject(textProject, profile);

            $httpBackend.flush();

            var created = browserStorageServiceMock.addProject.calls.mostRecent().args[0];
            expect(created.userid).toBe('user1');
            expect(created.classid).toBe('class1');
        });


        it('writes the training examples into the new local project', function () {
            browserStorageServiceMock.addProject.and.returnValue($q.resolve({ id : 7 }));

            $httpBackend.expectGET(TRAINING_URL)
                .respond(200,
                    [
                        { id : 'a', label : 'happy', textdata : 'this is great' },
                        { id : 'b', label : 'sad',   textdata : 'this is awful' }
                    ],
                    { 'Content-Range' : 'items 0-1/2' });

            projectCloneService.cloneProject(textProject, profile);

            $httpBackend.flush();

            expect(browserStorageServiceMock.bulkAddTrainingData).toHaveBeenCalledWith(7, [
                { label : 'happy', textdata : 'this is great' },
                { label : 'sad',   textdata : 'this is awful' }
            ]);
        });


        it('does not copy the cloud training item ids into the clone', function () {
            // local training ids are per-database auto-increment integers, so
            //  carrying a cloud uuid across would collide with the keyPath
            browserStorageServiceMock.addProject.and.returnValue($q.resolve({ id : 7 }));

            $httpBackend.expectGET(TRAINING_URL)
                .respond(200,
                    [ { id : 'a', label : 'happy', textdata : 'this is great' } ],
                    { 'Content-Range' : 'items 0-0/1' });

            projectCloneService.cloneProject(textProject, profile);

            $httpBackend.flush();

            var written = browserStorageServiceMock.bulkAddTrainingData.calls.mostRecent().args[1];
            expect(written[0].id).toBeUndefined();
        });


        it('does not modify the project it was asked to clone', function () {
            browserStorageServiceMock.addProject.and.returnValue($q.resolve({ id : 7 }));

            $httpBackend.expectGET(TRAINING_URL)
                .respond(200, [], { 'Content-Range' : 'items 0--1/0' });

            projectCloneService.cloneProject(textProject, profile);

            $httpBackend.flush();

            expect(textProject.storage).toBeUndefined();
            expect(textProject.userid).toBeUndefined();
            expect(textProject.id).toBe('cloud1');
        });


        it('resolves with the new project and a count of skipped examples', function () {
            browserStorageServiceMock.addProject.and.returnValue($q.resolve({ id : 7, name : 'Sentiment' }));

            $httpBackend.expectGET(TRAINING_URL)
                .respond(200,
                    [ { id : 'a', label : 'happy', textdata : 'this is great' } ],
                    { 'Content-Range' : 'items 0-0/1' });

            var result;
            projectCloneService.cloneProject(textProject, profile)
                .then(function (cloneresult) {
                    result = cloneresult;
                });

            $httpBackend.flush();

            expect(result.project).toEqual({ id : 7, name : 'Sentiment' });
            expect(result.copied).toBe(1);
            expect(result.skipped).toBe(0);
        });


        it('fails without creating a project if the training read is truncated', function () {
            // the UI asks for items=0-3000, which is exactly the crowd-sourced
            //  numbers limit - a short read means we would silently clone an
            //  incomplete project
            $httpBackend.expectGET(TRAINING_URL)
                .respond(200,
                    [ { id : 'a', label : 'happy', textdata : 'this is great' } ],
                    { 'Content-Range' : 'items 0-0/3500' });

            var err;
            projectCloneService.cloneProject(textProject, profile)
                .catch(function (cloneerr) {
                    err = cloneerr;
                });

            $httpBackend.flush();

            expect(err).toBeDefined();
            expect(browserStorageServiceMock.addProject).not.toHaveBeenCalled();
            expect(browserStorageServiceMock.bulkAddTrainingData).not.toHaveBeenCalled();
        });


        it('fails without creating a project if browser storage is unsupported', function () {
            // SUPPORTED_NO - note this is truthy, so a plain falsy check would
            //  let an unsupported browser through
            browserStorageServiceMock.isSupported.and.returnValue($q.resolve(-1));

            var err;
            projectCloneService.cloneProject(textProject, profile)
                .catch(function (cloneerr) {
                    err = cloneerr;
                });

            $rootScope.$digest();

            expect(err).toBeDefined();
            expect(browserStorageServiceMock.addProject).not.toHaveBeenCalled();
        });


        it('fails without creating a project if browser storage support is unknown', function () {
            // SUPPORTED_UNKNOWN - browserStorageService itself treats anything
            //  that is not SUPPORTED_OK as unusable, and so do we
            browserStorageServiceMock.isSupported.and.returnValue($q.resolve(0));

            var err;
            projectCloneService.cloneProject(textProject, profile)
                .catch(function (cloneerr) {
                    err = cloneerr;
                });

            $rootScope.$digest();

            expect(err).toBeDefined();
            expect(browserStorageServiceMock.addProject).not.toHaveBeenCalled();
        });

    });


    describe('test data held back from a dataset import', function () {

        // when a project is imported from a bundled dataset with a test split,
        //  the held-back rows are kept as CSV in localStorage under
        //  'testdata://<projectid>', and offered for download on the models
        //  page. they are not training data and are not in either database,
        //  so the clone has to carry them across explicitly - and deleting the
        //  cloud project afterwards destroys them (cleanup.service.js)
        var textProject = {
            id : 'cloud1', name : 'Sentiment', type : 'text',
            language : 'en', labels : [ 'happy' ]
        };

        beforeEach(function () {
            browserStorageServiceMock.addProject.and.returnValue($q.resolve({ id : 7 }));
        });

        function cloneWithNoTraining() {
            $httpBackend.expectGET(TRAINING_URL)
                .respond(200, [], { 'Content-Range' : 'items 0--1/0' });

            var result;
            projectCloneService.cloneProject(textProject, profile)
                .then(function (cloneresult) {
                    result = cloneresult;
                });

            $httpBackend.flush();
            return result;
        }


        it('copies the test data to the new project id', function () {
            storageServiceMock.getItem.and.returnValue('"text","label"\n"hello","happy"');

            var result = cloneWithNoTraining();

            expect(storageServiceMock.getItem).toHaveBeenCalledWith('testdata://cloud1');
            expect(storageServiceMock.setItem).toHaveBeenCalledWith(
                'testdata://7',
                '"text","label"\n"hello","happy"');
            expect(result.testdata).toBe(true);
        });


        it('leaves the source project test data alone', function () {
            storageServiceMock.getItem.and.returnValue('some,csv');

            cloneWithNoTraining();

            expect(storageServiceMock.removeItem).not.toHaveBeenCalled();
        });


        it('does nothing when the project has no test data', function () {
            storageServiceMock.getItem.and.returnValue(null);

            var result = cloneWithNoTraining();

            expect(storageServiceMock.setItem).not.toHaveBeenCalled();
            expect(result.testdata).toBe(false);
        });


        it('still completes the clone if the test data cannot be stored', function () {
            // localStorage can be full, or a no-op in-memory shim in Safari
            //  private mode - losing the test data must not lose the project
            storageServiceMock.getItem.and.returnValue('some,csv');
            storageServiceMock.setItem.and.throwError('QuotaExceededError');

            var result = cloneWithNoTraining();

            expect(result.project).toEqual({ id : 7 });
            expect(result.testdata).toBe(false);
        });

    });


    describe('cloning a numbers project', function () {

        var FIELDS_URL = '/api/classes/class1/students/user1/projects/cloud1/fields';

        var numbersProject = {
            id : 'cloud1',
            name : 'Animals',
            type : 'numbers',
            labels : [ 'mammal', 'bird' ]
        };

        beforeEach(function () {
            browserStorageServiceMock.addProject.and.returnValue($q.resolve({ id : 9 }));
        });


        it('stores the project fields inline, in the order the API returned them', function () {
            // field order is the contract - multichoice training values are
            //  stored as indices into the choices array, so reordering the
            //  fields silently corrupts every multichoice example
            var fields = [
                { name : 'legs',   type : 'number' },
                { name : 'colour', type : 'multichoice', choices : [ 'brown', 'green' ] },
                { name : 'weight', type : 'number' }
            ];

            $httpBackend.expectGET(FIELDS_URL).respond(200, fields);
            $httpBackend.expectGET(TRAINING_URL)
                .respond(200, [], { 'Content-Range' : 'items 0--1/0' });

            projectCloneService.cloneProject(numbersProject, profile);

            $httpBackend.flush();

            var created = browserStorageServiceMock.addProject.calls.mostRecent().args[0];
            expect(created.fields).toEqual(fields);
            expect(created.fields.map(function (f) { return f.name; }))
                .toEqual([ 'legs', 'colour', 'weight' ]);
        });


        it('copies numberdata as an array of numbers', function () {
            $httpBackend.expectGET(FIELDS_URL)
                .respond(200, [ { name : 'legs', type : 'number' } ]);
            $httpBackend.expectGET(TRAINING_URL)
                .respond(200,
                    [
                        { id : 'a', label : 'mammal', numberdata : [ 4, 1 ] },
                        { id : 'b', label : 'bird',   numberdata : [ 2, 0 ] }
                    ],
                    { 'Content-Range' : 'items 0-1/2' });

            projectCloneService.cloneProject(numbersProject, profile);

            $httpBackend.flush();

            expect(browserStorageServiceMock.bulkAddTrainingData).toHaveBeenCalledWith(9, [
                { label : 'mammal', numberdata : [ 4, 1 ] },
                { label : 'bird',   numberdata : [ 2, 0 ] }
            ]);
        });


        it('clones a project that has no fields', function () {
            // the fields API 404s rather than returning an empty list
            $httpBackend.expectGET(FIELDS_URL).respond(404, { error : 'Not found' });
            $httpBackend.expectGET(TRAINING_URL)
                .respond(200, [], { 'Content-Range' : 'items 0--1/0' });

            var result;
            projectCloneService.cloneProject(numbersProject, profile)
                .then(function (cloneresult) {
                    result = cloneresult;
                });

            $httpBackend.flush();

            expect(result).toBeDefined();
            var created = browserStorageServiceMock.addProject.calls.mostRecent().args[0];
            expect(created.fields).toEqual([]);
        });


        it('does not ask for fields when cloning a project type that has none', function () {
            var textProject = { id : 'cloud1', name : 'T', type : 'text', language : 'en', labels : [] };

            $httpBackend.expectGET(TRAINING_URL)
                .respond(200, [], { 'Content-Range' : 'items 0--1/0' });

            projectCloneService.cloneProject(textProject, profile);

            $httpBackend.flush();

            // verifyNoOutstandingExpectation in afterEach would catch a
            //  missing request, but not an unexpected extra one - $httpBackend
            //  throws on those directly
            var created = browserStorageServiceMock.addProject.calls.mostRecent().args[0];
            expect(created.fields).toBeUndefined();
        });

    });


    describe('cloning a sounds project', function () {

        var SOUND_A = '/api/classes/class1/students/user1/projects/cloud1/sounds/a';
        var SOUND_B = '/api/classes/class1/students/user1/projects/cloud1/sounds/b';

        var soundsProject = {
            id : 'cloud1',
            name : 'Noises',
            type : 'sounds',
            labels : [ '_background_noise_', 'clap', 'click' ]
        };

        beforeEach(function () {
            browserStorageServiceMock.addProject.and.returnValue($q.resolve({ id : 4 }));
        });


        it('does not include _background_noise_ in the labels it creates the clone with', function () {
            // browserStorageService.addProject pushes _background_noise_ itself
            //  for every sounds project, with no duplicate check - passing the
            //  cloud label list straight through gives the clone two of them
            $httpBackend.expectGET(TRAINING_URL)
                .respond(200, [], { 'Content-Range' : 'items 0--1/0' });

            projectCloneService.cloneProject(soundsProject, profile);

            $httpBackend.flush();

            var created = browserStorageServiceMock.addProject.calls.mostRecent().args[0];
            expect(created.labels).toEqual([ 'clap', 'click' ]);
        });


        it('downloads each spectrogram and stores it inline on the training record', function () {
            $httpBackend.expectGET(TRAINING_URL)
                .respond(200,
                    [
                        { id : 'a', label : 'clap',  audiourl : SOUND_A },
                        { id : 'b', label : 'click', audiourl : SOUND_B }
                    ],
                    { 'Content-Range' : 'items 0-1/2' });

            $httpBackend.expectGET(SOUND_A).respond(200, [ 0.1, 0.2, 0.3 ]);
            $httpBackend.expectGET(SOUND_B).respond(200, [ 0.4, 0.5, 0.6 ]);

            projectCloneService.cloneProject(soundsProject, profile);

            $httpBackend.flush();

            expect(browserStorageServiceMock.bulkAddTrainingData).toHaveBeenCalledWith(4, [
                { label : 'clap',  audiodata : [ 0.1, 0.2, 0.3 ] },
                { label : 'click', audiodata : [ 0.4, 0.5, 0.6 ] }
            ]);
        });


        it('skips a sound that cannot be downloaded, and reports it', function () {
            $httpBackend.expectGET(TRAINING_URL)
                .respond(200,
                    [
                        { id : 'a', label : 'clap',  audiourl : SOUND_A },
                        { id : 'b', label : 'click', audiourl : SOUND_B }
                    ],
                    { 'Content-Range' : 'items 0-1/2' });

            $httpBackend.expectGET(SOUND_A).respond(200, [ 0.1, 0.2, 0.3 ]);
            $httpBackend.expectGET(SOUND_B).respond(500, { error : 'Unavailable' });

            var result;
            projectCloneService.cloneProject(soundsProject, profile)
                .then(function (cloneresult) {
                    result = cloneresult;
                });

            $httpBackend.flush();

            expect(result.copied).toBe(1);
            expect(result.skipped).toBe(1);
            expect(browserStorageServiceMock.bulkAddTrainingData).toHaveBeenCalledWith(4, [
                { label : 'clap', audiodata : [ 0.1, 0.2, 0.3 ] }
            ]);
        });

    });


    describe('cloning an images project', function () {

        var IMAGE_A = '/api/classes/class1/students/user1/projects/cloud1/training/a';
        var IMAGE_B = '/api/classes/class1/students/user1/projects/cloud1/training/b';

        var imagesProject = {
            id : 'cloud1',
            name : 'Pets',
            type : 'imgtfjs',
            labels : [ 'cat', 'dog' ]
        };

        // the first bytes of a real PNG and a real JPEG - sharp preserves the
        //  input format when it resizes, so the API can return either, and it
        //  sends both as application/octet-stream
        function pngBytes() {
            return new Uint8Array([ 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A ]).buffer;
        }
        function jpegBytes() {
            return new Uint8Array([ 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10 ]).buffer;
        }

        beforeEach(function () {
            browserStorageServiceMock.addProject.and.returnValue($q.resolve({ id : 3 }));
        });


        it('stores object-store images as self-contained bytes, with no imageurl', function () {
            // the cloud imageurl for a stored image is an API path back into
            //  the project being cloned - keeping it would leave the clone
            //  rendering its images through a project the user is about to
            //  delete, so the bytes are all we keep
            $httpBackend.expectGET(TRAINING_URL)
                .respond(200,
                    [
                        {
                            id : 'a', label : 'cat', isstored : true,
                            imageurl : '/api/classes/class1/students/user1/projects/cloud1/images/a'
                        }
                    ],
                    { 'Content-Range' : 'items 0-0/1' });

            $httpBackend.expectGET(IMAGE_A).respond(200, pngBytes());

            projectCloneService.cloneProject(imagesProject, profile);

            $httpBackend.flush();

            var written = browserStorageServiceMock.bulkAddTrainingData.calls.mostRecent().args[1];
            expect(written.length).toBe(1);
            expect(written[0].label).toBe('cat');
            expect(written[0].isstored).toBe(true);
            expect(written[0].imageurl).toBeUndefined();
            expect(written[0].imagedata instanceof Blob).toBe(true);
        });


        it('keeps the third-party URL for images the cloud only linked to', function () {
            $httpBackend.expectGET(TRAINING_URL)
                .respond(200,
                    [
                        {
                            id : 'a', label : 'dog', isstored : false,
                            imageurl : 'https://example.net/dog.jpg'
                        }
                    ],
                    { 'Content-Range' : 'items 0-0/1' });

            $httpBackend.expectGET(IMAGE_A).respond(200, jpegBytes());

            projectCloneService.cloneProject(imagesProject, profile);

            $httpBackend.flush();

            var written = browserStorageServiceMock.bulkAddTrainingData.calls.mostRecent().args[1];
            expect(written[0].isstored).toBe(false);
            expect(written[0].imageurl).toBe('https://example.net/dog.jpg');
            expect(written[0].imagedata instanceof Blob).toBe(true);
        });


        it('gives the stored blob an image mimetype so it can be displayed', function () {
            // the API sends resized images as application/octet-stream, and a
            //  blob URL with that type will not render in an <img> element
            $httpBackend.expectGET(TRAINING_URL)
                .respond(200,
                    [
                        { id : 'a', label : 'cat', isstored : true },
                        { id : 'b', label : 'dog', isstored : true }
                    ],
                    { 'Content-Range' : 'items 0-1/2' });

            $httpBackend.expectGET(IMAGE_A).respond(200, pngBytes());
            $httpBackend.expectGET(IMAGE_B).respond(200, jpegBytes());

            projectCloneService.cloneProject(imagesProject, profile);

            $httpBackend.flush();

            var written = browserStorageServiceMock.bulkAddTrainingData.calls.mostRecent().args[1];
            expect(written[0].imagedata.type).toBe('image/png');
            expect(written[1].imagedata.type).toBe('image/jpeg');
        });


        it('skips an image that no longer downloads, keeping the rest in order', function () {
            // a cloud project can hold rows pointing at third-party URLs that
            //  have since died - the API returns 409 for those
            $httpBackend.expectGET(TRAINING_URL)
                .respond(200,
                    [
                        { id : 'a', label : 'cat', isstored : false, imageurl : 'https://example.net/gone.jpg' },
                        { id : 'b', label : 'dog', isstored : true }
                    ],
                    { 'Content-Range' : 'items 0-1/2' });

            $httpBackend.expectGET(IMAGE_A)
                .respond(409, { code : 'MLMOD12', error : 'One of your training images could not be downloaded' });
            $httpBackend.expectGET(IMAGE_B).respond(200, jpegBytes());

            var result;
            projectCloneService.cloneProject(imagesProject, profile)
                .then(function (cloneresult) {
                    result = cloneresult;
                });

            $httpBackend.flush();

            expect(result.copied).toBe(1);
            expect(result.skipped).toBe(1);

            var written = browserStorageServiceMock.bulkAddTrainingData.calls.mostRecent().args[1];
            expect(written.length).toBe(1);
            expect(written[0].label).toBe('dog');
        });


        it('reports download progress as each image lands', function () {
            $httpBackend.expectGET(TRAINING_URL)
                .respond(200,
                    [
                        { id : 'a', label : 'cat', isstored : true },
                        { id : 'b', label : 'dog', isstored : true }
                    ],
                    { 'Content-Range' : 'items 0-1/2' });

            $httpBackend.expectGET(IMAGE_A).respond(200, pngBytes());
            $httpBackend.expectGET(IMAGE_B).respond(200, jpegBytes());

            var progress = [];
            projectCloneService.cloneProject(imagesProject, profile, function (done, total) {
                progress.push(done + '/' + total);
            });

            $httpBackend.flush();

            expect(progress).toEqual([ '1/2', '2/2' ]);
        });

    });


    describe('downloading more examples than can be fetched at once', function () {

        it('copies every example, in order, when there are more than the download limit', function () {
            // exercises the pool refilling as each download lands - with six
            //  examples and a limit of four, two of them can only start after
            //  an earlier one has finished
            var soundsProject = {
                id : 'cloud1', name : 'Noises', type : 'sounds', labels : [ 'a' ]
            };

            browserStorageServiceMock.addProject.and.returnValue($q.resolve({ id : 4 }));

            var trainingitems = [];
            for (var i = 0; i < 6; i++) {
                trainingitems.push({
                    id : 'item' + i,
                    label : 'a',
                    audiourl : '/api/classes/class1/students/user1/projects/cloud1/sounds/item' + i
                });
            }

            $httpBackend.expectGET(TRAINING_URL)
                .respond(200, trainingitems, { 'Content-Range' : 'items 0-5/6' });

            trainingitems.forEach(function (trainingitem, idx) {
                $httpBackend.expectGET(trainingitem.audiourl).respond(200, [ idx ]);
            });

            var result;
            projectCloneService.cloneProject(soundsProject, profile)
                .then(function (cloneresult) {
                    result = cloneresult;
                });

            $httpBackend.flush();

            expect(result.copied).toBe(6);
            expect(result.skipped).toBe(0);

            var written = browserStorageServiceMock.bulkAddTrainingData.calls.mostRecent().args[1];
            expect(written.map(function (record) {
                return record.audiodata[0];
            })).toEqual([ 0, 1, 2, 3, 4, 5 ]);
        });

    });


    describe('cloning a project type that has no browser-storage equivalent', function () {

        it('fails without creating a project', function () {
            // 'images' is the legacy Watson Visual Recognition type - it has no
            //  local counterpart at all
            var legacyProject = { id : 'cloud1', name : 'Old', type : 'images', labels : [] };

            $httpBackend.expectGET(TRAINING_URL)
                .respond(200, [], { 'Content-Range' : 'items 0--1/0' });

            var err;
            projectCloneService.cloneProject(legacyProject, profile)
                .catch(function (cloneerr) {
                    err = cloneerr;
                });

            $httpBackend.flush();

            expect(err).toBeDefined();
            expect(browserStorageServiceMock.addProject).not.toHaveBeenCalled();
            expect(browserStorageServiceMock.bulkAddTrainingData).not.toHaveBeenCalled();
        });

    });

});
