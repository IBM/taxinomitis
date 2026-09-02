// Tests for the project archive format - the zip file produced by exporting a
//  project, and read back by importing one.
//
// The format is the one decision in this feature that is expensive to change
//  once anybody has an archive on disk, so it is pinned down here rather than
//  left to emerge from the implementation. Two properties matter most:
//
//   1. an archive is anonymous. it names neither the child who made the
//      project nor the class they belong to. these tests assert that directly,
//      against the whole zip, rather than field by field
//   2. an archive does not record which storage its project came from. a cloud
//      export and a local export of the same project produce the same
//      structure, and the importer has one code path
//
// JSZip is loaded for real by karma (see karma.conf.js) so that these tests
//  exercise the actual format and not our assumptions about it.

describe('project archives', function () {

    var $httpBackend;
    var $q;
    var $rootScope;
    var projectCloneService;
    var browserStorageServiceMock;
    var loggerServiceMock;
    var storageServiceMock;
    var utilServiceMock;

    var profile;

    var CLOUD_PROJECT_URL = '/api/classes/class1/students/user1/projects/cloud1';


    // ------------------------------------------------------------------
    //  async plumbing
    //
    //  JSZip returns native promises, $http returns $q promises, and neither
    //  settles without help: $q needs a digest, $httpBackend needs a flush.
    //  pumping both on a macrotask until the promise settles is what lets a
    //  test await an operation that interleaves the two
    // ------------------------------------------------------------------

    function settle(promise) {
        return new Promise(function (resolve, reject) {
            var finished = false;

            promise.then(
                function (result) { finished = true; resolve(result); },
                function (err)    { finished = true; reject(err); });

            (function pump() {
                if (finished) {
                    return;
                }
                try {
                    $httpBackend.flush();
                }
                catch (nothingToFlush) {
                    // no outstanding requests - expected for most iterations
                }
                try {
                    $rootScope.$digest();
                }
                catch (alreadyInDigest) {
                    // ignored - the flush above will have run one
                }
                setTimeout(pump, 1);
            }());
        });
    }


    // ------------------------------------------------------------------
    //  fixtures
    // ------------------------------------------------------------------

    // a 1x1 png, as the bytes an image download would produce
    var PNG_BYTES = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52
    ]);

    function pngArrayBuffer() {
        return PNG_BYTES.slice().buffer;
    }
    function pngBlob() {
        return new Blob([ PNG_BYTES.slice() ], { type : 'image/png' });
    }


    var cloudTextProject = {
        id : 'cloud1',
        userid : 'user1',
        classid : 'class1',
        name : 'Sentiment',
        type : 'text',
        language : 'en',
        labels : [ 'happy', 'sad' ],
        numfields : 0,
        fields : [],
        isCrowdSourced : false
    };

    var localTextProject = {
        id : 4,
        userid : 'user1',
        classid : 'class1',
        name : 'Sentiment',
        type : 'text',
        language : 'en',
        labels : [ 'happy', 'sad' ],
        storage : 'local'
    };

    var TEXT_TRAINING_CLOUD = [
        { id : 'aaa', label : 'happy', textdata : 'this is great' },
        { id : 'bbb', label : 'sad',   textdata : 'this is awful' }
    ];
    var TEXT_TRAINING_LOCAL = [
        { id : 1, label : 'happy', textdata : 'this is great' },
        { id : 2, label : 'sad',   textdata : 'this is awful' }
    ];


    beforeEach(function () {
        profile = { user_id : 'user1', tenant : 'class1' };

        browserStorageServiceMock = jasmine.createSpyObj('browserStorageService', [
            'isSupported', 'addProject', 'bulkAddTrainingData', 'idIsLocal',
            'getProject', 'getTrainingData', 'sanitizeLabel'
        ]);
        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error']);
        storageServiceMock = jasmine.createSpyObj('storageService', ['getItem', 'setItem', 'removeItem']);
        utilServiceMock = jasmine.createSpyObj('utilService', ['loadZipSupport']);

        module('app', function ($provide) {
            $provide.value('browserStorageService', browserStorageServiceMock);
            $provide.value('loggerService', loggerServiceMock);
            $provide.value('storageService', storageServiceMock);
            $provide.value('utilService', utilServiceMock);
        });

        inject(function (_$httpBackend_, _$q_, _$rootScope_, _projectCloneService_) {
            $httpBackend = _$httpBackend_;
            $q = _$q_;
            $rootScope = _$rootScope_;
            projectCloneService = _projectCloneService_;
        });

        // karma has already loaded the real JSZip, so the lazy load is a no-op
        utilServiceMock.loadZipSupport.and.returnValue($q.resolve());

        browserStorageServiceMock.isSupported.and.returnValue($q.resolve(1));
        browserStorageServiceMock.bulkAddTrainingData.and.returnValue($q.resolve());
        // the real implementation replaces non-word characters and truncates
        browserStorageServiceMock.sanitizeLabel.and.callFake(function (label) {
            return label.replace(/[^\w.]/g, '_').substring(0, 30);
        });
        storageServiceMock.getItem.and.returnValue(null);
    });


    // ------------------------------------------------------------------
    //  helpers for reading an archive back
    // ------------------------------------------------------------------

    function readArchive(blob) {
        return JSZip.loadAsync(blob)
            .then(function (zip) {
                var archive = { zip : zip, filenames : Object.keys(zip.files).sort() };

                return zip.file('project.json').async('string')
                    .then(function (projectjson) {
                        archive.project = JSON.parse(projectjson);
                        return zip.file('training.json').async('string');
                    })
                    .then(function (trainingjson) {
                        archive.training = JSON.parse(trainingjson);
                        return zip.file('manifest.json').async('string');
                    })
                    .then(function (manifestjson) {
                        archive.manifest = JSON.parse(manifestjson);
                        return archive;
                    });
            });
    }

    // the anonymity check. reads every text-ish file in the archive as a
    //  string and looks for the real user and class ids anywhere in it -
    //  including in a url, which is how they leaked in the first place
    function readAllText(zip) {
        var reads = [];
        zip.forEach(function (path, entry) {
            if (!entry.dir && !/^images\//.test(path)) {
                reads.push(entry.async('string'));
            }
        });
        return Promise.all(reads).then(function (contents) {
            return contents.join('\n');
        });
    }


    // ==================================================================
    //  the archive is anonymous
    // ==================================================================

    describe('anonymity', function () {

        it('replaces the user and class ids in an exported cloud project', async function () {
            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training')
                .respond(200, TEXT_TRAINING_CLOUD, { 'Content-Range' : 'items 0-1/2' });

            var result = await settle(projectCloneService.exportProject(cloudTextProject, profile));
            var archive = await readArchive(result.blob);

            expect(archive.project.userid).toBe('userid');
            expect(archive.project.classid).toBe('classid');
            expect(archive.project.id).toBe('projectid');
        });


        it('leaves no trace of the real user or class id anywhere in the archive', async function () {
            // the image url is the trap here - a stored image's url is
            //  /api/classes/<classid>/students/<userid>/projects/... so an
            //  archive that keeps it is not anonymous no matter what
            //  project.json says
            var imageProject = {
                id : 'cloud1', userid : 'user1', classid : 'class1',
                name : 'Animals', type : 'imgtfjs', language : '',
                labels : [ 'cat' ], numfields : 0, fields : [], isCrowdSourced : false
            };

            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training')
                .respond(200,
                    [{
                        id : 'img1',
                        imageurl : CLOUD_PROJECT_URL + '/images/img1',
                        isstored : true,
                        userid : 'user1',
                        label : 'cat'
                    }],
                    { 'Content-Range' : 'items 0-0/1' });
            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training/img1')
                .respond(200, pngArrayBuffer());

            var result = await settle(projectCloneService.exportProject(imageProject, profile));
            var archive = await readArchive(result.blob);
            var alltext = await readAllText(archive.zip);

            expect(alltext).not.toContain('user1');
            expect(alltext).not.toContain('class1');
            expect(alltext).not.toContain('cloud1');
        });


        it('keeps the shape of the redacted fields', async function () {
            // the placeholders are strings because the values they replace are
            //  strings - an importer parsing project.json should not have to
            //  cope with a different type
            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training')
                .respond(200, TEXT_TRAINING_CLOUD, { 'Content-Range' : 'items 0-1/2' });

            var result = await settle(projectCloneService.exportProject(cloudTextProject, profile));
            var archive = await readArchive(result.blob);

            expect(typeof archive.project.id).toBe('string');
            expect(typeof archive.project.userid).toBe('string');
            expect(typeof archive.project.classid).toBe('string');
        });


        it('replaces the userid carried on stored image training rows', async function () {
            // getImageTrainingFromDbRow adds a userid to every stored image
            //  row, extracted back out of the image url. easy to miss because
            //  it is not in the database and not in every response
            var imageProject = {
                id : 'cloud1', userid : 'user1', classid : 'class1',
                name : 'Animals', type : 'imgtfjs', language : '',
                labels : [ 'cat' ], numfields : 0, fields : [], isCrowdSourced : false
            };

            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training')
                .respond(200,
                    [{
                        id : 'img1',
                        imageurl : CLOUD_PROJECT_URL + '/images/img1',
                        isstored : true,
                        userid : 'user1',
                        label : 'cat'
                    }],
                    { 'Content-Range' : 'items 0-0/1' });
            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training/img1')
                .respond(200, pngArrayBuffer());

            var result = await settle(projectCloneService.exportProject(imageProject, profile));
            var archive = await readArchive(result.blob);

            expect(archive.training[0].userid).toBe('userid');
        });
    });


    // ==================================================================
    //  cloud and local exports are structurally identical
    // ==================================================================

    describe('storage independence', function () {

        function exportCloudText() {
            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training')
                .respond(200, TEXT_TRAINING_CLOUD, { 'Content-Range' : 'items 0-1/2' });

            return settle(projectCloneService.exportProject(cloudTextProject, profile))
                .then(function (result) {
                    return readArchive(result.blob);
                });
        }

        function exportLocalText() {
            browserStorageServiceMock.getProject.and.returnValue($q.resolve(localTextProject));
            browserStorageServiceMock.getTrainingData.and.returnValue($q.resolve(TEXT_TRAINING_LOCAL));

            return settle(projectCloneService.exportProject(localTextProject, profile))
                .then(function (result) {
                    return readArchive(result.blob);
                });
        }


        it('produces the same files from a cloud project and a local project', async function () {
            var fromcloud = await exportCloudText();
            var fromlocal = await exportLocalText();

            expect(fromlocal.filenames).toEqual(fromcloud.filenames);
        });


        it('produces the same project.json fields', async function () {
            var fromcloud = await exportCloudText();
            var fromlocal = await exportLocalText();

            expect(Object.keys(fromlocal.project).sort())
                .toEqual(Object.keys(fromcloud.project).sort());
        });


        it('produces the same training.json fields', async function () {
            var fromcloud = await exportCloudText();
            var fromlocal = await exportLocalText();

            expect(Object.keys(fromlocal.training[0]).sort())
                .toEqual(Object.keys(fromcloud.training[0]).sort());
        });


        it('records nothing about which storage the project came from', async function () {
            var fromlocal = await exportLocalText();

            // 'storage' is a browser-only field. an archive that carries it
            //  would give the importer something to branch on, which is
            //  exactly what this format is meant to avoid
            expect(fromlocal.project.storage).toBeUndefined();
            expect(fromlocal.manifest.storage).toBeUndefined();
        });


        it('carries the same values, differing only in the incidental ids', async function () {
            var fromcloud = await exportCloudText();
            var fromlocal = await exportLocalText();

            expect(fromlocal.project.name).toBe(fromcloud.project.name);
            expect(fromlocal.project.labels).toEqual(fromcloud.project.labels);

            expect(fromlocal.training.map(function (item) { return item.textdata; }))
                .toEqual(fromcloud.training.map(function (item) { return item.textdata; }));
        });
    });


    // ==================================================================
    //  training.json is an index, in the shape of the training API
    // ==================================================================

    describe('training.json', function () {

        it('holds text examples inline', async function () {
            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training')
                .respond(200, TEXT_TRAINING_CLOUD, { 'Content-Range' : 'items 0-1/2' });

            var result = await settle(projectCloneService.exportProject(cloudTextProject, profile));
            var archive = await readArchive(result.blob);

            expect(archive.training).toEqual([
                { id : 'aaa', label : 'happy', textdata : 'this is great' },
                { id : 'bbb', label : 'sad',   textdata : 'this is awful' }
            ]);
            expect(archive.filenames).not.toContain('images/');
        });


        it('holds numbers examples inline, with the fields on the project', async function () {
            var numbersProject = {
                id : 'cloud1', userid : 'user1', classid : 'class1',
                name : 'Titanic', type : 'numbers', language : '',
                labels : [ 'survived' ], numfields : 2, fields : [], isCrowdSourced : false
            };

            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/fields')
                .respond(200, [
                    { name : 'age',  type : 'number' },
                    { name : 'class', type : 'multichoice', choices : [ 'first', 'second' ] }
                ]);
            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training')
                .respond(200,
                    [{ id : 'n1', label : 'survived', numberdata : [ 32, 0 ] }],
                    { 'Content-Range' : 'items 0-0/1' });

            var result = await settle(projectCloneService.exportProject(numbersProject, profile));
            var archive = await readArchive(result.blob);

            expect(archive.training[0].numberdata).toEqual([ 32, 0 ]);
            // field order is the contract - multichoice values are indices
            //  into choices - so it has to survive the round trip
            expect(archive.project.fields[0].name).toBe('age');
            expect(archive.project.fields[1].choices).toEqual([ 'first', 'second' ]);
        });


        it('points stored images at a file inside the archive', async function () {
            var imageProject = {
                id : 'cloud1', userid : 'user1', classid : 'class1',
                name : 'Animals', type : 'imgtfjs', language : '',
                labels : [ 'cat', 'dog' ], numfields : 0, fields : [], isCrowdSourced : false
            };

            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training')
                .respond(200,
                    [
                        {
                            id : 'img1', isstored : true, userid : 'user1', label : 'cat',
                            imageurl : CLOUD_PROJECT_URL + '/images/img1'
                        },
                        {
                            id : 'img2', isstored : false, label : 'dog',
                            imageurl : 'https://example.com/dog.png'
                        }
                    ],
                    { 'Content-Range' : 'items 0-1/2' });
            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training/img1')
                .respond(200, pngArrayBuffer());

            var result = await settle(projectCloneService.exportProject(imageProject, profile));
            var archive = await readArchive(result.blob);

            expect(archive.training[0].imageurl).toBe('images/img1.png');
            expect(archive.filenames).toContain('images/img1.png');

            // an image the project only ever held a link to stays a link -
            //  the archive is deliberately not self-contained for these, the
            //  same way the cloud project it came from was not
            expect(archive.training[1].imageurl).toBe('https://example.com/dog.png');
            expect(archive.filenames).not.toContain('images/img2.png');
        });


        it('keeps the isstored flag for parity with the training API', async function () {
            var imageProject = {
                id : 'cloud1', userid : 'user1', classid : 'class1',
                name : 'Animals', type : 'imgtfjs', language : '',
                labels : [ 'cat' ], numfields : 0, fields : [], isCrowdSourced : false
            };

            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training')
                .respond(200,
                    [{
                        id : 'img1', isstored : true, userid : 'user1', label : 'cat',
                        imageurl : CLOUD_PROJECT_URL + '/images/img1'
                    }],
                    { 'Content-Range' : 'items 0-0/1' });
            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training/img1')
                .respond(200, pngArrayBuffer());

            var result = await settle(projectCloneService.exportProject(imageProject, profile));
            var archive = await readArchive(result.blob);

            expect(archive.training[0].isstored).toBe(true);
        });


        it('points sounds at a file inside the archive', async function () {
            var soundProject = {
                id : 'cloud1', userid : 'user1', classid : 'class1',
                name : 'Words', type : 'sounds', language : '',
                labels : [ 'yes', '_background_noise_' ],
                numfields : 0, fields : [], isCrowdSourced : false
            };

            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training')
                .respond(200,
                    [{ id : 'snd1', label : 'yes', audiourl : CLOUD_PROJECT_URL + '/sounds/snd1' }],
                    { 'Content-Range' : 'items 0-0/1' });
            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/sounds/snd1')
                .respond(200, [ 0.1, 0.2, 0.3 ]);

            var result = await settle(projectCloneService.exportProject(soundProject, profile));
            var archive = await readArchive(result.blob);

            expect(archive.training[0].audiourl).toBe('sounds/snd1.json');
            expect(archive.filenames).toContain('sounds/snd1.json');

            var spectrogram = JSON.parse(await archive.zip.file('sounds/snd1.json').async('string'));
            expect(spectrogram).toEqual([ 0.1, 0.2, 0.3 ]);
        });
    });


    // ==================================================================
    //  manifest
    // ==================================================================

    describe('manifest.json', function () {

        it('records the format version', async function () {
            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training')
                .respond(200, TEXT_TRAINING_CLOUD, { 'Content-Range' : 'items 0-1/2' });

            var result = await settle(projectCloneService.exportProject(cloudTextProject, profile));
            var archive = await readArchive(result.blob);

            expect(archive.manifest.formatversion).toBe(1);
            expect(archive.manifest.application).toBe('machinelearningforkids');
            expect(archive.manifest.exported).toEqual(jasmine.any(String));
        });


        it('names nobody', async function () {
            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training')
                .respond(200, TEXT_TRAINING_CLOUD, { 'Content-Range' : 'items 0-1/2' });

            var result = await settle(projectCloneService.exportProject(cloudTextProject, profile));
            var archive = await readArchive(result.blob);

            expect(archive.manifest.userid).toBeUndefined();
            expect(archive.manifest.exportedby).toBeUndefined();
        });
    });


    // ==================================================================
    //  the downloaded file
    // ==================================================================

    describe('the archive filename', function () {

        function exportNamed(name) {
            var project = angular.extend({}, cloudTextProject, { name : name });

            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training')
                .respond(200, [], { 'Content-Range' : 'items 0--1/0' });

            return settle(projectCloneService.exportProject(project, profile));
        }

        it('is based on the project name', async function () {
            var result = await exportNamed('Sentiment');
            expect(result.filename).toBe('Sentiment.zip');
        });

        it('strips characters that are not safe in a filename', async function () {
            // local project names are not validated at all, so they can hold
            //  anything the child typed - including a path separator
            var result = await exportNamed('my/project: cats?');
            expect(result.filename).toBe('myproject cats.zip');
        });

        it('falls back to a default when nothing usable survives', async function () {
            var result = await exportNamed('///');
            expect(result.filename).toBe('project.zip');
        });
    });


    // ==================================================================
    //  round trip
    // ==================================================================

    describe('round trip', function () {

        // import writes into browser storage, so a round trip test needs
        //  somewhere for it to write to. this stands in for IndexedDB well
        //  enough to assert what came back out
        var written;

        beforeEach(function () {
            written = { project : undefined, training : [] };

            browserStorageServiceMock.addProject.and.callFake(function (projectinfo) {
                written.project = angular.extend({ id : 99 }, projectinfo);
                return $q.resolve(written.project);
            });
            browserStorageServiceMock.bulkAddTrainingData.and.callFake(function (id, records) {
                written.training = records;
                return $q.resolve();
            });
        });


        it('restores a text project', async function () {
            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training')
                .respond(200, TEXT_TRAINING_CLOUD, { 'Content-Range' : 'items 0-1/2' });

            var exported = await settle(projectCloneService.exportProject(cloudTextProject, profile));
            var imported = await settle(projectCloneService.importProject(exported.blob, profile));

            expect(written.project.name).toBe('Sentiment');
            expect(written.project.type).toBe('text');
            expect(written.project.language).toBe('en');
            expect(written.project.labels).toEqual([ 'happy', 'sad' ]);

            expect(written.training).toEqual([
                { label : 'happy', textdata : 'this is great' },
                { label : 'sad',   textdata : 'this is awful' }
            ]);

            expect(imported.imported).toBe(2);
            expect(imported.skipped).toBe(0);
        });


        it('restores a numbers project with its fields in order', async function () {
            var numbersProject = {
                id : 'cloud1', userid : 'user1', classid : 'class1',
                name : 'Titanic', type : 'numbers', language : '',
                labels : [ 'survived' ], numfields : 2, fields : [], isCrowdSourced : false
            };

            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/fields')
                .respond(200, [
                    { name : 'age',   type : 'number' },
                    { name : 'class', type : 'multichoice', choices : [ 'first', 'second' ] }
                ]);
            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training')
                .respond(200,
                    [{ id : 'n1', label : 'survived', numberdata : [ 32, 1 ] }],
                    { 'Content-Range' : 'items 0-0/1' });

            var exported = await settle(projectCloneService.exportProject(numbersProject, profile));
            await settle(projectCloneService.importProject(exported.blob, profile));

            // multichoice training values are indices into choices, so a
            //  reordered field list silently corrupts every example
            expect(written.project.fields[0].name).toBe('age');
            expect(written.project.fields[1].name).toBe('class');
            expect(written.training[0].numberdata).toEqual([ 32, 1 ]);
        });


        it('restores a stored image as a blob', async function () {
            var imageProject = {
                id : 'cloud1', userid : 'user1', classid : 'class1',
                name : 'Animals', type : 'imgtfjs', language : '',
                labels : [ 'cat' ], numfields : 0, fields : [], isCrowdSourced : false
            };

            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training')
                .respond(200,
                    [{
                        id : 'img1', isstored : true, userid : 'user1', label : 'cat',
                        imageurl : CLOUD_PROJECT_URL + '/images/img1'
                    }],
                    { 'Content-Range' : 'items 0-0/1' });
            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training/img1')
                .respond(200, pngArrayBuffer());

            var exported = await settle(projectCloneService.exportProject(imageProject, profile));
            await settle(projectCloneService.importProject(exported.blob, profile));

            expect(written.training.length).toBe(1);
            expect(written.training[0].label).toBe('cat');
            expect(written.training[0].isstored).toBe(true);
            expect(written.training[0].imagedata instanceof Blob).toBe(true);
            expect(written.training[0].imagedata.type).toBe('image/png');
        });


        it('restores a sound as an inline spectrogram', async function () {
            var soundProject = {
                id : 'cloud1', userid : 'user1', classid : 'class1',
                name : 'Words', type : 'sounds', language : '',
                labels : [ 'yes', '_background_noise_' ],
                numfields : 0, fields : [], isCrowdSourced : false
            };

            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/training')
                .respond(200,
                    [{ id : 'snd1', label : 'yes', audiourl : CLOUD_PROJECT_URL + '/sounds/snd1' }],
                    { 'Content-Range' : 'items 0-0/1' });
            $httpBackend.expectGET(CLOUD_PROJECT_URL + '/sounds/snd1')
                .respond(200, [ 0.1, 0.2, 0.3 ]);

            var exported = await settle(projectCloneService.exportProject(soundProject, profile));
            await settle(projectCloneService.importProject(exported.blob, profile));

            expect(written.training[0].audiodata).toEqual([ 0.1, 0.2, 0.3 ]);
        });


        it('survives a local project going out and coming back', async function () {
            browserStorageServiceMock.getProject.and.returnValue($q.resolve(localTextProject));
            browserStorageServiceMock.getTrainingData.and.returnValue($q.resolve(TEXT_TRAINING_LOCAL));

            var exported = await settle(projectCloneService.exportProject(localTextProject, profile));
            await settle(projectCloneService.importProject(exported.blob, profile));

            expect(written.project.name).toBe('Sentiment');
            expect(written.training.length).toBe(2);
        });
    });
});
