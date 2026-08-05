describe('browserStorageService', function () {

    // NOTE ON THIS SPEC
    //
    // Unlike the controller specs, this one runs against the *real* IndexedDB
    //  in the headless browser. That is deliberate - the whole point of this
    //  file is to verify the storage behaviour itself, and a mocked IndexedDB
    //  would only be testing our idea of how IndexedDB works.
    //
    // Two consequences:
    //
    // 1. The service is almost entirely native async/await, not $q. So specs
    //    are `async` functions that await the service directly, and there is
    //    no $digest pumping. The "always use $q" rule in FRONTEND_TESTING.md
    //    applies to $digest-driven controllers - it does not apply here, and
    //    following it would actually deadlock (a $q promise awaited from a
    //    native async function never settles without a digest).
    //
    // 2. The database NAMES are hard-coded in the service, so specs cannot get
    //    isolation by using their own database. Deleting the shared databases
    //    between tests does not work either - the previous test's service
    //    instance still holds an open handle, so deleteDatabase() blocks.
    //    Instead every test isolates itself by using a UNIQUE userid (and
    //    unique asset keys), and asserts only on its own data. Project ids
    //    auto-increment, so each project gets a fresh training database for
    //    free.

    var browserStorageService;
    var $rootScope, $timeout;
    var loggerServiceMock, cleanupServiceMock, readersServiceMock, $httpMock;

    // unique per test, so tests never see each other's projects
    var useridCounter = 0;
    var userid;

    beforeEach(function () {
        useridCounter += 1;
        userid = 'test-user-' + Date.now() + '-' + useridCounter;

        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error', 'warn']);
        cleanupServiceMock = jasmine.createSpyObj('cleanupService', ['deleteProject']);
        readersServiceMock = jasmine.createSpyObj('readersService', ['createFileReader']);
        readersServiceMock.createFileReader.and.callFake(function () {
            return new FileReader();
        });

        // the service awaits $http directly from a native async function, so
        //  the mock has to return a NATIVE promise - a $q promise would never
        //  settle without a digest
        $httpMock = jasmine.createSpyObj('$http', ['get']);

        module('app', function ($provide) {
            $provide.value('loggerService', loggerServiceMock);
            $provide.value('cleanupService', cleanupServiceMock);
            $provide.value('readersService', readersServiceMock);
            $provide.value('$http', $httpMock);
        });

        inject(function (_browserStorageService_, _$rootScope_, _$timeout_) {
            browserStorageService = _browserStorageService_;
            $rootScope = _$rootScope_;
            $timeout = _$timeout_;
        });
    });


    // ------------------------------------------------------------------
    //  helpers
    // ------------------------------------------------------------------

    function newProject(attrs) {
        return Object.assign({
            name : 'test project',
            type : 'text',
            storage : 'local',
            userid : userid,
            classid : 'test-class',
            labels : ['alpha', 'beta']
        }, attrs || {});
    }

    function databaseExists(name) {
        return window.indexedDB.databases().then(function (dbs) {
            return dbs.some(function (db) { return db.name === name; });
        });
    }

    // deleteProject() deletes the training database without closing its own
    //  open handle first - the delete only completes once the connection's
    //  onversionchange handler has fired and closed it. So this is
    //  asynchronous even after deleteProject() has resolved.
    async function waitForDatabaseToGo(name) {
        for (var i = 0; i < 50; i++) {
            if (!(await databaseExists(name))) {
                return true;
            }
            await new Promise(function (resolve) { setTimeout(resolve, 20); });
        }
        return false;
    }

    async function expectRejection(promise) {
        var err;
        try {
            await promise;
        }
        catch (caught) {
            err = caught;
        }
        expect(err).toBeDefined();
        return err;
    }


    // ------------------------------------------------------------------
    //  pure helpers
    // ------------------------------------------------------------------

    describe('idIsLocal', function () {

        it('treats auto-increment integer ids as local', function () {
            expect(browserStorageService.idIsLocal(1)).toBe(true);
            expect(browserStorageService.idIsLocal(42)).toBe(true);
            expect(browserStorageService.idIsLocal('42')).toBe(true);
        });

        it('treats uuids as not local', function () {
            expect(browserStorageService.idIsLocal('e5cf0e4e-3a1e-4a5d-9f6c-8b3a0f1d2c4e')).toBe(false);
        });

        it('treats an id that merely starts with digits as not local', function () {
            // parseInt('12ab') is 12, which must not round-trip back to '12ab'
            expect(browserStorageService.idIsLocal('12ab')).toBe(false);
        });
    });


    describe('sanitizeLabel', function () {

        it('replaces characters that Watson Assistant rejects', function () {
            expect(browserStorageService.sanitizeLabel('hello world')).toBe('hello_world');
            expect(browserStorageService.sanitizeLabel('a-b/c!')).toBe('a_b_c_');
        });

        it('keeps word characters and full stops', function () {
            expect(browserStorageService.sanitizeLabel('label.One_2')).toBe('label.One_2');
        });

        it('truncates to the 30 character maximum', function () {
            var long = 'abcdefghijklmnopqrstuvwxyz0123456789';
            expect(browserStorageService.sanitizeLabel(long).length).toBe(30);
        });
    });


    describe('isSupported', function () {

        // The support probe runs asynchronously when the service is created
        //  (it opens a throwaway database and tries to put() a Blob in it), so
        //  a spec has to let real time pass before the answer is known.
        //  $timeout.flush() alone is not enough - it resolves isSupported()'s
        //  internal wait immediately, while the probe is still in flight, and
        //  observes SUPPORTED_UNKNOWN.
        async function waitForSupportAnswer() {
            var result;
            for (var attempt = 0; attempt < 50; attempt++) {
                result = undefined;
                browserStorageService.isSupported().then(function (value) { result = value; });
                try {
                    $timeout.flush();
                }
                catch (noPendingTimeout) {
                    // support was already known - nothing pending to flush
                }
                $rootScope.$digest();

                if (result === 1) {
                    return result;
                }
                await new Promise(function (resolve) { setTimeout(resolve, 20); });
            }
            return result;
        }

        it('reports that IndexedDB with Blob storage is available', async function () {
            expect(await waitForSupportAnswer()).toBe(1);
        });
    });


    // ------------------------------------------------------------------
    //  projects
    // ------------------------------------------------------------------

    describe('projects', function () {

        it('assigns an auto-increment integer id when adding a project', async function () {
            var stored = await browserStorageService.addProject(newProject());

            expect(typeof stored.id).toBe('number');
            expect(browserStorageService.idIsLocal(stored.id)).toBe(true);
        });

        it('defaults labels to an empty array when none are provided', async function () {
            var stored = await browserStorageService.addProject(newProject({ labels : undefined }));

            expect(stored.labels).toEqual([]);
        });

        it('adds the background noise label to sounds projects', async function () {
            var stored = await browserStorageService.addProject(newProject({
                type : 'sounds',
                labels : ['woof']
            }));

            expect(stored.labels).toEqual(['woof', '_background_noise_']);
        });

        it('retrieves a stored project, accepting the id as a string', async function () {
            var stored = await browserStorageService.addProject(newProject({ name : 'findme' }));

            var fetched = await browserStorageService.getProject(String(stored.id));

            expect(fetched.name).toBe('findme');
            expect(fetched.id).toBe(stored.id);
        });

        it('rejects with a 404-shaped error for an unknown project', async function () {
            var err = await expectRejection(browserStorageService.getProject(99999999));

            expect(err.status).toBe(404);
            expect(err.data).toEqual({ error : 'not found' });
        });

        it('returns only the projects belonging to the requested user', async function () {
            await browserStorageService.addProject(newProject({ name : 'mine one' }));
            await browserStorageService.addProject(newProject({ name : 'mine two' }));
            await browserStorageService.addProject(newProject({
                name : 'someone else',
                userid : userid + '-other'
            }));

            var mine = await browserStorageService.getProjects(userid);

            expect(mine.length).toBe(2);
            expect(mine.map(function (p) { return p.name; }).sort())
                .toEqual(['mine one', 'mine two']);
        });

        it('stores arbitrary metadata against a project', async function () {
            var stored = await browserStorageService.addProject(newProject({ type : 'regression' }));
            var columns = [{ label : 'height', output : false, type : 'number' }];

            await browserStorageService.addMetadataToProject(stored.id, 'columns', columns);

            var fetched = await browserStorageService.getProject(stored.id);
            expect(fetched.columns).toEqual(columns);
        });

        it('stores a cloud reference against a project, and allows it to be cleared', async function () {
            var stored = await browserStorageService.addProject(newProject());

            await browserStorageService.addCloudRefToProject(stored.id, 'cloud-uuid-1');
            expect((await browserStorageService.getProject(stored.id)).cloudid).toBe('cloud-uuid-1');

            // the UI clears the reference this way when the server 404s
            await browserStorageService.addCloudRefToProject(stored.id, null);
            expect((await browserStorageService.getProject(stored.id)).cloudid).toBe(null);
        });

        it('removes the project when it is deleted', async function () {
            var stored = await browserStorageService.addProject(newProject());

            await browserStorageService.deleteProject(stored.id);

            var err = await expectRejection(browserStorageService.getProject(stored.id));
            expect(err.status).toBe(404);
        });
    });


    // ------------------------------------------------------------------
    //  labels
    // ------------------------------------------------------------------

    describe('labels', function () {

        it('appends a new label, sanitizing it first', async function () {
            var stored = await browserStorageService.addProject(newProject({ labels : [] }));

            var labels = await browserStorageService.addLabel(stored.id, 'my new label');

            expect(labels).toEqual(['my_new_label']);
            expect((await browserStorageService.getProject(stored.id)).labels).toEqual(['my_new_label']);
        });

        it('ignores a label that differs only by case', async function () {
            var stored = await browserStorageService.addProject(newProject({ labels : ['Alpha'] }));

            var labels = await browserStorageService.addLabel(stored.id, 'alpha');

            expect(labels).toEqual(['Alpha']);
        });

        it('removes a label from the project', async function () {
            var stored = await browserStorageService.addProject(newProject({ labels : ['alpha', 'beta'] }));

            var labels = await browserStorageService.deleteLabel(stored.id, 'alpha');

            expect(labels).toEqual(['beta']);
        });

        it('deletes the training data that used a label when the label is removed', async function () {
            var stored = await browserStorageService.addProject(newProject({ labels : ['alpha', 'beta'] }));
            await browserStorageService.addTrainingData(stored.id, { textdata : 'a one', label : 'alpha' });
            await browserStorageService.addTrainingData(stored.id, { textdata : 'a two', label : 'alpha' });
            await browserStorageService.addTrainingData(stored.id, { textdata : 'b one', label : 'beta' });

            await browserStorageService.deleteLabel(stored.id, 'alpha');

            // the cascade runs on a cursor inside deleteLabel's transaction,
            //  so give it a moment to complete before reading back
            await new Promise(function (resolve) { setTimeout(resolve, 50); });

            var remaining = await browserStorageService.getTrainingData(stored.id);
            expect(remaining.length).toBe(1);
            expect(remaining[0].label).toBe('beta');
        });

        it('counts training data per label, including labels with no data', async function () {
            var stored = await browserStorageService.addProject(newProject({ labels : ['alpha', 'beta', 'gamma'] }));
            await browserStorageService.addTrainingData(stored.id, { textdata : 'one', label : 'alpha' });
            await browserStorageService.addTrainingData(stored.id, { textdata : 'two', label : 'alpha' });
            await browserStorageService.addTrainingData(stored.id, { textdata : 'three', label : 'beta' });

            var counts = await browserStorageService.getLabelCounts(stored.id);

            expect(counts).toEqual({ alpha : 2, beta : 1, gamma : 0 });
        });

        it('does not count training data whose label is not on the project', async function () {
            var stored = await browserStorageService.addProject(newProject({ labels : ['alpha'] }));
            await browserStorageService.addTrainingData(stored.id, { textdata : 'one', label : 'alpha' });
            await browserStorageService.addTrainingData(stored.id, { textdata : 'stray', label : 'not-a-project-label' });

            var counts = await browserStorageService.getLabelCounts(stored.id);

            expect(counts).toEqual({ alpha : 1 });
        });
    });


    // ------------------------------------------------------------------
    //  training data
    // ------------------------------------------------------------------

    describe('training data', function () {

        it('assigns an id when adding a training item, and returns it on read', async function () {
            var stored = await browserStorageService.addProject(newProject());

            var item = await browserStorageService.addTrainingData(stored.id, {
                textdata : 'hello', label : 'alpha'
            });
            expect(typeof item.id).toBe('number');

            var all = await browserStorageService.getTrainingData(stored.id);
            expect(all).toEqual([{ id : item.id, textdata : 'hello', label : 'alpha' }]);
        });

        it('keeps each project\'s training data in its own database', async function () {
            var one = await browserStorageService.addProject(newProject({ name : 'one' }));
            var two = await browserStorageService.addProject(newProject({ name : 'two' }));

            await browserStorageService.addTrainingData(one.id, { textdata : 'in one', label : 'alpha' });
            await browserStorageService.addTrainingData(two.id, { textdata : 'in two', label : 'alpha' });

            var oneData = await browserStorageService.getTrainingData(one.id);
            var twoData = await browserStorageService.getTrainingData(two.id);

            expect(oneData.length).toBe(1);
            expect(oneData[0].textdata).toBe('in one');
            expect(twoData.length).toBe(1);
            expect(twoData[0].textdata).toBe('in two');
        });

        it('counts training data', async function () {
            var stored = await browserStorageService.addProject(newProject());
            expect(await browserStorageService.countTrainingData(stored.id)).toBe(0);

            await browserStorageService.addTrainingData(stored.id, { textdata : 'one', label : 'alpha' });
            await browserStorageService.addTrainingData(stored.id, { textdata : 'two', label : 'alpha' });

            expect(await browserStorageService.countTrainingData(stored.id)).toBe(2);
        });

        it('retrieves a single training item by id', async function () {
            var stored = await browserStorageService.addProject(newProject());
            var item = await browserStorageService.addTrainingData(stored.id, {
                textdata : 'find me', label : 'alpha'
            });

            var fetched = await browserStorageService.getTrainingDataItem(stored.id, String(item.id));

            expect(fetched.textdata).toBe('find me');
        });

        it('rejects with a 404-shaped error for an unknown training item', async function () {
            var stored = await browserStorageService.addProject(newProject());

            var err = await expectRejection(browserStorageService.getTrainingDataItem(stored.id, 99999999));

            expect(err.status).toBe(404);
        });

        it('deletes a single training item', async function () {
            var stored = await browserStorageService.addProject(newProject());
            var keep = await browserStorageService.addTrainingData(stored.id, { textdata : 'keep', label : 'alpha' });
            var drop = await browserStorageService.addTrainingData(stored.id, { textdata : 'drop', label : 'alpha' });

            await browserStorageService.deleteTrainingData(stored.id, drop.id);

            var remaining = await browserStorageService.getTrainingData(stored.id);
            expect(remaining.length).toBe(1);
            expect(remaining[0].id).toBe(keep.id);
        });

        it('clears all training data for a project', async function () {
            var stored = await browserStorageService.addProject(newProject());
            await browserStorageService.addTrainingData(stored.id, { textdata : 'one', label : 'alpha' });
            await browserStorageService.addTrainingData(stored.id, { textdata : 'two', label : 'alpha' });

            await browserStorageService.clearTrainingData(stored.id);

            expect(await browserStorageService.countTrainingData(stored.id)).toBe(0);
        });

        it('stores binary training data (image blobs) intact', async function () {
            var stored = await browserStorageService.addProject(newProject({ type : 'imgtfjs' }));
            var blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type : 'image/jpeg' });

            await browserStorageService.addTrainingData(stored.id, {
                imagedata : blob, isstored : true, label : 'alpha'
            });

            var all = await browserStorageService.getTrainingData(stored.id);
            expect(all.length).toBe(1);
            expect(all[0].imagedata instanceof Blob).toBe(true);
            expect(all[0].imagedata.size).toBe(4);
            expect(all[0].imageurl).toBeUndefined();
        });

        it('adds a batch of training data, assigning an id to every item', async function () {
            var stored = await browserStorageService.addProject(newProject());

            var items = await browserStorageService.bulkAddTrainingData(stored.id, [
                { textdata : 'one', label : 'alpha' },
                { textdata : 'two', label : 'alpha' },
                { textdata : 'three', label : 'beta' }
            ]);

            expect(items.length).toBe(3);
            items.forEach(function (item) {
                expect(typeof item.id).toBe('number');
            });
            expect(await browserStorageService.countTrainingData(stored.id)).toBe(3);
        });
    });


    // ------------------------------------------------------------------
    //  deleting a project
    // ------------------------------------------------------------------

    describe('deleteProject cleanup', function () {

        // REGRESSION TEST
        //
        // deleteProject() used to do:
        //     window.indexedDB.deleteDatabase(TRAINING_DB_NAME_PREFIX + projectId);
        //     delete trainingDataDatabases[projectId];
        //
        // The second line ran synchronously, before the versionchange event
        //  from the first line had been dispatched. When the handler set up in
        //  requiresTrainingDatabase() then fired, its guard
        //      if (trainingDataDatabases[projectId]) { ...close()... }
        //  was false, because the entry had just been removed - so close() was
        //  never called, the delete stayed BLOCKED forever, and the training
        //  database survived with all of its data (including image blobs and
        //  audio spectrograms) still in it.
        //
        // Fixed by closing the connection before dropping the cache entry, in
        //  deleteTrainingDatabase(). Do NOT make this test pass by weakening
        //  the assertion - it is asserting that the database really is gone.
        it('deletes the project\'s training database', async function () {
            var stored = await browserStorageService.addProject(newProject());
            await browserStorageService.addTrainingData(stored.id, { textdata : 'one', label : 'alpha' });

            var dbname = 'mlforkidsProject' + stored.id;
            expect(await databaseExists(dbname)).toBe(true);

            await browserStorageService.deleteProject(stored.id);

            expect(await waitForDatabaseToGo(dbname)).toBe(true);
        });

        it('does NOT delete assets belonging to the project', async function () {
            // documented behaviour, not a recommendation - asset cleanup is
            //  the caller's job (see the hard-coded key list in
            //  projects.controller.js). Pinned here so that if the service
            //  ever takes over asset cleanup, this test fails and someone
            //  removes the now-redundant cleanup from the controller.
            var stored = await browserStorageService.addProject(newProject());
            var assetKey = 'language-model-' + stored.id;
            await browserStorageService.storeAssetData(assetKey, new Blob(['model bytes']));

            await browserStorageService.deleteProject(stored.id);

            var survivor = await browserStorageService.retrieveAsset(assetKey);
            expect(survivor).toBeDefined();

            await browserStorageService.deleteAsset(assetKey);
        });
    });


    // ------------------------------------------------------------------
    //  assets
    // ------------------------------------------------------------------

    describe('assets', function () {

        var assetKey;

        beforeEach(function () {
            assetKey = 'asset-' + userid;
        });

        afterEach(async function () {
            await browserStorageService.deleteAsset(assetKey);
        });

        it('round-trips asset data', async function () {
            await browserStorageService.storeAssetData(assetKey, new Blob(['some bytes']));

            var asset = await browserStorageService.retrieveAsset(assetKey);

            expect(asset instanceof Blob).toBe(true);
            expect(asset.size).toBe('some bytes'.length);
        });

        it('overwrites an asset stored under the same key', async function () {
            await browserStorageService.storeAssetData(assetKey, new Blob(['first']));
            await browserStorageService.storeAssetData(assetKey, new Blob(['second-longer']));

            var asset = await browserStorageService.retrieveAsset(assetKey);

            expect(asset.size).toBe('second-longer'.length);
        });

        it('reads an asset back as text', async function () {
            await browserStorageService.storeAssetData(assetKey, new Blob(['hello assets']));

            var text = await browserStorageService.retrieveAssetAsText(assetKey);

            expect(text).toBe('hello assets');
        });

        it('downloads and stores an asset from a url', async function () {
            $httpMock.get.and.returnValue(Promise.resolve({ data : new Blob(['downloaded']) }));

            await browserStorageService.storeAsset(assetKey, 'https://example.com/model.zip');

            expect($httpMock.get).toHaveBeenCalledWith('https://example.com/model.zip',
                                                       { responseType : 'blob' });
            var asset = await browserStorageService.retrieveAsset(assetKey);
            expect(asset.size).toBe('downloaded'.length);
        });

        it('rejects with a 404-shaped error for an unknown asset', async function () {
            var err = await expectRejection(browserStorageService.retrieveAsset('no-such-asset-' + userid));

            expect(err.status).toBe(404);
        });

        it('deletes an asset', async function () {
            await browserStorageService.storeAssetData(assetKey, new Blob(['bytes']));

            await browserStorageService.deleteAsset(assetKey);

            var err = await expectRejection(browserStorageService.retrieveAsset(assetKey));
            expect(err.status).toBe(404);
        });
    });


    // ------------------------------------------------------------------
    //  Watson Assistant payload
    // ------------------------------------------------------------------

    describe('getTrainingForWatsonAssistant', function () {

        it('groups training data into intents by label', async function () {
            var stored = await browserStorageService.addProject(newProject({
                name : 'wa project', labels : ['alpha', 'beta'], language : 'fr'
            }));
            await browserStorageService.addTrainingData(stored.id, { textdata : 'a one', label : 'alpha' });
            await browserStorageService.addTrainingData(stored.id, { textdata : 'a two', label : 'alpha' });
            await browserStorageService.addTrainingData(stored.id, { textdata : 'b one', label : 'beta' });

            var payload = await browserStorageService.getTrainingForWatsonAssistant(
                                    await browserStorageService.getProject(stored.id));

            expect(payload.name).toBe('wa project');
            expect(payload.language).toBe('fr');
            expect(payload.metadata).toEqual({ createdby : 'machinelearningforkids' });
            expect(payload.intents.length).toBe(2);

            var alpha = payload.intents.find(function (i) { return i.intent === 'alpha'; });
            expect(alpha.examples).toEqual([{ text : 'a one' }, { text : 'a two' }]);
        });

        it('defaults the language to english when the project has none', async function () {
            var stored = await browserStorageService.addProject(newProject({ language : undefined }));
            await browserStorageService.addTrainingData(stored.id, { textdata : 'one', label : 'alpha' });

            var payload = await browserStorageService.getTrainingForWatsonAssistant(
                                    await browserStorageService.getProject(stored.id));

            expect(payload.language).toBe('en');
        });

        it('drops examples that differ only by case, which Watson Assistant rejects', async function () {
            var stored = await browserStorageService.addProject(newProject());
            await browserStorageService.addTrainingData(stored.id, { textdata : 'Hello There', label : 'alpha' });
            await browserStorageService.addTrainingData(stored.id, { textdata : 'hello there', label : 'alpha' });
            await browserStorageService.addTrainingData(stored.id, { textdata : 'something else', label : 'alpha' });

            var payload = await browserStorageService.getTrainingForWatsonAssistant(
                                    await browserStorageService.getProject(stored.id));

            expect(payload.intents[0].examples).toEqual([
                { text : 'Hello There' },
                { text : 'something else' }
            ]);
        });

        it('collapses labels that differ only by case onto the first one seen', async function () {
            var stored = await browserStorageService.addProject(newProject({ labels : ['Alpha'] }));
            await browserStorageService.addTrainingData(stored.id, { textdata : 'one', label : 'Alpha' });
            await browserStorageService.addTrainingData(stored.id, { textdata : 'two', label : 'alpha' });

            var payload = await browserStorageService.getTrainingForWatsonAssistant(
                                    await browserStorageService.getProject(stored.id));

            expect(payload.intents.length).toBe(1);
            expect(payload.intents[0].intent).toBe('Alpha');
            expect(payload.intents[0].examples.length).toBe(2);
        });

        it('replaces whitespace in intent names', async function () {
            var stored = await browserStorageService.addProject(newProject({ labels : ['two words'] }));
            await browserStorageService.addTrainingData(stored.id, { textdata : 'one', label : 'two words' });

            var payload = await browserStorageService.getTrainingForWatsonAssistant(
                                    await browserStorageService.getProject(stored.id));

            expect(payload.intents[0].intent).toBe('two_words');
        });

        it('truncates examples to the 1024 characters Watson Assistant allows', async function () {
            var stored = await browserStorageService.addProject(newProject());
            await browserStorageService.addTrainingData(stored.id, {
                textdata : new Array(1200).join('x'), label : 'alpha'
            });

            var payload = await browserStorageService.getTrainingForWatsonAssistant(
                                    await browserStorageService.getProject(stored.id));

            expect(payload.intents[0].examples[0].text.length).toBe(1024);
        });
    });


    // ------------------------------------------------------------------
    //  error recovery
    // ------------------------------------------------------------------

    describe('isCorruptedDatabase', function () {

        it('recognises the Chrome wording', function () {
            expect(browserStorageService.isCorruptedDatabase({
                name : 'NotFoundError',
                message : 'Failed to execute \'transaction\' on \'IDBDatabase\': One of the specified object stores was not found.'
            })).toBe(true);
        });

        it('recognises the Firefox wording', function () {
            expect(browserStorageService.isCorruptedDatabase({
                name : 'NotFoundError',
                message : 'IDBDatabase.transaction: \'training\' is not a known object store name'
            })).toBe(true);
        });

        it('does not treat other NotFoundErrors as corruption', function () {
            expect(browserStorageService.isCorruptedDatabase({
                name : 'NotFoundError',
                message : 'something else entirely'
            })).toBe(false);
        });

        it('does not treat other errors as corruption', function () {
            expect(browserStorageService.isCorruptedDatabase({
                name : 'InvalidStateError',
                message : 'The database connection is closing.'
            })).toBe(false);
            expect(browserStorageService.isCorruptedDatabase(undefined)).toBeFalsy();
        });
    });


    describe('deleteSessionUserProjects', function () {

        // the only test that uses the 'session-users' classid - it deletes
        //  every project in that class, so no other test may rely on one

        // REGRESSION TEST - this had the same blocked-delete bug as
        //  deleteProject (see the comment there), with the cache entry removed
        //  even earlier, so the versionchange guard failed the same way. Both
        //  call sites now go through deleteTrainingDatabase().
        it('deletes every project stored for session users, and their training databases', async function () {
            var sessionOne = await browserStorageService.addProject(newProject({
                name : 'session one', classid : 'session-users'
            }));
            var sessionTwo = await browserStorageService.addProject(newProject({
                name : 'session two', classid : 'session-users'
            }));
            var keep = await browserStorageService.addProject(newProject({ name : 'keep me' }));

            await browserStorageService.addTrainingData(sessionOne.id, { textdata : 'one', label : 'alpha' });

            await browserStorageService.deleteSessionUserProjects();

            var remaining = await browserStorageService.getProjects(userid);
            expect(remaining.length).toBe(1);
            expect(remaining[0].id).toBe(keep.id);

            expect(await waitForDatabaseToGo('mlforkidsProject' + sessionOne.id)).toBe(true);
            expect(await waitForDatabaseToGo('mlforkidsProject' + sessionTwo.id)).toBe(true);
        });

        it('asks the cleanup service to tidy up local model data for each deleted project', async function () {
            await browserStorageService.addProject(newProject({
                name : 'session project', classid : 'session-users', type : 'imgtfjs'
            }));

            await browserStorageService.deleteSessionUserProjects();

            expect(cleanupServiceMock.deleteProject).toHaveBeenCalled();
            var cleaned = cleanupServiceMock.deleteProject.calls.mostRecent().args[0];
            expect(cleaned.classid).toBe('session-users');
        });
    });

});
