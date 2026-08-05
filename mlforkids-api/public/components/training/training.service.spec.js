describe('trainingService', function () {

    // This service is the storage-routing layer: for almost every operation it
    //  decides between talking to the REST API (cloud projects) and talking to
    //  browserStorageService (local projects). These specs are mostly about
    //  verifying that routing, and the per-project-type reshaping that goes
    //  with it.

    var $httpBackend, $q, $rootScope;
    var trainingService;
    var browserStorageServiceMock;

    var TENANT = 'class1';
    var USERID = 'user1';

    beforeEach(function () {
        browserStorageServiceMock = jasmine.createSpyObj('browserStorageService', [
            'addTrainingData', 'bulkAddTrainingData', 'deleteTrainingData',
            'clearTrainingData', 'getTrainingData', 'getTrainingDataItem',
            'idIsLocal', 'addCloudRefToProject', 'getTrainingForWatsonAssistant',
            'storeAssetData', 'retrieveAsset'
        ]);

        module('app', function ($provide) {
            $provide.value('browserStorageService', browserStorageServiceMock);
        });

        inject(function (_$httpBackend_, _$q_, _$rootScope_, _trainingService_) {
            $httpBackend = _$httpBackend_;
            $q = _$q_;
            $rootScope = _$rootScope_;
            trainingService = _trainingService_;
        });
    });

    afterEach(function () {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });


    function localProject(attrs) {
        return Object.assign({
            id : 12, storage : 'local', type : 'text',
            userid : USERID, classid : TENANT, labels : ['alpha']
        }, attrs || {});
    }

    function cloudProject(attrs) {
        return Object.assign({
            id : 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', type : 'text',
            userid : USERID, classid : TENANT, labels : ['alpha']
        }, attrs || {});
    }

    function encodeJson(obj) {
        return new TextEncoder().encode(JSON.stringify(obj)).buffer;
    }


    // ------------------------------------------------------------------
    //  newTrainingData - one item at a time
    // ------------------------------------------------------------------

    describe('newTrainingData', function () {

        it('stores text for a local project in browser storage, without any API call', function () {
            browserStorageServiceMock.addTrainingData.and.returnValue($q.resolve({ id : 1 }));

            var result;
            trainingService.newTrainingData(12, USERID, TENANT, 'text', 'local', 'hello', 'alpha')
                .then(function (stored) { result = stored; });
            $rootScope.$digest();

            expect(browserStorageServiceMock.addTrainingData)
                .toHaveBeenCalledWith(12, { textdata : 'hello', label : 'alpha' });
            expect(result).toEqual({ id : 1 });
            // no $httpBackend expectation set - afterEach would fail on any request
        });

        it('replaces tabs and newlines in local text before storing', function () {
            browserStorageServiceMock.addTrainingData.and.returnValue($q.resolve({}));

            trainingService.newTrainingData(12, USERID, TENANT, 'text', 'local',
                                            'one\ttwo\nthree', 'alpha');
            $rootScope.$digest();

            expect(browserStorageServiceMock.addTrainingData)
                .toHaveBeenCalledWith(12, { textdata : 'one two three', label : 'alpha' });
        });

        it('stores numbers for a local project as an array', function () {
            browserStorageServiceMock.addTrainingData.and.returnValue($q.resolve({}));

            trainingService.newTrainingData(12, USERID, TENANT, 'numbers', 'local', [1, 2, 3], 'alpha');
            $rootScope.$digest();

            expect(browserStorageServiceMock.addTrainingData)
                .toHaveBeenCalledWith(12, { numberdata : [1, 2, 3], label : 'alpha' });
        });

        it('stores language project items with no label', function () {
            browserStorageServiceMock.addTrainingData.and.returnValue($q.resolve({}));

            trainingService.newTrainingData(12, USERID, TENANT, 'language', 'local', {
                type : 'story', title : 'A title', contents : 'Some contents'
            }, undefined);
            $rootScope.$digest();

            expect(browserStorageServiceMock.addTrainingData).toHaveBeenCalledWith(12, {
                type : 'story', title : 'A title', contents : 'Some contents'
            });
        });

        it('checks and resizes a local image via the API before storing it in the browser', function () {
            // the ONE case where a local project touches the REST API - the
            //  server validates and resizes, but stores nothing
            browserStorageServiceMock.addTrainingData.and.returnValue($q.resolve({ id : 7 }));

            var imagebytes = new Uint8Array([1, 2, 3]).buffer;

            $httpBackend.expectGET(/\/training\/images\?.*option=check/)
                .respond(200, { imageurl : 'http://example.com/cat.jpg', label : 'alpha', isstored : false });
            $httpBackend.expectGET(/\/training\/images\?.*option=prepare/)
                .respond(200, imagebytes);

            trainingService.newTrainingData(12, USERID, TENANT, 'imgtfjs', 'local',
                                            'http://example.com/cat.jpg', 'alpha');
            $httpBackend.flush();

            expect(browserStorageServiceMock.addTrainingData).toHaveBeenCalledWith(12, {
                imageurl : 'http://example.com/cat.jpg',
                label : 'alpha',
                isstored : false,
                imagedata : imagebytes
            });
        });

        it('does not store anything locally if the image check fails', function () {
            $httpBackend.expectGET(/\/training\/images\?.*option=check/)
                .respond(400, { error : 'Unsupported file type' });

            var failure;
            trainingService.newTrainingData(12, USERID, TENANT, 'imgtfjs', 'local',
                                            'http://example.com/cat.txt', 'alpha')
                .catch(function (err) { failure = err; });
            $httpBackend.flush();

            expect(failure.status).toBe(400);
            expect(browserStorageServiceMock.addTrainingData).not.toHaveBeenCalled();
        });

        it('throws for an unrecognised local project type', function () {
            expect(function () {
                trainingService.newTrainingData(12, USERID, TENANT, 'nonsense', 'local', 'data', 'alpha');
            }).toThrowError('unexpected project type');
        });

        it('posts to the training API for a cloud project', function () {
            var projectid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

            $httpBackend.expectPOST(
                '/api/classes/class1/students/user1/projects/' + projectid + '/training',
                { data : 'hello', label : 'alpha' })
                .respond(201, { id : 'trainingid', textdata : 'hello' });

            var result;
            trainingService.newTrainingData(projectid, USERID, TENANT, 'text', 'cloud', 'hello', 'alpha')
                .then(function (stored) { result = stored; });
            $httpBackend.flush();

            expect(result.id).toBe('trainingid');
            expect(browserStorageServiceMock.addTrainingData).not.toHaveBeenCalled();
        });

        it('posts sounds through the same API path for cloud projects', function () {
            // note: the training API rejects sounds with a 501, which is why
            //  the sounds UI calls uploadSound instead - see uploadSound below
            var projectid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

            $httpBackend.expectPOST(
                '/api/classes/class1/students/user1/projects/' + projectid + '/training')
                .respond(501, { error : 'Not implemented' });

            var failure;
            trainingService.newTrainingData(projectid, USERID, TENANT, 'sounds', 'cloud', [0.1], 'alpha')
                .catch(function (err) { failure = err; });
            $httpBackend.flush();

            expect(failure.status).toBe(501);
        });
    });


    // ------------------------------------------------------------------
    //  bulkAddTrainingData - dataset import and file upload
    // ------------------------------------------------------------------

    describe('bulkAddTrainingData', function () {

        it('refuses to bulk add to a cloud project', function () {
            expect(function () {
                trainingService.bulkAddTrainingData(cloudProject(), [], USERID, TENANT);
            }).toThrowError('unexpected project type');
        });

        it('strips tabs and newlines from every text item', function () {
            browserStorageServiceMock.bulkAddTrainingData.and.returnValue($q.resolve([]));

            trainingService.bulkAddTrainingData(localProject({ type : 'text' }), [
                { textdata : 'one\ttwo', label : 'alpha' },
                { textdata : 'three\nfour', label : 'beta' }
            ], USERID, TENANT);
            $rootScope.$digest();

            expect(browserStorageServiceMock.bulkAddTrainingData).toHaveBeenCalledWith(12, [
                { textdata : 'one two', label : 'alpha' },
                { textdata : 'three four', label : 'beta' }
            ]);
        });

        it('converts multichoice values to their index in the field choices', function () {
            // this is the contract between the two storage worlds: multichoice
            //  training values are stored as indices, so the order of
            //  project.fields[].choices is load-bearing
            browserStorageServiceMock.bulkAddTrainingData.and.returnValue($q.resolve([]));

            var project = localProject({
                type : 'numbers',
                fields : [
                    { name : 'height', type : 'number' },
                    { name : 'colour', type : 'multichoice', choices : ['red', 'green', 'blue'] }
                ]
            });

            trainingService.bulkAddTrainingData(project, {
                label : 'alpha',
                numbers : [
                    { height : 100, colour : 'green' },
                    { height : 200, colour : 'red' }
                ]
            }, USERID, TENANT);
            $rootScope.$digest();

            expect(browserStorageServiceMock.bulkAddTrainingData).toHaveBeenCalledWith(12, [
                { numberdata : [100, 1], label : 'alpha' },
                { numberdata : [200, 0], label : 'alpha' }
            ]);
        });

        it('orders number values to match the project field order, not the CSV column order', function () {
            browserStorageServiceMock.bulkAddTrainingData.and.returnValue($q.resolve([]));

            var project = localProject({
                type : 'numbers',
                fields : [
                    { name : 'first', type : 'number' },
                    { name : 'second', type : 'number' }
                ]
            });

            // object keys deliberately in the opposite order
            trainingService.bulkAddTrainingData(project, {
                label : 'alpha',
                numbers : [ { second : 22, first : 11 } ]
            }, USERID, TENANT);
            $rootScope.$digest();

            expect(browserStorageServiceMock.bulkAddTrainingData)
                .toHaveBeenCalledWith(12, [ { numberdata : [11, 22], label : 'alpha' } ]);
        });

        it('passes regression rows through unchanged', function () {
            browserStorageServiceMock.bulkAddTrainingData.and.returnValue($q.resolve([]));

            var rows = [ { height : 1, weight : 2 }, { height : 3, weight : 4 } ];
            trainingService.bulkAddTrainingData(localProject({ type : 'regression' }), rows, USERID, TENANT);
            $rootScope.$digest();

            expect(browserStorageServiceMock.bulkAddTrainingData).toHaveBeenCalledWith(12, rows);
        });

        it('keeps only the recognised fields of language items', function () {
            browserStorageServiceMock.bulkAddTrainingData.and.returnValue($q.resolve([]));

            trainingService.bulkAddTrainingData(localProject({ type : 'language' }), [
                { type : 'story', title : 'T', contents : 'C', somethingelse : 'dropped' }
            ], USERID, TENANT);
            $rootScope.$digest();

            expect(browserStorageServiceMock.bulkAddTrainingData)
                .toHaveBeenCalledWith(12, [ { type : 'story', title : 'T', contents : 'C' } ]);
        });

        it('requests every image CONCURRENTLY, not one at a time', function () {
            // bulkAddTrainingData uses $q.all over the images, so all the
            //  "check" calls go out before any "prepare" call. Worth knowing
            //  for anything that imports a lot of images at once: a 250-image
            //  project fires 250 concurrent checks, then 250 concurrent
            //  prepares, with no batching or throttling anywhere.
            browserStorageServiceMock.addTrainingData.and.returnValue($q.resolve({ id : 1 }));

            var order = [];
            $httpBackend.whenGET(/option=check/).respond(function () {
                order.push('check');
                return [200, { imageurl : 'x', label : 'alpha' }];
            });
            $httpBackend.whenGET(/option=prepare/).respond(function () {
                order.push('prepare');
                return [200, new Uint8Array([1]).buffer];
            });

            trainingService.bulkAddTrainingData(localProject({ type : 'imgtfjs' }), [
                { imageurl : 'a', label : 'alpha' },
                { imageurl : 'b', label : 'beta' }
            ], USERID, TENANT);
            $httpBackend.flush();

            expect(order).toEqual(['check', 'check', 'prepare', 'prepare']);
            expect(browserStorageServiceMock.addTrainingData.calls.count()).toBe(2);
        });

        it('throws for an unrecognised local project type', function () {
            expect(function () {
                trainingService.bulkAddTrainingData(localProject({ type : 'nonsense' }), [], USERID, TENANT);
            }).toThrowError('unexpected project type');
        });
    });


    // ------------------------------------------------------------------
    //  deleting
    // ------------------------------------------------------------------

    describe('deleteTrainingData', function () {

        it('deletes from browser storage when the project id is local', function () {
            browserStorageServiceMock.idIsLocal.and.returnValue(true);
            browserStorageServiceMock.deleteTrainingData.and.returnValue($q.resolve());

            trainingService.deleteTrainingData(12, USERID, TENANT, 34);
            $rootScope.$digest();

            expect(browserStorageServiceMock.deleteTrainingData).toHaveBeenCalledWith(12, 34);
        });

        it('calls the API when the project id is not local', function () {
            browserStorageServiceMock.idIsLocal.and.returnValue(false);
            var projectid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

            $httpBackend.expectDELETE(
                '/api/classes/class1/students/user1/projects/' + projectid + '/training/trainingid')
                .respond(204);

            trainingService.deleteTrainingData(projectid, USERID, TENANT, 'trainingid');
            $httpBackend.flush();

            expect(browserStorageServiceMock.deleteTrainingData).not.toHaveBeenCalled();
        });
    });


    describe('clearTrainingData', function () {

        it('clears browser storage for a local regression project', function () {
            browserStorageServiceMock.clearTrainingData.and.returnValue($q.resolve());

            trainingService.clearTrainingData(localProject({ type : 'regression' }));
            $rootScope.$digest();

            expect(browserStorageServiceMock.clearTrainingData).toHaveBeenCalledWith(12);
        });

        it('refuses to clear a cloud project', function () {
            expect(function () {
                trainingService.clearTrainingData(cloudProject({ type : 'regression' }));
            }).toThrowError('unexpected project type');
        });

        it('refuses to clear a local project that is not a regression project', function () {
            expect(function () {
                trainingService.clearTrainingData(localProject({ type : 'text' }));
            }).toThrowError('unexpected project type');
        });
    });


    // ------------------------------------------------------------------
    //  reading training data
    // ------------------------------------------------------------------

    describe('getTraining', function () {

        it('reads local training data from browser storage', function () {
            browserStorageServiceMock.idIsLocal.and.returnValue(true);
            browserStorageServiceMock.getTrainingData.and.returnValue($q.resolve([
                { id : 1, textdata : 'one', label : 'alpha' }
            ]));

            var result;
            trainingService.getTraining(12, USERID, TENANT).then(function (items) { result = items; });
            $rootScope.$digest();

            expect(result).toEqual([{ id : 1, textdata : 'one', label : 'alpha' }]);
        });

        it('creates a displayable url for locally stored image blobs', function () {
            browserStorageServiceMock.idIsLocal.and.returnValue(true);
            var blob = new Blob([new Uint8Array([1, 2, 3])], { type : 'image/jpeg' });
            browserStorageServiceMock.getTrainingData.and.returnValue($q.resolve([
                { id : 1, imagedata : blob, isstored : true, label : 'alpha' }
            ]));

            var result;
            trainingService.getTraining(12, USERID, TENANT).then(function (items) { result = items; });
            $rootScope.$digest();

            expect(result[0].imageurl).toMatch(/^blob:/);
            URL.revokeObjectURL(result[0].imageurl);
        });

        it('leaves an existing image url alone', function () {
            browserStorageServiceMock.idIsLocal.and.returnValue(true);
            browserStorageServiceMock.getTrainingData.and.returnValue($q.resolve([
                { id : 1, imageurl : 'http://example.com/cat.jpg', imagedata : new Blob(['x']), label : 'alpha' }
            ]));

            var result;
            trainingService.getTraining(12, USERID, TENANT).then(function (items) { result = items; });
            $rootScope.$digest();

            expect(result[0].imageurl).toBe('http://example.com/cat.jpg');
        });

        it('asks the API for a large page of training data for a cloud project', function () {
            browserStorageServiceMock.idIsLocal.and.returnValue(false);
            var projectid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

            // the API defaults to only 50 items without this header
            $httpBackend.expectGET(
                '/api/classes/class1/students/user1/projects/' + projectid + '/training',
                function (headers) {
                    return headers.Range === 'items=0-3000';
                })
                .respond(200, [{ id : 'a' }]);

            var result;
            trainingService.getTraining(projectid, USERID, TENANT).then(function (items) { result = items; });
            $httpBackend.flush();

            expect(result).toEqual([{ id : 'a' }]);
        });
    });


    describe('getTrainingItem', function () {

        it('reads a local item from browser storage', function () {
            browserStorageServiceMock.idIsLocal.and.returnValue(true);
            browserStorageServiceMock.getTrainingDataItem.and.returnValue($q.resolve({ id : 3 }));

            trainingService.getTrainingItem(12, USERID, TENANT, 3);
            $rootScope.$digest();

            expect(browserStorageServiceMock.getTrainingDataItem).toHaveBeenCalledWith(12, 3);
        });

        it('decodes a JSON error body that arrives as an arraybuffer', function () {
            // the request asks for an arraybuffer, so an error payload needs
            //  decoding before the caller can read err.data.error
            browserStorageServiceMock.idIsLocal.and.returnValue(false);
            var projectid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

            $httpBackend.expectGET(
                '/api/classes/class1/students/user1/projects/' + projectid + '/training/img1')
                .respond(409, encodeJson({ code : 'MLMOD12', error : 'One of your training images could not be downloaded' }));

            var failure;
            trainingService.getTrainingItem(projectid, USERID, TENANT, 'img1')
                .catch(function (err) { failure = err; });
            $httpBackend.flush();

            expect(failure.data.code).toBe('MLMOD12');
            expect(failure.data.error).toBe('One of your training images could not be downloaded');
        });
    });


    describe('getSoundData', function () {

        it('returns a sound that already has its data, without fetching', function () {
            var sound = { id : 1, audiodata : [0.1, 0.2] };

            var result;
            trainingService.getSoundData(sound).then(function (value) { result = value; });
            $rootScope.$digest();

            expect(result).toBe(sound);
        });

        it('fetches the spectrogram for a cloud sound and attaches it', function () {
            var sound = { id : 1, audiourl : '/api/classes/class1/students/user1/projects/p1/sounds/s1' };

            $httpBackend.expectGET(sound.audiourl).respond(200, [0.5, 0.6]);

            trainingService.getSoundData(sound);
            $httpBackend.flush();

            expect(sound.audiodata).toEqual([0.5, 0.6]);
        });
    });


    // ------------------------------------------------------------------
    //  models - included because the cloud reference lifecycle lives here
    // ------------------------------------------------------------------

    describe('getModels', function () {

        it('returns nothing for a local project that is not a text project', function () {
            var result;
            trainingService.getModels(localProject({ type : 'imgtfjs' }), USERID, TENANT)
                .then(function (models) { result = models; });
            $rootScope.$digest();

            expect(result).toEqual([]);
        });

        it('returns nothing for a local text project with no cloud reference yet', function () {
            var result;
            trainingService.getModels(localProject({ type : 'text' }), USERID, TENANT)
                .then(function (models) { result = models; });
            $rootScope.$digest();

            expect(result).toEqual([]);
        });

        it('asks the localprojects API when a local text project has a cloud reference', function () {
            $httpBackend.expectGET(
                '/api/classes/class1/students/user1/localprojects/cloud-1/models')
                .respond(200, [{ classifierid : 'c1' }]);

            var result;
            trainingService.getModels(localProject({ cloudid : 'cloud-1' }), USERID, TENANT)
                .then(function (models) { result = models; });
            $httpBackend.flush();

            expect(result.length).toBe(1);
            expect(result[0].lastPollTime).toEqual(jasmine.any(Date));
        });

        it('asks the projects API for a cloud project', function () {
            var project = cloudProject();

            $httpBackend.expectGET(
                '/api/classes/class1/students/user1/projects/' + project.id + '/models')
                .respond(200, [{ classifierid : 'c1' }]);

            trainingService.getModels(project, USERID, TENANT);
            $httpBackend.flush();
        });

        it('clears the expired cloud reference and returns nothing when the localprojects API fails', function () {
            browserStorageServiceMock.addCloudRefToProject.and.returnValue($q.resolve());
            var project = localProject({ cloudid : 'cloud-1' });

            $httpBackend.expectGET(
                '/api/classes/class1/students/user1/localprojects/cloud-1/models')
                .respond(404, { error : 'Not found' });

            var result;
            trainingService.getModels(project, USERID, TENANT).then(function (models) { result = models; });
            $httpBackend.flush();

            expect(result).toEqual([]);
            expect(browserStorageServiceMock.addCloudRefToProject).toHaveBeenCalledWith(12, null);
            expect(project.cloudid).toBeUndefined();
        });

        it('propagates a failure for a cloud project instead of swallowing it', function () {
            var project = cloudProject();

            $httpBackend.expectGET(
                '/api/classes/class1/students/user1/projects/' + project.id + '/models')
                .respond(500, { error : 'Server error' });

            var failure;
            trainingService.getModels(project, USERID, TENANT).catch(function (err) { failure = err; });
            $httpBackend.flush();

            expect(failure.status).toBe(500);
            expect(browserStorageServiceMock.addCloudRefToProject).not.toHaveBeenCalled();
        });
    });


    describe('newLocalProjectTextModel', function () {

        it('sends the training data with the request, because the server does not have it', function () {
            var payload = { name : 'p', language : 'en', intents : [], dialog_nodes : [] };
            browserStorageServiceMock.getTrainingForWatsonAssistant.and.returnValue($q.resolve(payload));

            $httpBackend.expectPOST(
                '/api/classes/class1/students/user1/localprojects/cloud-1/models',
                { training : payload })
                .respond(201, { classifierid : 'c1' });

            var result;
            trainingService.newLocalProjectTextModel(localProject({ cloudid : 'cloud-1' }))
                .then(function (model) { result = model; });
            $httpBackend.flush();

            expect(result.classifierid).toBe('c1');
            expect(result.lastPollTime).toEqual(jasmine.any(Date));
        });

        it('clears the cloud reference and rethrows when it has expired', function () {
            browserStorageServiceMock.getTrainingForWatsonAssistant.and.returnValue($q.resolve({}));
            browserStorageServiceMock.addCloudRefToProject.and.returnValue($q.resolve());
            var project = localProject({ cloudid : 'cloud-1' });

            $httpBackend.expectPOST(
                '/api/classes/class1/students/user1/localprojects/cloud-1/models')
                .respond(404, { error : 'Not found' });

            var failure;
            trainingService.newLocalProjectTextModel(project).catch(function (err) { failure = err; });
            $httpBackend.flush();

            expect(failure.status).toBe(404);
            expect(browserStorageServiceMock.addCloudRefToProject).toHaveBeenCalledWith(12, null);
            expect(project.cloudid).toBeUndefined();
        });
    });


    describe('newLocalProjectNumbersModel', function () {

        it('sends the project definition and the training data together', function () {
            var training = [ { numberdata : [1, 2], label : 'alpha' } ];
            browserStorageServiceMock.getTrainingData.and.returnValue($q.resolve(training));
            browserStorageServiceMock.addCloudRefToProject.and.returnValue($q.resolve());
            var project = localProject({ type : 'numbers' });

            $httpBackend.expectPOST(
                '/api/classes/class1/students/user1/localnumbersprojects',
                { project : project, training : training })
                .respond(201, { key : 'user1-12', urls : {} });

            var result;
            trainingService.newLocalProjectNumbersModel(project).then(function (model) { result = model; });
            $httpBackend.flush();

            expect(result.key).toBe('user1-12');
            expect(result.lastPollTime).toEqual(jasmine.any(Date));
        });

        // REGRESSION TEST
        //
        // newLocalProjectNumbersModel() used to do:
        //     browserStorageService.addCloudRefToProject(project.id, resp.data.key)
        //     project.cloudid = resp.key;
        //
        // `resp` is the $http response object, so `resp.key` was undefined -
        //  it should have been `resp.data.key`, as used on the line above. The
        //  value reached browser storage correctly, but the in-memory project
        //  object kept cloudid === undefined until the page was reloaded, so
        //  anything reading it later in the same page-load (notably
        //  scratchkeysService.getScratchKeys) would mint a second, redundant
        //  cloud reference.
        //
        // Both the stored value and the in-memory value are asserted below.
        it('records the returned model key as the project\'s cloud reference', function () {
            browserStorageServiceMock.getTrainingData.and.returnValue($q.resolve([]));
            browserStorageServiceMock.addCloudRefToProject.and.returnValue($q.resolve());
            var project = localProject({ type : 'numbers' });

            $httpBackend.expectPOST('/api/classes/class1/students/user1/localnumbersprojects')
                .respond(201, { key : 'user1-12' });

            trainingService.newLocalProjectNumbersModel(project);
            $httpBackend.flush();

            expect(browserStorageServiceMock.addCloudRefToProject).toHaveBeenCalledWith(12, 'user1-12');
            expect(project.cloudid).toBe('user1-12');
        });
    });


    describe('testModel', function () {

        it('tests a local project model through the localprojects API', function () {
            $httpBackend.expectPOST(
                '/api/classes/class1/students/user1/localprojects/cloud-1/models/m1/label',
                { text : 'hello', credentialsid : 'creds1' })
                .respond(200, []);

            trainingService.testModel(localProject({ cloudid : 'cloud-1' }), USERID, TENANT,
                                      'm1', 'creds1', { text : 'hello' });
            $httpBackend.flush();
        });

        it('tests a cloud project model through the projects API', function () {
            var project = cloudProject();

            $httpBackend.expectPOST(
                '/api/classes/class1/students/user1/projects/' + project.id + '/models/m1/label',
                { text : 'hello', credentialsid : 'creds1' })
                .respond(200, []);

            trainingService.testModel(project, USERID, TENANT, 'm1', 'creds1', { text : 'hello' });
            $httpBackend.flush();
        });
    });


    describe('deleteModel', function () {

        it('deletes a local project model using the cloud reference', function () {
            $httpBackend.expectDELETE(
                '/api/classes/class1/students/user1/localprojects/cloud-1/models/m1')
                .respond(204);

            trainingService.deleteModel(localProject({ cloudid : 'cloud-1' }), USERID, TENANT, 'm1');
            $httpBackend.flush();
        });

        it('deletes a cloud project model under the project OWNER\'s id, not the caller\'s', function () {
            // deliberate asymmetry with the local branch above, which uses the
            //  userid argument. It matters for crowd-sourced projects, where
            //  the caller is not the owner - the model belongs to the owner.
            var project = cloudProject({ userid : 'teacher1' });

            $httpBackend.expectDELETE(
                '/api/classes/class1/students/teacher1/projects/' + project.id + '/models/m1')
                .respond(204);

            trainingService.deleteModel(project, 'student9', TENANT, 'm1');
            $httpBackend.flush();
        });
    });


    // ------------------------------------------------------------------
    //  assets
    // ------------------------------------------------------------------

    describe('assets', function () {

        it('stores a language model asset under a project-scoped key', function () {
            browserStorageServiceMock.storeAssetData.and.returnValue($q.resolve());
            var asset = new Blob(['model']);

            trainingService.storeAsset(localProject({ type : 'language' }), asset);

            expect(browserStorageServiceMock.storeAssetData)
                .toHaveBeenCalledWith('language-model-12', asset);
        });

        it('retrieves a language model asset', function () {
            browserStorageServiceMock.retrieveAsset.and.returnValue($q.resolve(new Blob(['model'])));

            trainingService.retrieveAsset(localProject({ type : 'language' }));

            expect(browserStorageServiceMock.retrieveAsset).toHaveBeenCalledWith('language-model-12');
        });

        it('refuses to store assets for other project types', function () {
            expect(function () {
                trainingService.storeAsset(localProject({ type : 'text' }), new Blob(['x']));
            }).toThrowError('Unsupported project type');
        });

        it('refuses to store assets for cloud projects', function () {
            expect(function () {
                trainingService.storeAsset(cloudProject({ type : 'language' }), new Blob(['x']));
            }).toThrowError('Unsupported project type');
        });
    });


    // ------------------------------------------------------------------
    //  binary uploads
    // ------------------------------------------------------------------

    describe('uploadImage', function () {

        it('stores the blob directly in browser storage for a local project', function () {
            var blob = new Blob([new Uint8Array([1, 2, 3])], { type : 'image/jpeg' });
            browserStorageServiceMock.addTrainingData.and.callFake(function (id, item) {
                return $q.resolve(Object.assign({ id : 5 }, item));
            });

            var result;
            trainingService.uploadImage(localProject({ type : 'imgtfjs' }), USERID, TENANT, blob, 'alpha')
                .then(function (item) { result = item; });
            $rootScope.$digest();

            expect(browserStorageServiceMock.addTrainingData).toHaveBeenCalledWith(12, {
                imagedata : blob, isstored : true, label : 'alpha'
            });
            expect(result.imageurl).toMatch(/^blob:/);
            URL.revokeObjectURL(result.imageurl);
        });

        it('posts the image as multipart form data for a cloud project', function () {
            var project = cloudProject({ type : 'imgtfjs' });
            var blob = new Blob([new Uint8Array([1, 2, 3])], { type : 'image/jpeg' });

            $httpBackend.expectPOST(
                '/api/classes/class1/students/user1/projects/' + project.id + '/images',
                function (data) {
                    return data instanceof FormData &&
                           data.get('label') === 'alpha' &&
                           data.get('image') instanceof Blob;
                })
                .respond(201, { id : 'imgid' });

            var result;
            trainingService.uploadImage(project, USERID, TENANT, blob, 'alpha')
                .then(function (item) { result = item; });
            $httpBackend.flush();

            expect(result.id).toBe('imgid');
            expect(browserStorageServiceMock.addTrainingData).not.toHaveBeenCalled();
        });
    });


    describe('uploadSound', function () {

        it('stores the spectrogram in browser storage for a local project', function () {
            browserStorageServiceMock.addTrainingData.and.returnValue($q.resolve({ id : 5 }));

            trainingService.uploadSound(12, USERID, TENANT, 'sounds', 'local', [0.1, 0.2], 'alpha');
            $rootScope.$digest();

            expect(browserStorageServiceMock.addTrainingData).toHaveBeenCalledWith(12, {
                audiodata : [0.1, 0.2], label : 'alpha'
            });
        });

        it('posts to the dedicated sounds API for a cloud project', function () {
            var projectid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

            $httpBackend.expectPOST(
                '/api/classes/class1/students/user1/projects/' + projectid + '/sounds',
                { data : [0.1, 0.2], label : 'alpha' })
                .respond(201, { id : 'soundid' });

            trainingService.uploadSound(projectid, USERID, TENANT, 'sounds', 'cloud', [0.1, 0.2], 'alpha');
            $httpBackend.flush();
        });
    });


    // ------------------------------------------------------------------
    //  teacher-facing classifier management
    // ------------------------------------------------------------------

    describe('bluemix classifiers', function () {

        it('lists unmanaged classifiers for a class', function () {
            $httpBackend.expectGET('/api/classes/class1/classifiers?type=unmanaged')
                .respond(200, [{ id : 'c1' }]);

            var result;
            trainingService.getUnmanagedClassifiers(TENANT).then(function (items) { result = items; });
            $httpBackend.flush();

            expect(result).toEqual([{ id : 'c1' }]);
        });

        it('deletes a classifier with its credentials and type', function () {
            $httpBackend.expectDELETE(
                '/api/classes/class1/classifiers/c1?credentialsid=creds1&type=text')
                .respond(204);

            trainingService.deleteBluemixClassifier(TENANT, 'c1', 'creds1', 'text');
            $httpBackend.flush();
        });
    });

});
