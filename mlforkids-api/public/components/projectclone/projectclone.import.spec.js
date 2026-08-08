// Tests for importing a project archive.
//
// An archive is a file the child picked off their own computer, so it can be
//  anything at all. The line that matters is between "we cannot make a
//  coherent project from this file" - refuse it, create nothing, say why - and
//  "we cannot use this one training example" - skip it, count it, carry on.
//
// The other half of this file is what import refuses to take from the archive.
//  An imported project belongs to the child importing it and lives in their
//  browser, whatever the archive claims.

describe('importing a project archive', function () {

    var $httpBackend;
    var $q;
    var $rootScope;
    var projectCloneService;
    var browserStorageServiceMock;
    var loggerServiceMock;
    var storageServiceMock;
    var utilServiceMock;

    var profile;
    var written;


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
                catch (nothingToFlush) { /* expected */ }
                try {
                    $rootScope.$digest();
                }
                catch (alreadyInDigest) { /* expected */ }
                setTimeout(pump, 1);
            }());
        });
    }

    // resolves to the error a rejected import produced, failing the test if
    //  the import unexpectedly succeeded
    function importFailure(archive) {
        return settle(projectCloneService.importProject(archive, profile))
            .then(function () {
                fail('import should have been refused');
            },
            function (err) {
                return err;
            });
    }


    // ------------------------------------------------------------------
    //  building archives to import
    // ------------------------------------------------------------------

    var VALID_MANIFEST = {
        formatversion : 1,
        exported : '2026-08-08T12:00:00.000Z',
        application : 'machinelearningforkids'
    };

    var VALID_PROJECT = {
        id : 'projectid', userid : 'userid', classid : 'classid',
        type : 'text', name : 'Sentiment', labels : [ 'happy', 'sad' ],
        language : 'en', numfields : 0, fields : [], isCrowdSourced : false
    };

    var VALID_TRAINING = [
        { id : 'aaa', label : 'happy', textdata : 'this is great' },
        { id : 'bbb', label : 'sad',   textdata : 'this is awful' }
    ];

    // parts is { manifest, project, training, files } - any of which can be
    //  omitted to leave that file out, or given a string to write it raw
    function buildArchive(parts) {
        var zip = new JSZip();

        function write(name, value) {
            if (value === undefined) {
                return;
            }
            zip.file(name, typeof value === 'string' ? value : JSON.stringify(value));
        }

        write('manifest.json', parts.manifest);
        write('project.json', parts.project);
        write('training.json', parts.training);

        if (parts.files) {
            Object.keys(parts.files).forEach(function (path) {
                zip.file(path, parts.files[path]);
            });
        }

        return zip.generateAsync({ type : 'blob' });
    }

    function validArchive(overrides) {
        return buildArchive(angular.extend({
            manifest : VALID_MANIFEST,
            project : VALID_PROJECT,
            training : VALID_TRAINING
        }, overrides));
    }


    beforeEach(function () {
        profile = { user_id : 'user1', tenant : 'class1' };
        written = { project : undefined, training : [] };

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

        utilServiceMock.loadZipSupport.and.returnValue($q.resolve());
        browserStorageServiceMock.isSupported.and.returnValue($q.resolve(1));
        browserStorageServiceMock.sanitizeLabel.and.callFake(function (label) {
            return label.replace(/[^\w.]/g, '_').substring(0, 30);
        });
        storageServiceMock.getItem.and.returnValue(null);

        browserStorageServiceMock.addProject.and.callFake(function (projectinfo) {
            written.project = angular.extend({ id : 99 }, projectinfo);
            return $q.resolve(written.project);
        });
        browserStorageServiceMock.bulkAddTrainingData.and.callFake(function (id, records) {
            written.training = records;
            return $q.resolve();
        });
    });


    // ==================================================================
    //  refused outright
    // ==================================================================

    describe('archives that are refused', function () {

        it('refuses a file that is not a zip', async function () {
            var notazip = new Blob([ 'this is a picture of my cat' ], { type : 'text/plain' });

            await importFailure(notazip);

            expect(browserStorageServiceMock.addProject).not.toHaveBeenCalled();
        });


        it('refuses a zip with no manifest', async function () {
            var archive = await validArchive({ manifest : undefined });

            await importFailure(archive);

            expect(browserStorageServiceMock.addProject).not.toHaveBeenCalled();
        });


        it('refuses a zip with an unreadable manifest', async function () {
            var archive = await validArchive({ manifest : 'not json {{{' });

            await importFailure(archive);

            expect(browserStorageServiceMock.addProject).not.toHaveBeenCalled();
        });


        it('refuses an archive made by a newer version', async function () {
            // the whole reason formatversion exists. a clear refusal beats
            //  importing whichever half of a newer archive we still recognise
            var archive = await validArchive({
                manifest : angular.extend({}, VALID_MANIFEST, { formatversion : 2 })
            });

            var err = await importFailure(archive);

            expect(err.message).toContain('newer version');
            expect(browserStorageServiceMock.addProject).not.toHaveBeenCalled();
        });


        it('accepts an archive at the current format version', async function () {
            var archive = await validArchive({});

            var result = await settle(projectCloneService.importProject(archive, profile));

            expect(result.imported).toBe(2);
        });


        it('refuses a project type it cannot import', async function () {
            var archive = await validArchive({
                project : angular.extend({}, VALID_PROJECT, { type : 'language' }),
                training : []
            });

            await importFailure(archive);

            expect(browserStorageServiceMock.addProject).not.toHaveBeenCalled();
        });


        it('refuses an archive with no project', async function () {
            var archive = await validArchive({ project : undefined });

            await importFailure(archive);

            expect(browserStorageServiceMock.addProject).not.toHaveBeenCalled();
        });


        it('refuses an archive whose training index is not a list', async function () {
            var archive = await validArchive({ training : { happy : 'this is great' } });

            await importFailure(archive);

            expect(browserStorageServiceMock.addProject).not.toHaveBeenCalled();
        });


        it('refuses to import when the browser cannot store projects', async function () {
            browserStorageServiceMock.isSupported.and.returnValue($q.resolve(-1));

            var archive = await validArchive({});

            await importFailure(archive);

            expect(browserStorageServiceMock.addProject).not.toHaveBeenCalled();
        });
    });


    // ==================================================================
    //  tolerated, and counted
    // ==================================================================

    describe('examples that cannot be used', function () {

        it('skips a training row with no label', async function () {
            var archive = await validArchive({
                training : [
                    { id : 'aaa', label : 'happy', textdata : 'this is great' },
                    { id : 'bbb', textdata : 'this has no label' }
                ]
            });

            var result = await settle(projectCloneService.importProject(archive, profile));

            expect(result.imported).toBe(1);
            expect(result.skipped).toBe(1);
            expect(written.training).toEqual([
                { label : 'happy', textdata : 'this is great' }
            ]);
        });


        it('skips a numbers row whose numberdata is not a list', async function () {
            var archive = await validArchive({
                project : angular.extend({}, VALID_PROJECT, {
                    type : 'numbers', language : '', numfields : 1,
                    fields : [ { name : 'age', type : 'number' } ]
                }),
                training : [
                    { id : 'aaa', label : 'happy', numberdata : [ 1 ] },
                    { id : 'bbb', label : 'sad',   numberdata : 'seven' }
                ]
            });

            var result = await settle(projectCloneService.importProject(archive, profile));

            expect(result.imported).toBe(1);
            expect(result.skipped).toBe(1);
        });


        it('skips an image whose file is missing from the archive', async function () {
            var archive = await validArchive({
                project : angular.extend({}, VALID_PROJECT, {
                    type : 'imgtfjs', language : '', labels : [ 'cat' ]
                }),
                training : [
                    { id : 'img1', label : 'cat', imageurl : 'images/img1.png', isstored : true }
                ]
            });

            var result = await settle(projectCloneService.importProject(archive, profile));

            expect(result.imported).toBe(0);
            expect(result.skipped).toBe(1);
            // the project is still created - a missing image is not a reason
            //  to lose everything else in the archive
            expect(written.project.name).toBe('Sentiment');
        });


        it('skips a sound whose file is missing from the archive', async function () {
            var archive = await validArchive({
                project : angular.extend({}, VALID_PROJECT, {
                    type : 'sounds', language : '', labels : [ 'yes' ]
                }),
                training : [
                    { id : 'snd1', label : 'yes', audiourl : 'sounds/snd1.json' }
                ]
            });

            var result = await settle(projectCloneService.importProject(archive, profile));

            expect(result.imported).toBe(0);
            expect(result.skipped).toBe(1);
            expect(written.project).toBeDefined();
        });


        it('imports a project with no test data', async function () {
            var archive = await validArchive({});

            var result = await settle(projectCloneService.importProject(archive, profile));

            expect(result.testdata).toBe(false);
            expect(result.imported).toBe(2);
        });
    });


    // ==================================================================
    //  what import refuses to take from the archive
    // ==================================================================

    describe('the imported project', function () {

        it('is stored in the browser', async function () {
            var archive = await validArchive({});

            await settle(projectCloneService.importProject(archive, profile));

            expect(written.project.storage).toBe('local');
        });


        it('belongs to the child importing it', async function () {
            // browserStorageService.getProjects filters by userid in
            //  javascript - a project written without one is in IndexedDB but
            //  never appears in anybody's project list
            var archive = await validArchive({
                project : angular.extend({}, VALID_PROJECT, {
                    userid : 'someone-else', classid : 'another-class'
                })
            });

            await settle(projectCloneService.importProject(archive, profile));

            expect(written.project.userid).toBe('user1');
            expect(written.project.classid).toBe('class1');
        });


        it('is never shared with a class', async function () {
            // browser storage is single-user, so a shared project has no
            //  meaning there however the archive was made
            var archive = await validArchive({
                project : angular.extend({}, VALID_PROJECT, { isCrowdSourced : true })
            });

            await settle(projectCloneService.importProject(archive, profile));

            expect(written.project.isCrowdSourced).toBe(false);
        });


        it('has no cloud reference', async function () {
            var archive = await validArchive({
                project : angular.extend({}, VALID_PROJECT, { cloudid : 'abcd-1234' })
            });

            await settle(projectCloneService.importProject(archive, profile));

            expect(written.project.cloudid).toBeUndefined();
        });


        it('sanitises the labels it is given', async function () {
            // addProject writes whatever labels array it is handed, so an
            //  archive is the one way a label that addLabel would never allow
            //  can reach browser storage
            var archive = await validArchive({
                project : angular.extend({}, VALID_PROJECT, {
                    labels : [ 'happy face', 'sad, very sad' ]
                })
            });

            await settle(projectCloneService.importProject(archive, profile));

            expect(written.project.labels).toEqual([ 'happy_face', 'sad__very_sad' ]);
        });


        it('does not end up with two background noise labels', async function () {
            // addProject pushes _background_noise_ into every sounds project
            //  it creates, with no duplicate check
            var archive = await validArchive({
                project : angular.extend({}, VALID_PROJECT, {
                    type : 'sounds', language : '',
                    labels : [ 'yes', 'no', '_background_noise_' ]
                }),
                training : []
            });

            await settle(projectCloneService.importProject(archive, profile));

            expect(written.project.labels).toEqual([ 'yes', 'no' ]);
        });


        it('keeps the numbers fields in the order the archive had them', async function () {
            // multichoice training values are indices into choices, so a
            //  reordered field list silently corrupts every example
            var archive = await validArchive({
                project : angular.extend({}, VALID_PROJECT, {
                    type : 'numbers', language : '', numfields : 3,
                    fields : [
                        { name : 'age',    type : 'number' },
                        { name : 'class',  type : 'multichoice', choices : [ 'first', 'second' ] },
                        { name : 'onboard', type : 'number' }
                    ]
                }),
                training : []
            });

            await settle(projectCloneService.importProject(archive, profile));

            expect(written.project.fields.map(function (field) { return field.name; }))
                .toEqual([ 'age', 'class', 'onboard' ]);
        });


        it('does not rename a project just because the name is already in use', async function () {
            // names are not unique anywhere in the system - importing the same
            //  archive twice giving two projects with the same name is
            //  predictable, and mangling the name the child chose is not
            var archive = await validArchive({});

            await settle(projectCloneService.importProject(archive, profile));
            var firstname = written.project.name;

            var again = await validArchive({});
            await settle(projectCloneService.importProject(again, profile));

            expect(written.project.name).toBe(firstname);
            expect(browserStorageServiceMock.addProject).toHaveBeenCalledTimes(2);
        });


        it('restores test data under the new project id', async function () {
            // test data is keyed by project id and has exactly one copy, so it
            //  has to be re-keyed explicitly - no bulk read will pick it up
            var archive = await validArchive({
                files : { 'testdata.csv' : 'text,label\nhello,happy\n' }
            });

            var result = await settle(projectCloneService.importProject(archive, profile));

            expect(result.testdata).toBe(true);
            expect(storageServiceMock.setItem)
                .toHaveBeenCalledWith('testdata://99', 'text,label\nhello,happy\n');
        });


        it('still imports the project when the test data cannot be written', async function () {
            // localStorage is typically 5MB for everything, and is a no-op
            //  in-memory shim in Safari private mode
            storageServiceMock.setItem.and.throwError('QuotaExceededError');

            var archive = await validArchive({
                files : { 'testdata.csv' : 'text,label\nhello,happy\n' }
            });

            var result = await settle(projectCloneService.importProject(archive, profile));

            expect(result.testdata).toBe(false);
            expect(result.imported).toBe(2);
        });
    });
});
